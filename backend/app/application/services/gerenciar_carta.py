from uuid import UUID

from app.domain.entities.carta import CartaControle
from app.domain.exceptions import CartaNaoEncontradaError, ProcessoNaoEncontradoError
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    IProcessoRepository,
)
from app.domain.strategies.factory import CartaStrategyFactory
from app.domain.value_objects.limites import LimitesEspecificacao
from app.infrastructure.real_time.connection_manager import ConnectionManager


class GerenciarCartaService:
    """Caso de uso para criação, configuração e consulta de Cartas de Controle no CEP."""

    def __init__(
        self,
        carta_repository: ICartaControleRepository,
        processo_repository: IProcessoRepository,
        connection_manager: ConnectionManager | None = None,
    ) -> None:
        self._carta_repo = carta_repository
        self._processo_repo = processo_repository
        self._connection_manager = connection_manager

    async def criar_carta(
        self,
        processo_id: UUID | str,
        tamanho_subgrupo: int,
        tipo_carta: str | None = None,
        especificacoes: LimitesEspecificacao | None = None,
        modo_limites: str = "DINAMICO",
    ) -> CartaControle:
        """Cria e persiste uma nova Carta de Controle vinculada a um processo industrial.

        Aplica a Regra de Negócio [RN01] caso o tipo de carta não seja informado explicitamente.
        """
        proc_id = UUID(str(processo_id)) if not isinstance(processo_id, UUID) else processo_id

        # 1. Valida existência do processo pai
        processo = await self._processo_repo.obter_por_id(proc_id)
        if processo is None:
            raise ProcessoNaoEncontradoError(processo_id=str(proc_id))

        # 2. Resolução do tipo de carta (Regra [RN01] ou validação pelo Registry)
        if not tipo_carta or not tipo_carta.strip():
            estrategia = CartaStrategyFactory.resolver_por_tamanho(tamanho_subgrupo)
            tipo_final = estrategia.tipo_carta
        else:
            # Valida compatibilidade e existência no registry
            estrategia = CartaStrategyFactory.fabricar(tipo_carta, tamanho_subgrupo)
            tipo_final = estrategia.tipo_carta

        # 3. Instanciação e persistência da entidade de domínio
        carta = CartaControle(
            processo_id=proc_id,
            tipo_carta=tipo_final,
            tamanho_subgrupo=tamanho_subgrupo,
            especificacoes=especificacoes,
            modo_limites=modo_limites.strip().upper(),
        )

        return await self._carta_repo.salvar(carta)

    async def obter_carta(self, carta_id: UUID | str) -> CartaControle:
        """Recupera a carta com histórico de subgrupos e limites calculados pelo ID."""
        c_id = UUID(str(carta_id)) if not isinstance(carta_id, UUID) else carta_id
        carta = await self._carta_repo.obter_por_id(c_id)
        if carta is None:
            raise CartaNaoEncontradaError(carta_id=str(c_id))
        return carta

    async def listar_cartas(self, processo_id: UUID | str | None = None) -> list[CartaControle]:
        """Lista as cartas de controle cadastradas, com filtro opcional por processo."""
        p_id = (
            UUID(str(processo_id))
            if processo_id is not None and not isinstance(processo_id, UUID)
            else processo_id
        )
        return await self._carta_repo.listar_todas(processo_id=p_id)

    async def atualizar_especificacoes(
        self,
        carta_id: UUID | str,
        especificacoes: LimitesEspecificacao,
    ) -> CartaControle:
        """Atualiza os limites de especificação de engenharia (LSE, LIE, Nominal) de uma carta."""
        carta = await self.obter_carta(carta_id)
        carta.especificacoes = especificacoes
        return await self._carta_repo.salvar(carta)

    async def alternar_modo_limites(
        self,
        carta_id: UUID | str,
        modo_limites: str,
    ) -> CartaControle:
        """Alterna o modo de cálculo de limites da carta ('DINAMICO' ou 'FIXO')."""
        modo = modo_limites.strip().upper()
        if modo not in ("DINAMICO", "FIXO"):
            raise ValueError(f"Modo de limites inválido: '{modo_limites}'. Permitidos: 'DINAMICO' ou 'FIXO'.")

        carta = await self.obter_carta(carta_id)
        carta.modo_limites = modo
        carta_salva = await self._carta_repo.salvar(carta)

        if self._connection_manager is not None:
            await self._connection_manager.broadcast(
                carta_id=str(carta.id),
                message={
                    "event": "MODO_LIMITES_ALTERADO",
                    "carta_id": str(carta.id),
                    "modo_limites": modo,
                },
            )

        return carta_salva
