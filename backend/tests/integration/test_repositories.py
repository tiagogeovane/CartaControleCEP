from uuid import uuid4

import pytest
from app.core.config import settings
from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.entities.subgrupo import Subgrupo
from app.domain.entities.usuario import Usuario
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.domain.value_objects.violacao import ViolacaoRegra
from app.infrastructure.persistence.repositories import (
    MySQLCartaControleRepository,
    MySQLProcessoRepository,
    MySQLSubgrupoRepository,
    MySQLUsuarioRepository,
)
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest.fixture
async def db_session():
    """Fixture que provê uma sessão assíncrona com rollback ou isolamento para os testes."""
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
async def test_processo_repository_crud(db_session: AsyncSession):
    repo = MySQLProcessoRepository(db_session)

    codigo = f"LINHA-{uuid4().hex[:6].upper()}"
    processo = Processo(
        nome="Linha de Usinagem CNC",
        codigo_linha=codigo,
        descricao="Monitoramento de tolerância dimensional",
    )

    # 1. Salvar
    salvo = await repo.salvar(processo)
    await db_session.commit()
    assert salvo.id == processo.id

    # 2. Obter por ID
    recuperado = await repo.obter_por_id(processo.id)
    assert recuperado is not None
    assert recuperado.nome == "Linha de Usinagem CNC"
    assert recuperado.codigo_linha == codigo
    assert recuperado.descricao == "Monitoramento de tolerância dimensional"

    # 3. Atualizar
    recuperado.descricao = "Descrição atualizada da linha"
    await repo.salvar(recuperado)
    await db_session.commit()

    atualizado = await repo.obter_por_id(processo.id)
    assert atualizado is not None
    assert atualizado.descricao == "Descrição atualizada da linha"

    # 4. Listar todos
    todos = await repo.listar_todos()
    assert any(p.id == processo.id for p in todos)


@pytest.mark.asyncio
async def test_usuario_repository_crud(db_session: AsyncSession):
    repo = MySQLUsuarioRepository(db_session)

    email = f"operador_{uuid4().hex[:6]}@industria.com"
    usuario = Usuario(
        nome="João da Silva",
        email=email,
        senha_hash="hash_bcrypt_super_seguro_xyz",
        perfil="OPERADOR",
    )

    # 1. Salvar
    await repo.salvar(usuario)
    await db_session.commit()

    # 2. Obter por ID e por Email
    por_id = await repo.obter_por_id(usuario.id)
    assert por_id is not None
    assert por_id.nome == "João da Silva"
    assert por_id.email == email

    por_email = await repo.obter_por_email(email)
    assert por_email is not None
    assert por_email.id == usuario.id

    # 3. Atualizar
    por_id.nome = "João S. Silva"
    await repo.salvar(por_id)
    await db_session.commit()

    atualizado = await repo.obter_por_id(usuario.id)
    assert atualizado is not None
    assert atualizado.nome == "João S. Silva"


@pytest.mark.asyncio
async def test_carta_controle_repository_crud(db_session: AsyncSession):
    processo_repo = MySQLProcessoRepository(db_session)
    carta_repo = MySQLCartaControleRepository(db_session)

    processo = Processo(nome="Pintura Eletrostática", codigo_linha=f"PNT-{uuid4().hex[:4]}")
    await processo_repo.salvar(processo)
    await db_session.commit()

    carta = CartaControle(
        processo_id=processo.id,
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        especificacoes=LimitesEspecificacao(lse=55.0, lie=45.0, valor_nominal=50.0),
        limites_atuais=LimitesControle(lc=50.0, lsc=53.0, lic=47.0, sigma_estimado=1.0),
        modo_limites="DINAMICO",
    )

    # 1. Salvar
    await carta_repo.salvar(carta)
    await db_session.commit()

    # 2. Obter por ID
    recuperada = await carta_repo.obter_por_id(carta.id)
    assert recuperada is not None
    assert recuperada.id == carta.id
    assert recuperada.processo_id == processo.id
    assert recuperada.tipo_carta == "X_R"
    assert recuperada.tamanho_subgrupo == 5
    assert recuperada.especificacoes is not None
    assert recuperada.especificacoes.lse == 55.0
    assert recuperada.especificacoes.lie == 45.0
    assert recuperada.limites_atuais is not None
    assert recuperada.limites_atuais.lc == 50.0
    assert recuperada.limites_atuais.lsc == 53.0
    assert recuperada.limites_atuais.lic == 47.0

    # 3. Atualizar Limites
    novos_limites = LimitesControle(lc=50.2, lsc=53.5, lic=46.9, sigma_estimado=1.1)
    await carta_repo.atualizar_limites(carta.id, novos_limites)
    await db_session.commit()

    atualizada = await carta_repo.obter_por_id(carta.id)
    assert atualizada is not None
    assert pytest.approx(atualizada.limites_atuais.lc, 0.01) == 50.2
    assert pytest.approx(atualizada.limites_atuais.lsc, 0.01) == 53.5
    assert pytest.approx(atualizada.limites_atuais.lic, 0.01) == 46.9

    # 4. Listar filtrando por processo
    cartas_processo = await carta_repo.listar_todas(processo_id=processo.id)
    assert len(cartas_processo) == 1
    assert cartas_processo[0].id == carta.id


@pytest.mark.asyncio
async def test_subgrupo_repository_salvar_e_listar(db_session: AsyncSession):
    processo_repo = MySQLProcessoRepository(db_session)
    carta_repo = MySQLCartaControleRepository(db_session)
    subgrupo_repo = MySQLSubgrupoRepository(db_session)

    # Setup processo e carta
    proc = Processo(nome="Extrusão de Perfis", codigo_linha=f"EXT-{uuid4().hex[:4]}")
    await processo_repo.salvar(proc)

    carta = CartaControle(processo_id=proc.id, tipo_carta="X_R", tamanho_subgrupo=3)
    await carta_repo.salvar(carta)
    await db_session.commit()

    # Cria Subgrupo com violação de Regra 1
    valores = [10.2, 10.5, 10.8]
    subgrupo = Subgrupo(
        carta_id=carta.id,
        numero_subgrupo=1,
        valores_brutos=valores,
        estatisticas=EstatisticasSubgrupo(
            media_x=10.5,
            amplitude_r=0.6,
            desvio_s=0.3,
            valores_brutos=tuple(valores),
        ),
        violacoes=[
            ViolacaoRegra(
                codigo_regra="REGRA_1",
                descricao="Ponto além de 3 sigma",
                numero_subgrupo=1,
                pontos_violadores=(1,),
            )
        ],
    )

    # 1. Salvar Subgrupo
    await subgrupo_repo.salvar(subgrupo)
    await db_session.commit()

    # 2. Listar por carta
    subgrupos = await subgrupo_repo.listar_por_carta(carta.id)
    assert len(subgrupos) == 1
    s = subgrupos[0]
    assert s.id == subgrupo.id
    assert s.numero_subgrupo == 1
    assert s.valores_brutos == valores
    assert pytest.approx(s.estatisticas.media_x, 0.01) == 10.5
    assert pytest.approx(s.estatisticas.amplitude_r, 0.01) == 0.6
    assert s.fora_de_controle is True
    assert len(s.violacoes) == 1
    assert s.violacoes[0].codigo_regra == "REGRA_1"
    assert s.violacoes[0].pontos_violadores == (1,)


@pytest.mark.asyncio
async def test_subgrupo_repository_salvar_em_lote_e_limite(db_session: AsyncSession):
    processo_repo = MySQLProcessoRepository(db_session)
    carta_repo = MySQLCartaControleRepository(db_session)
    subgrupo_repo = MySQLSubgrupoRepository(db_session)

    proc = Processo(nome="Estamparia Metálica", codigo_linha=f"EST-{uuid4().hex[:4]}")
    await processo_repo.salvar(proc)

    carta = CartaControle(processo_id=proc.id, tipo_carta="X_R", tamanho_subgrupo=2)
    await carta_repo.salvar(carta)
    await db_session.commit()

    # Gera 10 subgrupos
    subgrupos = []
    for i in range(1, 11):
        vals = [float(i), float(i) + 0.5]
        subgrupos.append(
            Subgrupo(
                carta_id=carta.id,
                numero_subgrupo=i,
                valores_brutos=vals,
                estatisticas=EstatisticasSubgrupo(
                    media_x=float(i) + 0.25,
                    amplitude_r=0.5,
                    desvio_s=0.35,
                    valores_brutos=tuple(vals),
                ),
            )
        )

    # Salva em lote
    await subgrupo_repo.salvar_em_lote(subgrupos)
    await db_session.commit()

    # 1. Recupera todos (limite=None)
    todos = await subgrupo_repo.listar_por_carta(carta.id)
    assert len(todos) == 10
    assert [s.numero_subgrupo for s in todos] == list(range(1, 11))

    # 2. Recupera com limite=4 (deve retornar os 4 últimos em ordem cronológica: 7, 8, 9, 10)
    ultimos_4 = await subgrupo_repo.listar_por_carta(carta.id, limite=4)
    assert len(ultimos_4) == 4
    assert [s.numero_subgrupo for s in ultimos_4] == [7, 8, 9, 10]

    # 3. Carrega a carta com o histórico completo através do CartaRepository
    carta_com_historico = await carta_repo.obter_por_id(carta.id)
    assert carta_com_historico is not None
    assert carta_com_historico.total_subgrupos == 10
    assert len(carta_com_historico.obter_historico_medias()) == 10
    assert carta_com_historico.obter_historico_medias()[0] == 1.25
    assert carta_com_historico.obter_historico_medias()[-1] == 10.25
