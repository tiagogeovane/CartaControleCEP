from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.entities.carta import CartaControle
from app.domain.interfaces.repositories import ICartaControleRepository
from app.domain.value_objects.limites import LimitesControle
from app.infrastructure.persistence.mappers import (
    carta_entity_to_model,
    carta_model_to_entity,
)
from app.infrastructure.persistence.models.carta import CartaControleModel
from app.infrastructure.persistence.models.subgrupo import SubgrupoModel


class MySQLCartaControleRepository(ICartaControleRepository):
    """Implementação concreta de ICartaControleRepository utilizando SQLAlchemy assíncrono para MySQL."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def obter_por_id(self, carta_id: UUID) -> CartaControle | None:
        stmt = (
            select(CartaControleModel)
            .options(
                selectinload(CartaControleModel.subgrupos).selectinload(
                    SubgrupoModel.amostras
                )
            )
            .where(CartaControleModel.id == str(carta_id))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if not model:
            return None
        return carta_model_to_entity(model)

    async def salvar(self, carta: CartaControle) -> CartaControle:
        stmt = select(CartaControleModel).where(CartaControleModel.id == str(carta.id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        lse = carta.especificacoes.lse if carta.especificacoes else None
        lie = carta.especificacoes.lie if carta.especificacoes else None
        nominal = carta.especificacoes.valor_nominal if carta.especificacoes else None

        lc = carta.limites_atuais.lc if carta.limites_atuais else None
        lsc = carta.limites_atuais.lsc if carta.limites_atuais else None
        lic = carta.limites_atuais.lic if carta.limites_atuais else None
        sigma = carta.limites_atuais.sigma_estimado if carta.limites_atuais else None

        if model:
            model.processo_id = str(carta.processo_id)
            model.tipo_carta = carta.tipo_carta
            model.tamanho_subgrupo = carta.tamanho_subgrupo
            model.limite_superior_esp = lse
            model.limite_inferior_esp = lie
            model.valor_nominal = nominal
            model.lsc_calculado = lsc
            model.lic_calculado = lic
            model.lc_calculado = lc
            model.sigma_estimado = sigma
            model.modo_limites = carta.modo_limites
        else:
            model = carta_entity_to_model(carta)
            self._session.add(model)

        await self._session.flush()
        return carta

    async def listar_todas(self, processo_id: UUID | None = None) -> list[CartaControle]:
        stmt = (
            select(CartaControleModel)
            .options(
                selectinload(CartaControleModel.subgrupos).selectinload(
                    SubgrupoModel.amostras
                )
            )
        )
        if processo_id is not None:
            stmt = stmt.where(CartaControleModel.processo_id == str(processo_id))

        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [carta_model_to_entity(m) for m in models]

    async def atualizar_limites(
        self,
        carta_id: UUID,
        novos_limites: LimitesControle,
    ) -> None:
        """Atualização pontual dos limites calculados da carta no banco de dados."""
        stmt = select(CartaControleModel).where(CartaControleModel.id == str(carta_id))
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        if model:
            model.lc_calculado = novos_limites.lc
            model.lsc_calculado = novos_limites.lsc
            model.lic_calculado = novos_limites.lic
            model.sigma_estimado = novos_limites.sigma_estimado
            await self._session.flush()
