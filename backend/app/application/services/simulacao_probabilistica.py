from uuid import UUID

from app.domain.exceptions import CartaNaoEncontradaError, DadosInsuficientesError
from app.domain.interfaces.repositories import ICartaControleRepository
from app.domain.services.simulacao_binomial import CalculadorSimulacaoBinomial
from app.domain.value_objects.simulacao_binomial import (
    CriterioConformidade,
    EscopoAmostral,
    ResultadoSimulacaoBinomial,
    TipoArranjo,
)


class SimulacaoProbabilisticaService:
    """Caso de uso para execução de simulações probabilísticas binomiais sobre o processo da carta."""

    def __init__(self, carta_repository: ICartaControleRepository) -> None:
        self._carta_repo = carta_repository

    async def executar(
        self,
        carta_id: UUID | str,
        tipo_arranjo: TipoArranjo,
        criterio: CriterioConformidade,
        escopo: EscopoAmostral,
        tamanho_lote_x: int,
        sucessos_desejados_y: int,
        z_valor: float | None = None,
    ) -> ResultadoSimulacaoBinomial:
        """Executa a simulação binomial com base nos parâmetros da carta e nos critérios informados."""
        c_id = UUID(str(carta_id)) if not isinstance(carta_id, UUID) else carta_id
        carta = await self._carta_repo.obter_por_id(c_id)
        if carta is None:
            raise CartaNaoEncontradaError(carta_id=str(c_id))

        if carta.limites_atuais is None or carta.limites_atuais.sigma_estimado <= 0:
            raise DadosInsuficientesError(
                f"A carta '{carta.id}' não possui limites calculados ou dispersão válida para simulação."
            )

        return CalculadorSimulacaoBinomial.calcular(
            tipo_arranjo=tipo_arranjo,
            criterio=criterio,
            escopo=escopo,
            media_processo=carta.limites_atuais.lc,
            sigma_estimado=carta.limites_atuais.sigma_estimado,
            tamanho_subgrupo=carta.tamanho_subgrupo,
            tamanho_lote_x=tamanho_lote_x,
            sucessos_desejados_y=sucessos_desejados_y,
            z_valor=z_valor,
            limites_controle=carta.limites_atuais,
            especificacoes=carta.especificacoes,
        )
