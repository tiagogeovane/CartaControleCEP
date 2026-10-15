from collections.abc import Sequence
from uuid import UUID, uuid4

import pytest
from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.exceptions import AmostraInvalidaError, CartaNaoEncontradaError
from app.domain.interfaces.observers import ISubgrupoObserver
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    ISubgrupoRepository,
)
from app.domain.rules.detector import DetectorRegrasNelson
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao


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

    async def atualizar_limites(self, carta_id: UUID, novos_limites) -> None:
        if carta_id in self.cartas:
            self.cartas[carta_id].atualizar_limites(novos_limites)


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

    async def listar_por_carta(self, carta_id: UUID, limite: int | None = None) -> list[Subgrupo]:
        lista = self.subgrupos.get(carta_id, [])
        if limite is not None:
            return lista[-limite:]
        return list(lista)

    async def atualizar_violacoes_em_lote(self, subgrupos: Sequence[Subgrupo]) -> None:
        pass


class MockObserver(ISubgrupoObserver):
    def __init__(self) -> None:
        self.chamadas: list[tuple[CartaControle, Subgrupo]] = []

    async def notificar_processamento(self, carta: CartaControle, subgrupo: Subgrupo) -> None:
        self.chamadas.append((carta, subgrupo))


@pytest.fixture
def repos():
    carta_repo = InMemoryCartaRepository()
    subgrupo_repo = InMemorySubgrupoRepository()
    return carta_repo, subgrupo_repo


@pytest.fixture
def observer():
    return MockObserver()


@pytest.fixture
def service(repos, observer):
    carta_repo, subgrupo_repo = repos
    detector = DetectorRegrasNelson()
    svc = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        detector_anomalias=detector,
        observers=[observer],
    )
    return svc


@pytest.mark.asyncio
async def test_processar_primeiro_subgrupo_xr_dinamico(service, repos, observer):
    carta_repo, subgrupo_repo = repos
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        especificacoes=LimitesEspecificacao(lse=26.0, lie=24.0, valor_nominal=25.0),
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    amostra = [25.0, 25.2, 24.8, 25.1, 24.9]
    subgrupo = await service.executar(carta_id=carta.id, amostras_valores=amostra)

    assert subgrupo.numero_subgrupo == 1
    assert subgrupo.valores_brutos == amostra
    assert subgrupo.estatisticas.media_x == pytest.approx(25.0, 0.001)
    assert subgrupo.estatisticas.amplitude_r == pytest.approx(0.4, 0.001)

    # Limites calculados dinamicamente com n=5 (A2=0.577)
    assert carta.limites_atuais is not None
    assert carta.limites_atuais.lc == pytest.approx(25.0, 0.001)
    assert carta.limites_atuais.lsc == pytest.approx(25.0 + 0.577 * 0.4, 0.001)
    assert carta.limites_atuais.lic == pytest.approx(25.0 - 0.577 * 0.4, 0.001)
    assert subgrupo.fora_de_controle is False
    assert subgrupo.violacoes == []

    # Observer acionado
    assert len(observer.chamadas) == 1
    assert observer.chamadas[0][1] == subgrupo

    # Persistido
    salvos = await subgrupo_repo.listar_por_carta(carta.id)
    assert len(salvos) == 1


@pytest.mark.asyncio
async def test_processar_subgrupo_com_violacao_regra1(service, repos, observer):
    carta_repo, _ = repos
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=3,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    # 1º subgrupo: média 10.0, R = 1.0
    await service.executar(carta.id, [9.5, 10.0, 10.5])

    # 2º subgrupo: valor muito distante (ex: média 50.0) -> anomalia fora de 3 sigma
    sub2 = await service.executar(carta.id, [50.0, 50.0, 50.0])

    assert sub2.fora_de_controle is True
    codigos_violados = [v.codigo_regra for v in sub2.violacoes]
    assert "REGRA_1" in codigos_violados


@pytest.mark.asyncio
async def test_validacao_rn02_tamanho_divergente_rejeita(service, repos):
    carta_repo, _ = repos
    carta = CartaControle(processo_id=uuid4(), tipo_carta="X_R", tamanho_subgrupo=5)
    await carta_repo.salvar(carta)

    # Envia 4 medições quando esperado era 5
    with pytest.raises(AmostraInvalidaError) as exc_info:
        await service.executar(carta.id, [10.0, 11.0, 12.0, 13.0])

    assert "esperado 5, recebido 4" in str(exc_info.value)


@pytest.mark.asyncio
async def test_carta_nao_encontrada_rejeita(service):
    invalido = uuid4()
    with pytest.raises(CartaNaoEncontradaError):
        await service.executar(invalido, [1.0, 2.0, 3.0])


@pytest.mark.asyncio
async def test_gerenciamento_de_observers(service, repos):
    novo_obs = MockObserver()
    service.adicionar_observer(novo_obs)
    assert novo_obs in service._observers

    # Evita duplicação
    service.adicionar_observer(novo_obs)
    assert service._observers.count(novo_obs) == 1

    removido = service.remover_observer(novo_obs)
    assert removido is True
    assert novo_obs not in service._observers


@pytest.mark.asyncio
async def test_processamento_carta_imr_leituras_individuais(service, repos):
    carta_repo, _ = repos
    carta = CartaControle(processo_id=uuid4(), tipo_carta="I_MR", tamanho_subgrupo=1)
    await carta_repo.salvar(carta)

    # 1ª leitura unitária: ainda sem limites (requer ao menos 2 leituras para MR)
    sub1 = await service.executar(carta.id, [100.0])
    assert sub1.numero_subgrupo == 1
    assert sub1.estatisticas.media_x == 100.0
    assert carta.limites_atuais is None

    # 2ª leitura unitária: agora calcula MR = |105 - 100| = 5.0 e define limites
    sub2 = await service.executar(carta.id, [105.0])
    assert sub2.numero_subgrupo == 2
    assert carta.limites_atuais is not None
    assert carta.limites_atuais.lc == pytest.approx(102.5, 0.001)
    assert carta.limites_atuais.sigma_estimado == pytest.approx(5.0 / 1.128, 0.01)


@pytest.mark.asyncio
async def test_processamento_carta_xs_subgrupos_grandes(service, repos):
    carta_repo, _ = repos
    carta = CartaControle(processo_id=uuid4(), tipo_carta="X_S", tamanho_subgrupo=12)
    await carta_repo.salvar(carta)

    amostra = [10.0 + (i * 0.1) for i in range(12)]
    sub = await service.executar(carta.id, amostra)

    assert sub.numero_subgrupo == 1
    assert carta.limites_atuais is not None
    assert carta.limites_atuais.sigma_estimado > 0


@pytest.mark.asyncio
async def test_executar_lote_importacao_historica(service, repos, observer):
    carta_repo, subgrupo_repo = repos
    carta = CartaControle(processo_id=uuid4(), tipo_carta="X_R", tamanho_subgrupo=3)
    await carta_repo.salvar(carta)

    lote = [
        [10.0, 10.2, 9.8],
        [10.1, 10.0, 10.3],
        [9.9, 10.1, 10.0],
        [10.2, 10.4, 10.1],
    ]

    subgrupos = await service.executar_lote(carta.id, lote)

    assert len(subgrupos) == 4
    assert [s.numero_subgrupo for s in subgrupos] == [1, 2, 3, 4]
    assert carta.total_subgrupos == 4
    assert carta.limites_atuais is not None

    salvos = await subgrupo_repo.listar_por_carta(carta.id)
    assert len(salvos) == 4
    # Notificação do último subgrupo processado
    assert len(observer.chamadas) == 1
    assert observer.chamadas[0][1] == subgrupos[-1]


@pytest.mark.asyncio
async def test_processar_subgrupo_anomalia_dispersao(service, repos):
    carta_repo, subgrupo_repo = repos
    # Carta com limites fixos onde LSC_R = 0.0464
    limites = LimitesControle(
        lc=4.9607,
        lsc=4.9733,
        lic=4.9480,
        sigma_estimado=0.0094,
        lc_dispersao=0.02195,
        lsc_dispersao=0.0464,
        lic_dispersao=0.0,
    )
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        limites_atuais=limites,
        modo_limites="FIXO",
    )
    await carta_repo.salvar(carta)

    # Subgrupo com amplitude R = 4.98 - 4.92 = 0.060 > LSC_R (0.0464), mas média = 4.950 (dentro de [4.9480, 4.9733])
    amostras = [4.98, 4.92, 4.95, 4.94, 4.96]
    sub = await service.executar(carta.id, amostras, numero_subgrupo=9)

    assert sub.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1_DISP" for v in sub.violacoes)


@pytest.mark.asyncio
async def test_processar_subgrupo_auto_congelamento_em_acompanhamento(service, repos):
    carta_repo, subgrupo_repo = repos
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    # 1. Calibração com 3 subgrupos em modo DINAMICO
    amostras_calib = [
        [4.96, 4.95, 4.94, 4.96, 4.95],
        [4.95, 4.96, 4.97, 4.95, 4.96],
        [4.94, 4.95, 4.96, 4.94, 4.95],
    ]
    for amostra in amostras_calib:
        await service.executar(carta.id, amostra, goal="Calibrar")

    carta_calibrada = await carta_repo.obter_por_id(carta.id)
    assert carta_calibrada.modo_limites == "DINAMICO"
    limites_calibrados = carta_calibrada.limites_atuais
    assert limites_calibrados is not None
    lc_calib = limites_calibrados.lc
    lsc_calib = limites_calibrados.lsc

    # 2. Envio de subgrupo de acompanhamento
    amostra_acomp = [5.10, 5.12, 5.11, 5.09, 5.10]  # média bem diferente
    await service.executar(carta.id, amostra_acomp, goal="Acompanhamento")

    carta_pos_acomp = await carta_repo.obter_por_id(carta.id)
    # A carta deve ter mudado para FIXO
    assert carta_pos_acomp.modo_limites == "FIXO"
    # Os limites de controle devem estar RIGOROSAMENTE congelados (iguais à calibração)
    assert carta_pos_acomp.limites_atuais.lc == lc_calib
    assert carta_pos_acomp.limites_atuais.lsc == lsc_calib


@pytest.mark.asyncio
async def test_processar_subgrupo_volta_para_dinamico_em_calibracao(service, repos):
    carta_repo, subgrupo_repo = repos
    limites = LimitesControle(
        lc=4.9600,
        lsc=4.9800,
        lic=4.9400,
        sigma_estimado=0.0100,
        lc_dispersao=0.0200,
        lsc_dispersao=0.0400,
        lic_dispersao=0.0,
    )
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        limites_atuais=limites,
        modo_limites="FIXO",
    )
    await carta_repo.salvar(carta)

    # Subgrupos iniciais
    await service.executar(carta.id, [4.96, 4.96, 4.96, 4.96, 4.96])
    await service.executar(carta.id, [4.96, 4.96, 4.96, 4.96, 4.96])

    # Envia dados com goal="Calibrar"
    await service.executar(carta.id, [5.10, 5.10, 5.10, 5.10, 5.10], goal="Calibrar")

    carta_atualizada = await carta_repo.obter_por_id(carta.id)
    assert carta_atualizada.modo_limites == "DINAMICO"
    # Como voltou para DINAMICO, os limites foram recalculados com a nova média
    assert carta_atualizada.limites_atuais.lc != 4.9600


@pytest.mark.asyncio
async def test_executar_lote_com_goal_acompanhamento_congela_limites(service, repos):
    carta_repo, subgrupo_repo = repos
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    # 1. Calibração inicial
    amostras_calib = [
        [4.96, 4.95, 4.94, 4.96, 4.95],
        [4.95, 4.96, 4.97, 4.95, 4.96],
    ]
    await service.executar_lote(carta.id, amostras_calib, goal="Calibrar")

    carta_calib = await carta_repo.obter_por_id(carta.id)
    lc_calib = carta_calib.limites_atuais.lc

    # 2. Lote de acompanhamento
    amostras_acomp = [
        [5.20, 5.20, 5.20, 5.20, 5.20],
        [5.30, 5.30, 5.30, 5.30, 5.30],
    ]
    await service.executar_lote(carta.id, amostras_acomp, goal="Acompanhamento")

    carta_pos = await carta_repo.obter_por_id(carta.id)
    assert carta_pos.modo_limites == "FIXO"
    assert carta_pos.limites_atuais.lc == lc_calib

