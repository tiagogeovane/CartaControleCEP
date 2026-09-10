from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base

if TYPE_CHECKING:
    from app.infrastructure.persistence.models.carta import CartaControleModel


class ProcessoModel(Base):
    """Modelo relacional da tabela de processos industriais ou linhas de produção."""

    __tablename__ = "processos"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    codigo_linha: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relacionamentos
    cartas: Mapped[list["CartaControleModel"]] = relationship(
        back_populates="processo",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
