from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.usuario import Usuario
from app.domain.interfaces.repositories import IUsuarioRepository
from app.infrastructure.persistence.mappers import (
    usuario_entity_to_model,
    usuario_model_to_entity,
)
from app.infrastructure.persistence.models.usuario import UsuarioModel


class MySQLUsuarioRepository(IUsuarioRepository):
    """Implementação concreta de IUsuarioRepository utilizando SQLAlchemy assíncrono para MySQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def obter_por_id(self, usuario_id: UUID) -> Usuario | None:
        stmt = select(UsuarioModel).where(UsuarioModel.id == str(usuario_id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return usuario_model_to_entity(model)

    async def obter_por_email(self, email: str) -> Usuario | None:
        stmt = select(UsuarioModel).where(UsuarioModel.email == email.strip().lower())
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return usuario_model_to_entity(model)

    async def salvar(self, usuario: Usuario) -> Usuario:
        stmt = select(UsuarioModel).where(UsuarioModel.id == str(usuario.id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model:
            model.nome = usuario.nome
            model.email = usuario.email
            model.senha_hash = usuario.senha_hash
            model.perfil = usuario.perfil
        else:
            model = usuario_entity_to_model(usuario)
            self._session.add(model)

        await self._session.flush()
        return usuario

    async def listar_todos(self) -> list[Usuario]:
        stmt = select(UsuarioModel).order_by(UsuarioModel.nome.asc())
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [usuario_model_to_entity(m) for m in models]
