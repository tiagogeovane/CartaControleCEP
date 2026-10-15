import json
from collections.abc import Sequence
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from app.application.events.subgrupo_events import SubgrupoProcessadoEvent
from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.observers import ISubgrupoObserver
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    ISubgrupoRepository,
)
from app.domain.rules.detector import DetectorRegrasNelson


class InMemoryCartaRepository(ICartaControleRepository):
    def __init__(self) -> None:
        self.cartas: dict[UUID, CartaControle] = {}

    async def obter_por_id(self, carta_id: UUID) -> CartaControle | None:
        return self.cartas.get(carta_id)

    async def salvar(self, carta: CartaControle) -> CartaControle:
        self.cartas[carta.id] = carta
        return carta

    async def listar_todas(self, processo_id: UUID | None = None) -> list[CartaControle]:
        return list(self.cartas.values())

    async def atualizar(self, carta: CartaControle) -> CartaControle:
        self.cartas[carta.id] = carta
        return carta

    async def atualizar_limites(self, carta_id: UUID, novos_limites) -> None:
        if carta_id in self.cartas:
            self.cartas[carta_id].atualizar_limites(novos_limites)

    async def remover(self, carta_id: UUID) -> bool:
        return self.cartas.pop(carta_id, None) is not None


class InMemorySubgrupoRepository(ISubgrupoRepository):
    def __init__(self) -> None:
        self.subgrupos: dict[UUID, list[Subgrupo]] = {}

    async def salvar(self, subgrupo: Subgrupo) -> Subgrupo:
        if subgrupo.carta_id not in self.subgrupos:
            self.subgrupos[subgrupo.carta_id] = []
        self.subgrupos[subgrupo.carta_id].append(subgrupo)
        return subgrupo

    async def salvar_em_lote(self, subgrupos: Sequence[Subgrupo]) -> list[Subgrupo]:
        for s in subgrupos:
            await self.salvar(s)
        return list(subgrupos)

    async def obter_por_id(self, subgrupo_id: UUID) -> Subgrupo | None:
        for sgs in self.subgrupos.values():
            for sg in sgs:
                if sg.id == subgrupo_id:
                    return sg
        return None

    async def listar_por_carta(self, carta_id: UUID, limite: int | None = None) -> list[Subgrupo]:
        lista = self.subgrupos.get(carta_id, [])
        if limite is not None:
            return lista[-limite:]
        return list(lista)

    async def atualizar_violacoes_em_lote(self, subgrupos: Sequence[Subgrupo]) -> None:
        for sg in subgrupos:
            if sg.carta_id in self.subgrupos:
                for idx, existing in enumerate(self.subgrupos[sg.carta_id]):
                    if existing.id == sg.id:
                        self.subgrupos[sg.carta_id][idx] = sg


class EventObserver(ISubgrupoObserver):
    def __init__(self) -> None:
        self.eventos_emitidos: list[dict] = []

    async def notificar_processamento(self, carta: CartaControle, subgrupo: Subgrupo) -> None:
        evento = SubgrupoProcessadoEvent.from_domain(carta, subgrupo)
        self.eventos_emitidos.append(evento.to_dict())


@pytest.mark.asyncio
async def test_simulacao_grafico_c_20_subgrupos():
    """Valida que o envio de todos os 20 subgrupos de grafico_c.json resulta em limites consolidados

    corretos (LC=4.0, LSC=10.0, sigma=2.0) e eventos WebSocket com todos os campos presentes.
    """
    json_path = Path(__file__).resolve().parents[3] / "scripts" / "json" / "grafico_c.json"
    with open(json_path, "r", encoding="utf-8") as f:
        dados = json.load(f)

    amostras = dados["Data"]
    assert len(amostras) == 20

    carta_repo = InMemoryCartaRepository()
    subgrupo_repo = InMemorySubgrupoRepository()
    detector = DetectorRegrasNelson()
    observer = EventObserver()

    service = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        detector_anomalias=detector,
        observers=[observer],
    )

    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="C",
        tamanho_subgrupo=1,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    for idx, amostra in enumerate(amostras, start=1):
        await service.executar(
            carta_id=carta.id,
            amostras_valores=amostra,
            numero_subgrupo=idx,
        )

    # 1. Verifica limites finais no repositório
    carta_final = await carta_repo.obter_por_id(carta.id)
    assert carta_final is not None
    assert carta_final.total_subgrupos == 20

    limites = carta_final.limites_atuais
    assert limites is not None
    assert round(limites.lc, 4) == 4.0000
    assert round(limites.sigma_estimado, 4) == 2.0000
    assert round(limites.lsc, 4) == 10.0000
    assert round(limites.lic, 4) == 0.0000

    # 2. Verifica que o evento WebSocket possui todos os campos enriquecidos (incluindo sigma)
    ultimo_evento = observer.eventos_emitidos[-1]
    assert ultimo_evento["limites"]["lc"] == 4.0
    assert ultimo_evento["limites"]["sigma_estimado"] == 2.0
    assert ultimo_evento["limites"]["lsc"] == 10.0
    assert ultimo_evento["limites"]["lic"] == 0.0

    # 3. Verifica reavaliação de status nos subgrupos
    sgs = await subgrupo_repo.listar_por_carta(carta.id, 100)
    sg18 = next(s for s in sgs if s.numero_subgrupo == 18)
    sg20 = next(s for s in sgs if s.numero_subgrupo == 20)

    # Subgrupo #018 tem valor 9 (menor ou igual ao LSC consolidado de 10.0) -> SOB CONTROLE
    assert sg18.fora_de_controle is False

    # Subgrupo #020 tem valor 11 (maior que o LSC consolidado de 10.0) -> FORA DE CONTROLE (Regra 1)
    assert sg20.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1" for v in sg20.violacoes)


@pytest.mark.asyncio
async def test_simulacao_grafico_p_20_subgrupos():
    """Valida que o envio de grafico_p.json (20 subgrupos) resulta nos limites consolidados esperados

    (LC=0.1600, sigma=0.1640, LSC=0.6519).
    """
    json_path = Path(__file__).resolve().parents[3] / "scripts" / "json" / "grafico_p.json"
    with open(json_path, "r", encoding="utf-8") as f:
        dados = json.load(f)

    amostras = dados["Data"]
    assert len(amostras) == 20

    carta_repo = InMemoryCartaRepository()
    subgrupo_repo = InMemorySubgrupoRepository()
    detector = DetectorRegrasNelson()

    service = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        detector_anomalias=detector,
    )

    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="P",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    for idx, amostra in enumerate(amostras, start=1):
        await service.executar(
            carta_id=carta.id,
            amostras_valores=amostra,
            numero_subgrupo=idx,
        )

    carta_final = await carta_repo.obter_por_id(carta.id)
    assert carta_final is not None
    assert carta_final.total_subgrupos == 20

    limites = carta_final.limites_atuais
    assert limites is not None
    assert round(limites.lc, 4) == 0.1600
    assert round(limites.sigma_estimado, 4) == 0.1640
    assert round(limites.lsc, 4) == 0.6519
    assert round(limites.lic, 4) == 0.0000


@pytest.mark.asyncio
async def test_simulacao_calibracao_e_acompanhamento_prova_1():
    """Valida que o envio de dados_simulado_prova_1_0226.json (20 subgrupos de calibração)

    calcula LC=4.9607, LSC=4.9733, LIC=4.9480, sigma=0.0094,
    e o envio subsequente de dados_acompanhamento_exemplo.json (3 subgrupos com Goal='Acompanhamento')
    comuta a carta para modo FIXO e MANTÉM RIGOROSAMENTE CONGELADOS os limites de calibração.
    """
    calib_path = Path(__file__).resolve().parents[3] / "scripts" / "json" / "dados_simulado_prova_1_0226.json"
    with open(calib_path, "r", encoding="utf-8") as f:
        dados_calib = json.load(f)

    acomp_path = Path(__file__).resolve().parents[3] / "scripts" / "json" / "dados_acompanhamento_exemplo.json"
    with open(acomp_path, "r", encoding="utf-8") as f:
        dados_acomp = json.load(f)

    carta_repo = InMemoryCartaRepository()
    subgrupo_repo = InMemorySubgrupoRepository()
    detector = DetectorRegrasNelson()
    observer = EventObserver()

    service = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        detector_anomalias=detector,
        observers=[observer],
    )

    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    # 1. Ingestão da Calibração (20 subgrupos)
    amostras_calib = dados_calib["Data"]
    assert len(amostras_calib) == 20
    for idx, amostra in enumerate(amostras_calib, start=1):
        await service.executar(
            carta_id=carta.id,
            amostras_valores=amostra,
            numero_subgrupo=idx,
            goal=dados_calib.get("Goal", "Calibrar"),
        )

    carta_calib = await carta_repo.obter_por_id(carta.id)
    assert carta_calib.total_subgrupos == 20
    assert carta_calib.modo_limites == "DINAMICO"
    limites_calib = carta_calib.limites_atuais
    assert limites_calib is not None

    lc_esperado = 4.9607
    lsc_esperado = 4.9733
    lic_esperado = 4.9480
    sigma_esperado = 0.0094

    assert round(limites_calib.lc, 4) == lc_esperado
    assert round(limites_calib.lsc, 4) == lsc_esperado
    assert round(limites_calib.lic, 4) == lic_esperado
    assert round(limites_calib.sigma_estimado, 4) == sigma_esperado

    # 2. Ingestão de Acompanhamento (3 subgrupos)
    amostras_acomp = dados_acomp["Data"]
    assert len(amostras_acomp) == 3
    for idx, amostra in enumerate(amostras_acomp, start=21):
        await service.executar(
            carta_id=carta.id,
            amostras_valores=amostra,
            numero_subgrupo=idx,
            goal=dados_acomp.get("Goal", "Acompanhamento"),
        )

    carta_final = await carta_repo.obter_por_id(carta.id)
    assert carta_final.total_subgrupos == 23
    # Comutou para FIXO
    assert carta_final.modo_limites == "FIXO"
    # Limites permanecem rigorosamente os mesmos da calibração!
    assert round(carta_final.limites_atuais.lc, 4) == lc_esperado
    assert round(carta_final.limites_atuais.lsc, 4) == lsc_esperado
    assert round(carta_final.limites_atuais.lic, 4) == lic_esperado
    assert round(carta_final.limites_atuais.sigma_estimado, 4) == sigma_esperado

    # Último evento WebSocket transmitido deve carregar modo_limites="FIXO"
    assert observer.eventos_emitidos[-1]["modo_limites"] == "FIXO"
    assert observer.eventos_emitidos[-1]["numero_subgrupo"] == 23

