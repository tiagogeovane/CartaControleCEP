import pytest
from uuid import UUID, uuid4
from collections.abc import Sequence

from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    ISubgrupoRepository,
)
from app.domain.value_objects.limites import LimitesControle


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

    async def atualizar_limites(self, carta_id: UUID, novos_limites: LimitesControle) -> None:
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


DATA_20_SUBGRUPOS = [
    [4.960, 4.946, 4.950, 4.956, 4.958],  # #001: X=4.9540, R=0.014
    [4.958, 4.927, 4.935, 4.940, 4.950],  # #002: X=4.9420, R=0.031
    [4.971, 4.929, 4.965, 4.952, 4.938],  # #003: X=4.9510, R=0.042
    [4.940, 4.982, 4.970, 4.953, 4.960],  # #004: X=4.9610, R=0.042
    [4.964, 4.950, 4.953, 4.962, 4.956],  # #005: X=4.9570, R=0.014
    [4.969, 4.951, 4.955, 4.966, 4.954],  # #006: X=4.9590, R=0.018
    [4.960, 4.944, 4.957, 4.948, 4.951],  # #007: X=4.9520, R=0.016
    [4.969, 4.949, 4.963, 4.952, 4.962],  # #008: X=4.9590, R=0.020
    [4.984, 4.928, 4.960, 4.943, 4.955],  # #009: X=4.9540, R=0.056
    [4.970, 4.934, 4.961, 4.940, 4.965],  # #010: X=4.9540, R=0.036
    [4.975, 4.959, 4.962, 4.971, 4.968],  # #011: X=4.9670, R=0.016
    [4.945, 4.977, 4.950, 4.969, 4.954],  # #012: X=4.9590, R=0.032
    [4.976, 4.964, 4.970, 4.968, 4.972],  # #013: X=4.9700, R=0.012
    [4.970, 4.954, 4.964, 4.959, 4.968],  # #014: X=4.9630, R=0.016
    [4.982, 4.962, 4.968, 4.975, 4.963],  # #015: X=4.9700, R=0.020
    [4.961, 4.943, 4.950, 4.949, 4.957],  # #016: X=4.9520, R=0.018
    [4.980, 4.970, 4.975, 4.978, 4.977],  # #017: X=4.9760, R=0.010
    [4.975, 4.968, 4.971, 4.969, 4.972],  # #018: X=4.9710, R=0.007
    [4.977, 4.966, 4.969, 4.973, 4.970],  # #019: X=4.9710, R=0.011
    [4.975, 4.967, 4.969, 4.972, 4.972],  # #020: X=4.9710, R=0.008
]


@pytest.fixture
def service_e_repos():
    carta_repo = InMemoryCartaRepository()
    subgrupo_repo = InMemorySubgrupoRepository()
    service = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
    )
    return service, carta_repo, subgrupo_repo


@pytest.mark.asyncio
async def test_avaliacao_retroativa_lote_20_subgrupos_xr(service_e_repos):
    """Cenário 1: Ingestão em lote dos 20 subgrupos em modo DINAMICO (Fase 1 - Calibração)."""
    service, carta_repo, subgrupo_repo = service_e_repos

    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    subgrupos = await service.executar_lote(carta.id, DATA_20_SUBGRUPOS)
    assert len(subgrupos) == 20

    # 1. Asserções Matemáticas de Limites da Carta
    assert carta.limites_atuais is not None
    assert pytest.approx(carta.limites_atuais.lc, abs=1e-3) in (
        pytest.approx(4.9612, abs=1e-3),
        pytest.approx(4.9607, abs=1e-3),
    )
    assert pytest.approx(carta.limites_atuais.lsc, abs=1e-3) in (
        pytest.approx(4.9740, abs=1e-3),
        pytest.approx(4.9733, abs=1e-3),
    )
    assert pytest.approx(carta.limites_atuais.lic, abs=1e-3) in (
        pytest.approx(4.9484, abs=1e-3),
        pytest.approx(4.9480, abs=1e-3),
    )
    assert pytest.approx(carta.limites_atuais.sigma_estimado, abs=1e-3) in (
        pytest.approx(0.0096, abs=1e-3),
        pytest.approx(0.0094, abs=1e-3),
    )

    # Limites da Carta R de Dispersão
    assert carta.limites_atuais.lc_dispersao is not None
    assert pytest.approx(carta.limites_atuais.lc_dispersao, abs=1e-3) in (
        pytest.approx(0.02225, abs=1e-3),
        pytest.approx(0.02195, abs=1e-3),
    )
    assert pytest.approx(carta.limites_atuais.lsc_dispersao, abs=1e-3) in (
        pytest.approx(0.0470, abs=1e-3),
        pytest.approx(0.0464, abs=1e-3),
    )
    assert carta.limites_atuais.lic_dispersao == 0.0

    # 2. Asserções de Violações Retroativas nas Regras de Nelson
    # Subgrupo #001 (media = 4.9540): dentro dos limites, sem anomalia
    sg1 = subgrupos[0]
    assert sg1.fora_de_controle is False
    assert len(sg1.violacoes) == 0

    # Subgrupo #002 (media = 4.9420 < LIC): violação retroativa do limite inferior (REGRA_1)
    sg2 = subgrupos[1]
    assert sg2.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1" for v in sg2.violacoes)

    # Subgrupo #009 (media = 4.9540, R = 0.0560 > LSC_R): violação na carta de amplitude (REGRA_1_DISP)
    sg9 = subgrupos[8]
    assert sg9.fora_de_controle is True
    assert any("DISP" in v.codigo_regra or v.codigo_regra == "REGRA_1" for v in sg9.violacoes)

    # Subgrupos #013 e #015 (media = 4.9700): NÃO devem possuir REGRA_1 pois 4.9700 < LSC (4.9733 / 4.9740)
    sg13 = subgrupos[12]
    assert not any(v.codigo_regra == "REGRA_1" for v in sg13.violacoes)
    sg15 = subgrupos[14]
    assert not any(v.codigo_regra == "REGRA_1" for v in sg15.violacoes)

    # Subgrupo #017 (media = 4.9760 > LSC): violação além do limite superior (REGRA_1)
    sg17 = subgrupos[16]
    assert sg17.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1" for v in sg17.violacoes)

    # Subgrupos #018, #019, #020 (medias = 4.9710 < LSC): NÃO devem ter REGRA_1, mas devem ter REGRA_5 e/ou REGRA_6
    for idx in (17, 18, 19):
        sg = subgrupos[idx]
        assert not any(v.codigo_regra == "REGRA_1" for v in sg.violacoes), (
            f"Subgrupo #{sg.numero_subgrupo} não deve ter REGRA_1 (média 4.9710 < LSC)"
        )
        codigos = [v.codigo_regra for v in sg.violacoes]
        assert any(c in ("REGRA_5", "REGRA_6") for c in codigos), (
            f"Subgrupo #{sg.numero_subgrupo} deve possuir REGRA_5 ou REGRA_6, recebido: {codigos}"
        )


@pytest.mark.asyncio
async def test_recalculo_continuo_e_nao_congelamento_subgrupo_5(service_e_repos):
    """Cenário 2: Ingestão sequencial não congela no 5º subgrupo e continua atualizando até o 20º."""
    service, carta_repo, _ = service_e_repos

    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    await carta_repo.salvar(carta)

    limites_historicos = []
    subgrupos_processados = []

    for amostra in DATA_20_SUBGRUPOS:
        sg = await service.executar(carta.id, amostra)
        subgrupos_processados.append(sg)
        limites_historicos.append(
            (carta.limites_atuais.lc, carta.limites_atuais.lsc, carta.limites_atuais.lic)
        )

    # No 5º subgrupo: LC era ~4.9530
    lc_5 = limites_historicos[4][0]
    assert pytest.approx(lc_5, abs=1e-3) == 4.9530

    # No 20º subgrupo: LC deve ter atualizado e NÃO permanecido congelado em 4.9530
    lc_20 = limites_historicos[19][0]
    assert pytest.approx(lc_20, abs=1e-3) in (
        pytest.approx(4.9612, abs=1e-3),
        pytest.approx(4.9607, abs=1e-3),
    )
    assert lc_20 != lc_5

    # Avaliação retroativa no subgrupo #002 verificada após o término de todos os 20 subgrupos
    sg2_final = subgrupos_processados[1]
    assert sg2_final.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1" for v in sg2_final.violacoes)


@pytest.mark.asyncio
async def test_modo_fixo_fase2_nao_altera_limites_nem_reavalia_historico(service_e_repos):
    """Cenário 3: No modo FIXO (Monitoramento / Fase 2), os limites não mudam e apenas o novo subgrupo é avaliado."""
    service, carta_repo, _ = service_e_repos

    limites_fixos = LimitesControle(
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
        limites_atuais=limites_fixos,
        modo_limites="FIXO",
    )
    await carta_repo.salvar(carta)

    # Subgrupo 1 (normal)
    sg1 = await service.executar(carta.id, [4.960, 4.961, 4.962, 4.959, 4.960])
    assert sg1.fora_de_controle is False
    assert carta.limites_atuais.lc == 4.9607
    assert carta.limites_atuais.lsc == 4.9733

    # Subgrupo 2 fora de controle (> LSC)
    sg2 = await service.executar(carta.id, [4.985, 4.982, 4.980, 4.984, 4.981])
    assert sg2.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1" for v in sg2.violacoes)

    # Limites permanecem rigorosamente idênticos
    assert carta.limites_atuais.lc == 4.9607
    assert carta.limites_atuais.lsc == 4.9733
    assert carta.limites_atuais.lic == 4.9480

    # Subgrupo 1 permaneceu sem violações
    assert sg1.fora_de_controle is False
