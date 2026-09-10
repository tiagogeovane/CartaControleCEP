from uuid import UUID

from app.domain.entities.carta import CartaControle
from app.domain.exceptions import (
    CartaNaoEncontradaError,
    DadosInsuficientesError,
    EspecificacoesNaoDefinidasError,
)
from app.domain.interfaces.repositories import ICartaControleRepository
from app.domain.services.capacidade import CalculadorCapacidade
from app.domain.value_objects.capacidade import IndicesCapacidade


class AnaliseCapacidadeService:
    """Caso de uso para cálculo e relatório dos índices de capacidade do processo (Cp, Cpk, Cpl, Cpu)."""

    def __init__(self, carta_repository: ICartaControleRepository) -> None:
        self._carta_repo = carta_repository

    async def calcular_indices(self, carta_id: UUID | str) -> IndicesCapacidade:
        """Calcula os índices de capacidade Cp e Cpk com base nas tolerâncias e na dispersão do processo.

        Garante estritamente a conformidade com a Regra de Negócio [RN04].
        """
        c_id = UUID(str(carta_id)) if not isinstance(carta_id, UUID) else carta_id
        carta = await self._carta_repo.obter_por_id(c_id)
        if carta is None:
            raise CartaNaoEncontradaError(carta_id=str(c_id))

        return self.calcular_para_carta_estrito(carta)

    def calcular_para_carta_estrito(self, carta: CartaControle) -> IndicesCapacidade:
        """Executa o cálculo de capacidade exigindo todos os requisitos da Regra [RN04]."""
        # 1. Validação de limites de especificação
        if (
            carta.especificacoes is None
            or (carta.especificacoes.lse is None and carta.especificacoes.lie is None)
        ):
            raise EspecificacoesNaoDefinidasError(
                f"A carta '{carta.id}' não possui limites de especificação (LSE e/ou LIE) definidos para cálculo de capacidade."
            )

        # 2. Validação de dispersão e limites de controle
        if carta.limites_atuais is None or carta.limites_atuais.sigma_estimado <= 0:
            raise DadosInsuficientesError(
                f"A carta '{carta.id}' não possui limites calculados ou dispersão (sigma) válida para cálculo de capacidade."
            )

        # 3. Validação de histórico mínimo
        if carta.total_subgrupos < 1:
            raise DadosInsuficientesError(
                f"A carta '{carta.id}' não possui histórico de subgrupos registrado para análise de capacidade."
            )

        media_processo = carta.limites_atuais.lc
        sigma_estimado = carta.limites_atuais.sigma_estimado

        return CalculadorCapacidade.calcular(
            media_processo=media_processo,
            sigma_estimado=sigma_estimado,
            especificacoes=carta.especificacoes,
        )

    def calcular_para_carta_seguro(self, carta: CartaControle) -> IndicesCapacidade | None:
        """Calcula índices de capacidade de forma segura e não-bloqueante (retorna None se não for viável).

        Utilizado internamente pelo despachante de eventos e tempo real quando especificações são opcionais.
        """
        try:
            return self.calcular_para_carta_estrito(carta)
        except (EspecificacoesNaoDefinidasError, DadosInsuficientesError, ValueError):
            return None

    async def gerar_relatorio(
        self,
        carta_id: UUID | str,
        criterio_aprovacao: float = 1.33,
    ) -> dict:
        """Gera relatório completo de capacidade com avaliação de conformidade e recomendações estatísticas."""
        c_id = UUID(str(carta_id)) if not isinstance(carta_id, UUID) else carta_id
        carta = await self._carta_repo.obter_por_id(c_id)
        if carta is None:
            raise CartaNaoEncontradaError(carta_id=str(c_id))

        indices = self.calcular_para_carta_estrito(carta)
        amostra_robusta = carta.total_subgrupos >= 20
        aviso = (
            None
            if amostra_robusta
            else f"Amostra preliminar ({carta.total_subgrupos}/20 subgrupos). "
            f"Recomenda-se coletar no mínimo 20 subgrupos para estimativa estável conforme norma CEP [RN04]."
        )

        assert carta.especificacoes is not None
        assert carta.limites_atuais is not None

        return {
            "carta_id": str(carta.id),
            "processo_id": str(carta.processo_id),
            "tipo_carta": carta.tipo_carta,
            "tamanho_subgrupo": carta.tamanho_subgrupo,
            "total_subgrupos": carta.total_subgrupos,
            "amostra_estatisticamente_robusta": amostra_robusta,
            "aviso": aviso,
            "media_processo": round(carta.limites_atuais.lc, 4),
            "sigma_estimado": round(carta.limites_atuais.sigma_estimado, 4),
            "especificacoes": {
                "lse": carta.especificacoes.lse,
                "lie": carta.especificacoes.lie,
                "valor_nominal": carta.especificacoes.valor_nominal,
            },
            "limites_controle": {
                "lsc": round(carta.limites_atuais.lsc, 4),
                "lc": round(carta.limites_atuais.lc, 4),
                "lic": round(carta.limites_atuais.lic, 4),
            },
            "indices": {
                "cp": indices.cp,
                "cpk": indices.cpk,
                "cpu": indices.cpu,
                "cpl": indices.cpl,
            },
            "aprovado": indices.esta_aprovado(criterio=criterio_aprovacao),
            "criterio_aprovacao": criterio_aprovacao,
            "classificacao": indices.classificacao,
        }
