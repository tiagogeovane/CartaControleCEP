from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base

if TYPE_CHECKING:
    from app.infrastructure.persistence.models.subgrupo import SubgrupoModel


class AmostraItemModel(Base):
    """Modelo relacional para itens individuais de medição dentro de um subgrupo."""

    __tablename__ = "amostras_itens"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    subgrupo_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("subgrupos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    valor_medido: Mapped[float] = mapped_column(Float, nullable=False)
    ordem_coleta: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relacionamentos
    subgrupo: Mapped["SubgrupoModel"] = relationship(
        back_populates="amostras",
        lazy="selectin",
    )
