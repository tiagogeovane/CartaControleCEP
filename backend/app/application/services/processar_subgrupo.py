from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from app.application.services.analise_capacidade import AnaliseCapacidadeService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.exceptions import AmostraInvalidaError, CartaNaoEncontradaError
from app.domain.interfaces.observers import ISubgrupoObserver
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    ISubgrupoRepository,
)
from app.domain.rules.detector import DetectorRegrasNelson
from app.domain.strategies.base import ICartaControleStrategy
from app.domain.strategies.factory import CartaStrategyFactory
from app.domain.strategies.imr_chart import CartaIMRStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo


class ProcessamentoSubgrupoService:
    """Orquestrador principal (Use Case) do fluxo de recebimento, cálculo estatístico,

    avaliação de anomalias (Regras de Nelson), persistência e notificação em tempo real.
    """

    def __init__(
        self,
        carta_repository: ICartaControleRepository,
        subgrupo_repository: ISubgrupoRepository,
        detector_anomalias: DetectorRegrasNelson | None = None,
        observers: list[ISubgrupoObserver] | None = None,
        analise_capacidade_service: AnaliseCapacidadeService | None = None,
    ) -> None:
        self._carta_repo = carta_repository
        self._subgrupo_repo = subgrupo_repository
        self._detector = detector_anomalias or DetectorRegrasNelson()
        self._observers: list[ISubgrupoObserver] = list(observers) if observers is not None else []
        self._capacidade_service = analise_capacidade_service or AnaliseCapacidadeService(carta_repository)

    def adicionar_observer(self, observer: ISubgrupoObserver) -> None:
        """Registra um ouvinte para receber eventos de novos subgrupos processados (ex: WebSocket)."""
        if observer not in self._observers:
            self._observers.append(observer)

    def remover_observer(self, observer: ISubgrupoObserver) -> bool:
        """Remove um ouvinte previamente cadastrado."""
        if observer in self._observers:
            self._observers.remove(observer)
            return True
        return False

    async def executar(
        self,
        carta_id: UUID | str,
        amostras_valores: Sequence[float],
        timestamp: datetime | None = None,
        numero_subgrupo: int | None = None,
        goal: str | None = None,
        modo_limites: str | None = None,
    ) -> Subgrupo:
        """Executa o pipeline completo de ingestão e processamento estatístico de um subgrupo.

        Fluxo:
        1. Carrega e valida a existência da CartaControle.
        2. Gerencia a transição de modo de limites (FIXO para acompanhamento, DINÂMICO para calibração).
        3. Valida o tamanho nominal do subgrupo [RN02].
        4. Resolve a estratégia de controle estatístico (Strategy Pattern / Factory).
        5. Calcula estatísticas pontuais (média, amplitude, desvio padrão).
        6. Recalcula limites de controle globais se configurado em modo DINÂMICO.
        7. Avalia violações das 8 Regras de Nelson sobre a série temporal.
        8. Constrói e persiste a entidade Subgrupo com garantia transacional ACID.
        9. Notifica reativamente os ouvintes registrados via Observer Pattern.
        """
        c_id = UUID(str(carta_id)) if not isinstance(carta_id, UUID) else carta_id

        # 1. Carregamento da Carta de Controle
        carta = await self._carta_repo.obter_por_id(c_id)
        if carta is None:
            raise CartaNaoEncontradaError(carta_id=str(c_id))

        # Transição de Modo de Limites baseada no Goal ou modo explícito
        modo_alterado = False
        goal_lower = (goal or "").strip().lower()
        modo_desejado = (modo_limites or "").strip().upper()

        if "acompanh" in goal_lower or "monitor" in goal_lower or modo_desejado == "FIXO":
            if carta.modo_limites != "FIXO":
                carta.modo_limites = "FIXO"
                modo_alterado = True
        elif "calibr" in goal_lower or modo_desejado == "DINAMICO":
            if carta.modo_limites != "DINAMICO":
                carta.modo_limites = "DINAMICO"
                modo_alterado = True

        # 2. Validação do tamanho amostral [RN02]
        try:
            carta.validar_amostra(amostras_valores)
        except ValueError as e:
            raise AmostraInvalidaError(str(e)) from e

        # 3. Resolução da estratégia estatística
        strategy = CartaStrategyFactory.fabricar(carta.tipo_carta, carta.tamanho_subgrupo)

        # 4. Cálculo de estatísticas pontuais
        estatisticas = strategy.calcular_estatisticas(amostras_valores)

        # 5. Validação e determinação do número sequencial do subgrupo
        if numero_subgrupo is not None:
            if any(s.numero_subgrupo == numero_subgrupo for s in carta.subgrupos):
                raise AmostraInvalidaError(
                    f"Subgrupo #{numero_subgrupo} já existe para a carta de controle '{carta.id}'. "
                    f"O identificador sequencial do subgrupo deve ser único."
                )

        num_subgrupo = (
            numero_subgrupo if numero_subgrupo is not None else carta.total_subgrupos + 1
        )

        subgrupo = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=num_subgrupo,
            valores_brutos=list(amostras_valores),
            estatisticas=estatisticas,
            timestamp=timestamp or datetime.now(timezone.utc),
            fora_de_controle=False,
            violacoes=[],
        )

        subgrupos_anteriores = list(carta.subgrupos)
        carta.adicionar_subgrupo(subgrupo)

        # 6. Atualização de limites e avaliação das Regras de Nelson
        limites_recalculados = False
        if carta.modo_limites == "DINAMICO" or carta.limites_atuais is None:
            medias_atualizadas = carta.obter_historico_medias()
            dispersoes_atualizadas = carta.obter_historico_dispersoes()
            try:
                novos_limites = strategy.calcular_limites(
                    historico_medias=medias_atualizadas,
                    historico_dispersoes=dispersoes_atualizadas,
                    n=carta.tamanho_subgrupo,
                )
                carta.atualizar_limites(novos_limites)
                limites_recalculados = True
            except ValueError:
                # Ocorre quando histórico insuficiente (ex: 1º ponto em I-MR)
                pass

        if (carta.modo_limites == "DINAMICO" or limites_recalculados) and carta.limites_atuais is not None:
            # Fase 1 / Modo Dinâmico: Reavaliação retroativa de todos os subgrupos
            carta.reavaliar_historico_completo(self._detector)
        elif carta.limites_atuais is not None:
            # Modo FIXO: Avalia apenas o novo subgrupo incrementalmente
            medias_atualizadas = carta.obter_historico_medias()
            dispersoes_atualizadas = carta.obter_historico_dispersoes()
            violacoes = self._detector.avaliar(
                historico_medias=medias_atualizadas,
                limites=carta.limites_atuais,
                historico_dispersoes=dispersoes_atualizadas,
                numero_subgrupo=num_subgrupo,
            )
            subgrupo.definir_violacoes(violacoes)

        # 7. Persistência
        if (carta.modo_limites == "DINAMICO" or limites_recalculados) and subgrupos_anteriores:
            await self._subgrupo_repo.atualizar_violacoes_em_lote(subgrupos_anteriores)

        await self._subgrupo_repo.salvar(subgrupo)

        if limites_recalculados or modo_alterado:
            await self._carta_repo.salvar(carta)

        # 8. Notificação reativa via Observer
        await self._notificar_observers(carta, subgrupo)

        return subgrupo

    async def executar_lote(
        self,
        carta_id: UUID | str,
        lote_amostras: Sequence[Sequence[float]],
        goal: str | None = None,
        modo_limites: str | None = None,
    ) -> list[Subgrupo]:
        """Processa uma série de subgrupos em lote (ex: carga histórica via CSV/JSON [RF08])."""
        c_id = UUID(str(carta_id)) if not isinstance(carta_id, UUID) else carta_id
        carta = await self._carta_repo.obter_por_id(c_id)
        if carta is None:
            raise CartaNaoEncontradaError(carta_id=str(c_id))

        # Transição de Modo de Limites baseada no Goal ou modo explícito
        modo_alterado = False
        goal_lower = (goal or "").strip().lower()
        modo_desejado = (modo_limites or "").strip().upper()

        if "acompanh" in goal_lower or "monitor" in goal_lower or modo_desejado == "FIXO":
            if carta.modo_limites != "FIXO":
                carta.modo_limites = "FIXO"
                modo_alterado = True
        elif "calibr" in goal_lower or modo_desejado == "DINAMICO":
            if carta.modo_limites != "DINAMICO":
                carta.modo_limites = "DINAMICO"
                modo_alterado = True

        strategy = CartaStrategyFactory.fabricar(carta.tipo_carta, carta.tamanho_subgrupo)
        subgrupos_anteriores = list(carta.subgrupos)
        novos_subgrupos: list[Subgrupo] = []

        for amostra in lote_amostras:
            try:
                carta.validar_amostra(amostra)
            except ValueError as e:
                raise AmostraInvalidaError(str(e)) from e

            estatisticas = strategy.calcular_estatisticas(amostra)
            num_subgrupo = carta.total_subgrupos + 1
            subgrupo = Subgrupo(
                carta_id=carta.id,
                numero_subgrupo=num_subgrupo,
                valores_brutos=list(amostra),
                estatisticas=estatisticas,
                timestamp=datetime.now(timezone.utc),
                fora_de_controle=False,
                violacoes=[],
            )
            carta.adicionar_subgrupo(subgrupo)
            novos_subgrupos.append(subgrupo)

        limites_recalculados = False
        if carta.modo_limites == "DINAMICO" or carta.limites_atuais is None:
            medias_atualizadas = carta.obter_historico_medias()
            dispersoes_atualizadas = carta.obter_historico_dispersoes()
            try:
                novos_limites = strategy.calcular_limites(
                    historico_medias=medias_atualizadas,
                    historico_dispersoes=dispersoes_atualizadas,
                    n=carta.tamanho_subgrupo,
                )
                carta.atualizar_limites(novos_limites)
                limites_recalculados = True
            except ValueError:
                pass

        if (carta.modo_limites == "DINAMICO" or limites_recalculados) and carta.limites_atuais is not None:
            carta.reavaliar_historico_completo(self._detector)
        elif carta.limites_atuais is not None:
            # Modo FIXO: avalia cada novo subgrupo incrementalmente
            medias_todas = carta.obter_historico_medias()
            dispersoes_todas = carta.obter_historico_dispersoes()
            qtd_anteriores = len(subgrupos_anteriores)
            for idx_novo, sub in enumerate(novos_subgrupos):
                idx_total = qtd_anteriores + idx_novo
                medias_ate_ponto = medias_todas[: idx_total + 1]
                dispersoes_ate_ponto = dispersoes_todas[: idx_total + 1]
                violacoes = self._detector.avaliar(
                    historico_medias=medias_ate_ponto,
                    limites=carta.limites_atuais,
                    historico_dispersoes=dispersoes_ate_ponto,
                    numero_subgrupo=sub.numero_subgrupo,
                )
                sub.definir_violacoes(violacoes)

        # Persistência atômica
        if (carta.modo_limites == "DINAMICO" or limites_recalculados) and subgrupos_anteriores:
            await self._subgrupo_repo.atualizar_violacoes_em_lote(subgrupos_anteriores)

        await self._subgrupo_repo.salvar_em_lote(novos_subgrupos)

        if limites_recalculados or modo_alterado:
            await self._carta_repo.salvar(carta)

        # Notifica ouvintes com o estado final
        if novos_subgrupos:
            await self._notificar_observers(carta, novos_subgrupos[-1])

        return novos_subgrupos

    def _construir_historico_dispersoes(
        self,
        carta: CartaControle,
        strategy: ICartaControleStrategy,
        estatisticas: EstatisticasSubgrupo,
        medias_atualizadas: list[float],
    ) -> list[float]:
        """Determina a série de dispersões correta conforme a estratégia de controle em uso."""
        tipo = carta.tipo_carta.upper()
        if "I_MR" in tipo or "IMR" in tipo or (carta.tamanho_subgrupo == 1):
            if isinstance(strategy, CartaIMRStrategy):
                return strategy.calcular_amplitudes_moveis(medias_atualizadas)
            if len(medias_atualizadas) >= 2:
                return [
                    abs(medias_atualizadas[i] - medias_atualizadas[i - 1])
                    for i in range(1, len(medias_atualizadas))
                ]
            return []

        if "X_S" in tipo or "XS" in tipo or (carta.tamanho_subgrupo > 10 and "X_R" in tipo):
            return carta.obter_historico_dispersoes() + [estatisticas.desvio_s]

        return carta.obter_historico_dispersoes() + [estatisticas.amplitude_r]

    async def _notificar_observers(self, carta: CartaControle, subgrupo: Subgrupo) -> None:
        """Dispara a notificação de processamento para todos os observers registrados."""
        for observer in self._observers:
            await observer.notificar_processamento(carta, subgrupo)
