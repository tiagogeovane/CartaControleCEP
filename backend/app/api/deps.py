from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.analise_capacidade import AnaliseCapacidadeService
from app.application.services.gerenciar_carta import GerenciarCartaService
from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.core.config import settings
from app.core.database import get_db_session
from app.core.security import decodificar_token
from app.domain.entities.usuario import Usuario
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    IProcessoRepository,
    ISubgrupoRepository,
    IUsuarioRepository,
)
from app.infrastructure.persistence.repositories import (
    MySQLCartaControleRepository,
    MySQLProcessoRepository,
    MySQLSubgrupoRepository,
    MySQLUsuarioRepository,
)
from app.infrastructure.real_time.connection_manager import (
    ConnectionManager,
    get_connection_manager,
)
from app.infrastructure.real_time.websocket_observer import (
    WebSocketNotificationObserver,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Injeta a sessão de banco de dados assíncrona."""
    async for session in get_db_session():
        yield session


# Injeção de Repositórios
async def get_usuario_repository(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> IUsuarioRepository:
    return MySQLUsuarioRepository(session)


async def get_processo_repository(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> IProcessoRepository:
    return MySQLProcessoRepository(session)


async def get_carta_repository(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ICartaControleRepository:
    return MySQLCartaControleRepository(session)


async def get_subgrupo_repository(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ISubgrupoRepository:
    return MySQLSubgrupoRepository(session)


# Injeção de Serviços de Aplicação
async def get_gerenciar_carta_service(
    carta_repo: Annotated[ICartaControleRepository, Depends(get_carta_repository)],
    processo_repo: Annotated[IProcessoRepository, Depends(get_processo_repository)],
) -> GerenciarCartaService:
    return GerenciarCartaService(
        carta_repository=carta_repo,
        processo_repository=processo_repo,
    )


async def get_analise_capacidade_service(
    carta_repo: Annotated[ICartaControleRepository, Depends(get_carta_repository)],
) -> AnaliseCapacidadeService:
    return AnaliseCapacidadeService(carta_repository=carta_repo)


async def get_processamento_subgrupo_service(
    carta_repo: Annotated[ICartaControleRepository, Depends(get_carta_repository)],
    subgrupo_repo: Annotated[ISubgrupoRepository, Depends(get_subgrupo_repository)],
    manager: Annotated[ConnectionManager, Depends(get_connection_manager)],
) -> ProcessamentoSubgrupoService:
    capacidade_service = AnaliseCapacidadeService(carta_repository=carta_repo)
    ws_observer = WebSocketNotificationObserver(
        connection_manager=manager,
        capacidade_service=capacidade_service,
    )
    return ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        observers=[ws_observer],
        analise_capacidade_service=capacidade_service,
    )


# Autenticação e Usuário Atual
async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    usuario_repo: Annotated[IUsuarioRepository, Depends(get_usuario_repository)],
) -> Usuario:
    """Extrai e valida o token JWT e retorna a entidade de Usuário autenticado."""
    credenciais_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais de autenticação inválidas ou expiradas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decodificar_token(token)
    if payload is None:
        raise credenciais_exception

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise credenciais_exception

    try:
        user_uuid = UUID(user_id_str)
        usuario = await usuario_repo.obter_por_id(user_uuid)
    except (ValueError, TypeError):
        usuario = await usuario_repo.obter_por_email(user_id_str)

    if usuario is None:
        raise credenciais_exception

    return usuario
