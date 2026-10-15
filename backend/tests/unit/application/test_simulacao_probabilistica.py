from uuid import UUID, uuid4

import pytest

from app.application.services.simulacao_probabilistica import SimulacaoProbabilisticaService
from app.domain.entities.carta import CartaControle
from app.domain.exceptions import CartaNaoEncontradaError, DadosInsuficientesError
from app.domain.interfaces.repositories import ICartaControleRepository
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.domain.value_objects.simulacao_binomial import (
    CriterioConformidade,
    EscopoAmostral,
    TipoArranjo,
)


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


@pytest.fixture
def repo():
    return InMemoryCartaRepository()


@pytest.fixture
def service(repo):
    return SimulacaoProbabilisticaService(carta_repository=repo)


@pytest.mark.asyncio
async def test_simulacao_probabilistica_service_sucesso(service, repo):
    """Executa simulação com sucesso a partir de uma carta existente no repositório."""
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        especificacoes=LimitesEspecificacao(lse=11.0, lie=9.0, valor_nominal=10.0),
        limites_atuais=LimitesControle(lc=10.0, lsc=10.6, lic=9.4, sigma_estimado=0.2),
    )
    await repo.salvar(carta)

    res = await service.executar(
        carta_id=carta.id,
        tipo_arranjo=TipoArranjo.CONSECUTIVO,
        criterio=CriterioConformidade.Z_SIGMAS,
        escopo=EscopoAmostral.INDIVIDUAL,
        tamanho_lote_x=5,
        sucessos_desejados_y=5,
        z_valor=2.50,
    )

    assert res.tipo_arranjo == TipoArranjo.CONSECUTIVO
    assert res.criterio == CriterioConformidade.Z_SIGMAS
    assert res.media_processo == 10.0
    assert res.sigma_usado == 0.2
    assert round(res.probabilidade_unitaria_p, 4) == 0.9876
    assert round(res.probabilidade_final, 4) == 0.9394
    assert len(res.distribuicao_completa) == 6


@pytest.mark.asyncio
async def test_simulacao_probabilistica_service_carta_inexistente(service):
    """Lança CartaNaoEncontradaError ao tentar simular com ID desconhecido."""
    with pytest.raises(CartaNaoEncontradaError):
        await service.executar(
            carta_id=uuid4(),
            tipo_arranjo=TipoArranjo.CONSECUTIVO,
            criterio=CriterioConformidade.Z_SIGMAS,
            escopo=EscopoAmostral.INDIVIDUAL,
            tamanho_lote_x=5,
            sucessos_desejados_y=5,
            z_valor=2.50,
        )


@pytest.mark.asyncio
async def test_simulacao_probabilistica_service_sem_limites(service, repo):
    """Lança DadosInsuficientesError caso a carta não possua limites calculados."""
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        limites_atuais=None,
    )
    await repo.salvar(carta)

    with pytest.raises(DadosInsuficientesError):
        await service.executar(
            carta_id=carta.id,
            tipo_arranjo=TipoArranjo.CONSECUTIVO,
            criterio=CriterioConformidade.Z_SIGMAS,
            escopo=EscopoAmostral.INDIVIDUAL,
            tamanho_lote_x=5,
            sucessos_desejados_y=5,
            z_valor=2.50,
        )
