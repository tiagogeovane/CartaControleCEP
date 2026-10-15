from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.repositories import ISubgrupoRepository
from app.infrastructure.persistence.mappers import (
    subgrupo_entity_to_model,
    subgrupo_model_to_entity,
)
from app.infrastructure.persistence.models.subgrupo import SubgrupoModel


class MySQLSubgrupoRepository(ISubgrupoRepository):
    """Implementação concreta de ISubgrupoRepository utilizando SQLAlchemy assíncrono para MySQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def salvar(self, subgrupo: Subgrupo) -> Subgrupo:
        """Persiste um subgrupo com suas medições brutas e violações em transação única."""
        model, amostras = subgrupo_entity_to_model(subgrupo)
        self._session.add(model)
        for amostra in amostras:
            self._session.add(amostra)

        await self._session.flush()
        return subgrupo

    async def salvar_em_lote(self, subgrupos: Sequence[Subgrupo]) -> list[Subgrupo]:
        """Persiste múltiplos subgrupos e suas respectivas medições em lote."""
        for s in subgrupos:
            model, amostras = subgrupo_entity_to_model(s)
            self._session.add(model)
            for amostra in amostras:
                self._session.add(amostra)

        await self._session.flush()
        return list(subgrupos)

    async def listar_por_carta(
        self,
        carta_id: UUID,
        limite: int | None = None,
    ) -> list[Subgrupo]:
        """Recupera subgrupos ordenados cronologicamente (se limite informado, os N mais recentes)."""
        if limite is not None:
            stmt = (
                select(SubgrupoModel)
                .options(selectinload(SubgrupoModel.amostras))
                .where(SubgrupoModel.carta_id == str(carta_id))
                .order_by(SubgrupoModel.numero_subgrupo.desc())
                .limit(limite)
            )
            result = await self._session.execute(stmt)
            models = list(reversed(result.scalars().all()))
        else:
            stmt = (
                select(SubgrupoModel)
                .options(selectinload(SubgrupoModel.amostras))
                .where(SubgrupoModel.carta_id == str(carta_id))
                .order_by(SubgrupoModel.numero_subgrupo.asc())
            )
            result = await self._session.execute(stmt)
            models = list(result.scalars().all())

        return [subgrupo_model_to_entity(m) for m in models]

    async def atualizar_violacoes_em_lote(self, subgrupos: Sequence[Subgrupo]) -> None:
        """Atualiza fora_de_controle e regras_violadas de múltiplos subgrupos existentes."""
        if not subgrupos:
            return

        ids = [str(s.id) for s in subgrupos]
        stmt = select(SubgrupoModel).where(SubgrupoModel.id.in_(ids))
        result = await self._session.execute(stmt)
        models_by_id = {m.id: m for m in result.scalars().all()}

        for s in subgrupos:
            model = models_by_id.get(str(s.id))
            if model:
                model.fora_de_controle = s.fora_de_controle
                model.regras_violadas = [v.to_dict() for v in s.violacoes]

        await self._session.flush()
