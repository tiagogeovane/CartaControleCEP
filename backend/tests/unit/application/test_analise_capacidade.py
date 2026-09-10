from uuid import UUID, uuid4

import pytest
from app.application.services.analise_capacidade import AnaliseCapacidadeService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.exceptions import (
    CartaNaoEncontradaError,
    DadosInsuficientesError,
    EspecificacoesNaoDefinidasError,
)
from app.domain.interfaces.repositories import ICartaControleRepository
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
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


@pytest.fixture
def carta_repo():
    return InMemoryCartaRepository()


@pytest.fixture
def service(carta_repo):
    return AnaliseCapacidadeService(carta_repository=carta_repo)


def _criar_carta_com_subgrupos(n_subgrupos: int = 25) -> CartaControle:
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        especificacoes=LimitesEspecificacao(lse=26.0, lie=24.0, valor_nominal=25.0),
        limites_atuais=LimitesControle(lc=25.0, lsc=25.5, lic=24.5, sigma_estimado=0.2),
    )
    for i in range(1, n_subgrupos + 1):
        carta.adicionar_subgrupo(
            Subgrupo(
                carta_id=carta.id,
                numero_subgrupo=i,
                valores_brutos=[25.0, 25.1, 24.9, 25.0, 25.0],
                estatisticas=EstatisticasSubgrupo(
                    media_x=25.0,
                    amplitude_r=0.2,
                    desvio_s=0.08,
                    valores_brutos=(25.0, 25.1, 24.9, 25.0, 25.0),
                ),
            )
        )
    return carta


@pytest.mark.asyncio
async def test_calcular_indices_sucesso(service, carta_repo):
    carta = _criar_carta_com_subgrupos(25)
    await carta_repo.salvar(carta)

    indices = await service.calcular_indices(carta.id)

    # Tolerância = 26 - 24 = 2.0; 6 * sigma = 6 * 0.2 = 1.2 => Cp = 2.0 / 1.2 = 1.6667
    assert indices.cp == 1.6667
    assert indices.cpk == 1.6667
    assert indices.classificacao == "Capaz / Adequado"
    assert indices.esta_aprovado(1.33) is True


@pytest.mark.asyncio
async def test_calcular_indices_carta_nao_encontrada(service):
    invalido = uuid4()
    with pytest.raises(CartaNaoEncontradaError):
        await service.calcular_indices(invalido)


@pytest.mark.asyncio
async def test_calcular_indices_sem_especificacoes_lanca_erro(service, carta_repo):
    carta = _criar_carta_com_subgrupos(25)
    carta.especificacoes = None
    await carta_repo.salvar(carta)

    with pytest.raises(EspecificacoesNaoDefinidasError):
        await service.calcular_indices(carta.id)


@pytest.mark.asyncio
async def test_calcular_indices_sem_limites_calculados_lanca_erro(service, carta_repo):
    carta = _criar_carta_com_subgrupos(25)
    carta.limites_atuais = None
    await carta_repo.salvar(carta)

    with pytest.raises(DadosInsuficientesError):
        await service.calcular_indices(carta.id)


@pytest.mark.asyncio
async def test_calcular_indices_sem_subgrupos_lanca_erro(service, carta_repo):
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        especificacoes=LimitesEspecificacao(lse=26.0, lie=24.0),
        limites_atuais=LimitesControle(lc=25.0, lsc=25.5, lic=24.5, sigma_estimado=0.2),
    )
    await carta_repo.salvar(carta)

    with pytest.raises(DadosInsuficientesError):
        await service.calcular_indices(carta.id)


def test_calcular_para_carta_seguro(service):
    # Carta válida
    carta_valida = _criar_carta_com_subgrupos(5)
    ind = service.calcular_para_carta_seguro(carta_valida)
    assert ind is not None
    assert ind.cp == 1.6667

    # Carta sem especificações -> retorna None suavemente
    carta_sem_spec = _criar_carta_com_subgrupos(5)
    carta_sem_spec.especificacoes = None
    assert service.calcular_para_carta_seguro(carta_sem_spec) is None


@pytest.mark.asyncio
async def test_gerar_relatorio_robusto_e_preliminar(service, carta_repo):
    # Carta preliminar (< 20 subgrupos)
    carta_preliminar = _criar_carta_com_subgrupos(10)
    await carta_repo.salvar(carta_preliminar)

    rel_preliminar = await service.gerar_relatorio(carta_preliminar.id)
    assert rel_preliminar["amostra_estatisticamente_robusta"] is False
    assert "Amostra preliminar (10/20 subgrupos)" in rel_preliminar["aviso"]
    assert rel_preliminar["aprovado"] is True

    # Carta robusta (>= 20 subgrupos)
    carta_robusta = _criar_carta_com_subgrupos(25)
    await carta_repo.salvar(carta_robusta)

    rel_robusto = await service.gerar_relatorio(carta_robusta.id)
    assert rel_robusto["amostra_estatisticamente_robusta"] is True
    assert rel_robusto["aviso"] is None
    assert rel_robusto["indices"]["cp"] == 1.6667
