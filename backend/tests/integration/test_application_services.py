from uuid import uuid4

import pytest
from app.application.events.subgrupo_events import SubgrupoProcessadoEvent
from app.application.services.analise_capacidade import AnaliseCapacidadeService
from app.application.services.gerenciar_carta import GerenciarCartaService
from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.core.config import settings
from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.observers import ISubgrupoObserver
from app.domain.value_objects.limites import LimitesEspecificacao
from app.infrastructure.persistence.repositories import (
    MySQLCartaControleRepository,
    MySQLProcessoRepository,
    MySQLSubgrupoRepository,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


class NotificationCaptureObserver(ISubgrupoObserver):
    """Observer espião para testar o despacho de eventos no pipeline assíncrono."""

    def __init__(self) -> None:
        self.eventos: list[SubgrupoProcessadoEvent] = []

    async def notificar_processamento(self, carta: CartaControle, subgrupo: Subgrupo) -> None:
        # Cria o evento de domínio pronto para WebSocket
        evento = SubgrupoProcessadoEvent.from_domain(carta, subgrupo)
        self.eventos.append(evento)


@pytest.fixture
async def db_session():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_fluxo_completo_servicos_com_mysql(db_session: AsyncSession):
    """Teste de integração ponta a ponta:

    1. Cadastra Processo via Repositório.
    2. Cria Carta de Controle via GerenciarCartaService.
    3. Ingestiona subgrupos sequenciais via ProcessamentoSubgrupoService:
       - Recálculo dinâmico de limites gravado no MySQL.
       - Detecção e gravação de anomalias (Regras de Nelson).
       - Despacho de eventos para Observer.
    4. Analisa Capacidade do Processo via AnaliseCapacidadeService.
    5. Carga de dados históricos em lote via executar_lote.
    """
    proc_repo = MySQLProcessoRepository(db_session)
    carta_repo = MySQLCartaControleRepository(db_session)
    subgrupo_repo = MySQLSubgrupoRepository(db_session)

    # 1. Criação do Processo no banco
    cod_linha = f"INTEG-{uuid4().hex[:6].upper()}"
    processo = Processo(nome="Linha Montagem Motores", codigo_linha=cod_linha)
    await proc_repo.salvar(processo)
    await db_session.commit()

    # 2. GerenciarCartaService
    gerenciar_service = GerenciarCartaService(
        carta_repository=carta_repo,
        processo_repository=proc_repo,
    )
    specs = LimitesEspecificacao(lse=52.0, lie=48.0, valor_nominal=50.0)
    carta = await gerenciar_service.criar_carta(
        processo_id=processo.id,
        tamanho_subgrupo=5,
        tipo_carta="X_R",
        especificacoes=specs,
        modo_limites="DINAMICO",
    )
    await db_session.commit()
    assert carta.id is not None

    # 3. ProcessamentoSubgrupoService com Observer
    observer = NotificationCaptureObserver()
    proc_service = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        observers=[observer],
    )

    # Ingestão de 3 subgrupos sob controle (~50.0)
    amostras = [
        [50.1, 49.9, 50.0, 50.2, 49.8],
        [49.8, 50.3, 50.1, 49.9, 50.0],
        [50.0, 50.1, 49.9, 50.2, 49.8],
    ]

    for i, amostra in enumerate(amostras, start=1):
        sub = await proc_service.executar(carta.id, amostra)
        await db_session.commit()
        assert sub.numero_subgrupo == i
        assert sub.fora_de_controle is False

    assert len(observer.eventos) == 3

    # Ingestão de subgrupo discrepante (fora de controle)
    sub_anomalo = await proc_service.executar(carta.id, [65.0, 64.8, 65.2, 65.1, 64.9])
    await db_session.commit()

    assert sub_anomalo.numero_subgrupo == 4
    assert sub_anomalo.fora_de_controle is True
    assert any(v.codigo_regra == "REGRA_1" for v in sub_anomalo.violacoes)
    assert len(observer.eventos) == 4

    # Validação do evento gerado para WebSocket
    ultimo_evento_dict = observer.eventos[-1].to_dict()
    assert ultimo_evento_dict["event"] == "NOVO_SUBGRUPO_PROCESSADO"
    assert ultimo_evento_dict["status_controle"]["fora_de_controle"] is True
    assert ultimo_evento_dict["limites"]["lc"] is not None

    # 4. Análise de Capacidade
    capacidade_service = AnaliseCapacidadeService(carta_repository=carta_repo)
    relatorio = await capacidade_service.gerar_relatorio(carta.id)

    assert relatorio["carta_id"] == str(carta.id)
    assert relatorio["total_subgrupos"] == 4
    assert relatorio["amostra_estatisticamente_robusta"] is False  # 4 < 20
    assert "indices" in relatorio
    assert relatorio["indices"]["cp"] is not None

    # 5. Importação em lote (executar_lote)
    lote_novos = [
        [50.0, 50.1, 49.9, 50.2, 49.8],
        [50.2, 49.8, 50.1, 50.0, 49.9],
    ]
    subgrupos_lote = await proc_service.executar_lote(carta.id, lote_novos)
    await db_session.commit()

    assert len(subgrupos_lote) == 2
    assert subgrupos_lote[0].numero_subgrupo == 5
    assert subgrupos_lote[1].numero_subgrupo == 6

    # Consulta da carta atualizada no repositório
    carta_atualizada = await carta_repo.obter_por_id(carta.id)
    assert carta_atualizada is not None
    assert carta_atualizada.total_subgrupos == 6
