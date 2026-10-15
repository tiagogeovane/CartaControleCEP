from uuid import UUID, uuid4

import pytest
from app.application.services.gerenciar_carta import GerenciarCartaService
from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.exceptions import CartaNaoEncontradaError, ProcessoNaoEncontradoError
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    IProcessoRepository,
)
from app.domain.value_objects.limites import LimitesEspecificacao


class InMemoryCartaRepository(ICartaControleRepository):
    def __init__(self) -> None:
        self.cartas: dict[UUID, CartaControle] = {}

    async def obter_por_id(self, carta_id: UUID) -> CartaControle | None:
        return self.cartas.get(carta_id)

    async def salvar(self, carta: CartaControle) -> CartaControle:
        self.cartas[carta.id] = carta
        return carta

    async def listar_todas(self, processo_id: UUID | None = None) -> list[CartaControle]:
        if processo_id is not None:
            return [c for c in self.cartas.values() if c.processo_id == processo_id]
        return list(self.cartas.values())

    async def atualizar_limites(self, carta_id: UUID, novos_limites) -> None:
        if carta_id in self.cartas:
            self.cartas[carta_id].atualizar_limites(novos_limites)


class InMemoryProcessoRepository(IProcessoRepository):
    def __init__(self) -> None:
        self.processos: dict[UUID, Processo] = {}

    async def obter_por_id(self, processo_id: UUID) -> Processo | None:
        return self.processos.get(processo_id)

    async def salvar(self, processo: Processo) -> Processo:
        self.processos[processo.id] = processo
        return processo

    async def listar_todos(self) -> list[Processo]:
        return list(self.processos.values())


@pytest.fixture
def repos():
    carta_repo = InMemoryCartaRepository()
    proc_repo = InMemoryProcessoRepository()
    return carta_repo, proc_repo


@pytest.fixture
def service(repos):
    carta_repo, proc_repo = repos
    return GerenciarCartaService(carta_repository=carta_repo, processo_repository=proc_repo)


@pytest.mark.asyncio
async def test_criar_carta_com_sucesso(service, repos):
    carta_repo, proc_repo = repos
    processo = Processo(nome="Linha A", codigo_linha="LINHA-01")
    await proc_repo.salvar(processo)

    specs = LimitesEspecificacao(lse=26.0, lie=24.0, valor_nominal=25.0)
    carta = await service.criar_carta(
        processo_id=processo.id,
        tamanho_subgrupo=5,
        tipo_carta="X_R",
        especificacoes=specs,
    )

    assert carta.id is not None
    assert carta.processo_id == processo.id
    assert carta.tipo_carta == "X_R"
    assert carta.tamanho_subgrupo == 5
    assert carta.especificacoes == specs
    assert carta.modo_limites == "DINAMICO"

    # Confere no repositório
    salva = await carta_repo.obter_por_id(carta.id)
    assert salva == carta


@pytest.mark.asyncio
async def test_criar_carta_selecao_automatica_rn01(service, repos):
    _, proc_repo = repos
    processo = Processo(nome="Linha B", codigo_linha="LINHA-02")
    await proc_repo.salvar(processo)

    # n = 1 -> I_MR
    carta_imr = await service.criar_carta(processo_id=processo.id, tamanho_subgrupo=1)
    assert carta_imr.tipo_carta == "I_MR"

    # 2 <= n <= 10 -> X_R
    carta_xr = await service.criar_carta(processo_id=processo.id, tamanho_subgrupo=5)
    assert carta_xr.tipo_carta == "X_R"

    # n > 10 -> X_S
    carta_xs = await service.criar_carta(processo_id=processo.id, tamanho_subgrupo=15)
    assert carta_xs.tipo_carta == "X_S"


@pytest.mark.asyncio
async def test_criar_carta_processo_inexistente_lanca_erro(service):
    proc_id = uuid4()
    with pytest.raises(ProcessoNaoEncontradoError) as exc_info:
        await service.criar_carta(processo_id=proc_id, tamanho_subgrupo=5)

    assert str(proc_id) in str(exc_info.value)


@pytest.mark.asyncio
async def test_obter_carta_sucesso_e_nao_encontrada(service, repos):
    _, proc_repo = repos
    processo = Processo(nome="Linha C", codigo_linha="LINHA-03")
    await proc_repo.salvar(processo)

    carta = await service.criar_carta(processo_id=processo.id, tamanho_subgrupo=4)
    res = await service.obter_carta(carta.id)
    assert res.id == carta.id

    id_invalido = uuid4()
    with pytest.raises(CartaNaoEncontradaError) as exc:
        await service.obter_carta(id_invalido)
    assert str(id_invalido) in str(exc.value)


@pytest.mark.asyncio
async def test_listar_cartas_com_e_sem_filtro(service, repos):
    _, proc_repo = repos
    p1 = Processo(nome="P1", codigo_linha="L1")
    p2 = Processo(nome="P2", codigo_linha="L2")
    await proc_repo.salvar(p1)
    await proc_repo.salvar(p2)

    await service.criar_carta(processo_id=p1.id, tamanho_subgrupo=5)
    await service.criar_carta(processo_id=p1.id, tamanho_subgrupo=3)
    await service.criar_carta(processo_id=p2.id, tamanho_subgrupo=4)

    todas = await service.listar_cartas()
    assert len(todas) == 3

    do_p1 = await service.listar_cartas(processo_id=p1.id)
    assert len(do_p1) == 2
    assert all(c.processo_id == p1.id for c in do_p1)

    do_p2 = await service.listar_cartas(processo_id=p2.id)
    assert len(do_p2) == 1
    assert do_p2[0].processo_id == p2.id


@pytest.mark.asyncio
async def test_atualizar_especificacoes_e_modo_limites(service, repos):
    _, proc_repo = repos
    processo = Processo(nome="P3", codigo_linha="L3")
    await proc_repo.salvar(processo)

    carta = await service.criar_carta(processo_id=processo.id, tamanho_subgrupo=5)
    assert carta.especificacoes is None

    novas_specs = LimitesEspecificacao(lse=50.0, lie=40.0, valor_nominal=45.0)
    atualizada = await service.atualizar_especificacoes(carta.id, novas_specs)
    assert atualizada.especificacoes == novas_specs

    # Alternar modo
    atualizada_modo = await service.alternar_modo_limites(carta.id, "FIXO")
    assert atualizada_modo.modo_limites == "FIXO"

    with pytest.raises(ValueError):
        await service.alternar_modo_limites(carta.id, "MODO_INVALIDO")


@pytest.mark.asyncio
async def test_alternar_modo_limites_dispara_broadcast_websocket(repos):
    carta_repo, proc_repo = repos
    from unittest.mock import AsyncMock
    mock_manager = AsyncMock()

    service_com_ws = GerenciarCartaService(
        carta_repository=carta_repo,
        processo_repository=proc_repo,
        connection_manager=mock_manager,
    )

    processo = Processo(nome="P_WS", codigo_linha="L_WS")
    await proc_repo.salvar(processo)
    carta = await service_com_ws.criar_carta(processo_id=processo.id, tamanho_subgrupo=5)

    await service_com_ws.alternar_modo_limites(carta.id, "FIXO")

    mock_manager.broadcast.assert_awaited_once_with(
        carta_id=str(carta.id),
        message={
            "event": "MODO_LIMITES_ALTERADO",
            "carta_id": str(carta.id),
            "modo_limites": "FIXO",
        },
    )

