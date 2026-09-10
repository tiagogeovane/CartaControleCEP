from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.processo import Processo
from app.domain.interfaces.repositories import IProcessoRepository
from app.infrastructure.persistence.mappers import (
    processo_entity_to_model,
    processo_model_to_entity,
)
from app.infrastructure.persistence.models.processo import ProcessoModel


class MySQLProcessoRepository(IProcessoRepository):
    """Implementação concreta de IProcessoRepository utilizando SQLAlchemy assíncrono para MySQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def obter_por_id(self, processo_id: UUID) -> Processo | None:
        stmt = select(ProcessoModel).where(ProcessoModel.id == str(processo_id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return processo_model_to_entity(model)

    async def salvar(self, processo: Processo) -> Processo:
        stmt = select(ProcessoModel).where(ProcessoModel.id == str(processo.id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        if model:
            model.nome = processo.nome
            model.codigo_linha = processo.codigo_linha
            model.descricao = processo.descricao
        else:
            model = processo_entity_to_model(processo)
            self._session.add(model)

        await self._session.flush()
        return processo

    async def listar_todos(self) -> list[Processo]:
        stmt = select(ProcessoModel).order_by(ProcessoModel.nome.asc())
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [processo_model_to_entity(m) for m in models]
