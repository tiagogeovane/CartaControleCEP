from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.mysql import JSON as MySQLJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base

if TYPE_CHECKING:
    from app.infrastructure.persistence.models.amostra import AmostraItemModel
    from app.infrastructure.persistence.models.carta import CartaControleModel
    from app.infrastructure.persistence.models.ocorrencia import OcorrenciaCausaEspModel


class SubgrupoModel(Base):
    """Modelo relacional para subgrupos amostrais coletados e calculados."""

    __tablename__ = "subgrupos"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    carta_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cartas_controle.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    numero_subgrupo: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    media_x: Mapped[float] = mapped_column(Float, nullable=False)
    amplitude_r: Mapped[float] = mapped_column(Float, nullable=False)
    desvio_s: Mapped[float] = mapped_column(Float, nullable=False)
    fora_de_controle: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Armazena lista de violações das regras de Nelson serializadas em JSON
    regras_violadas: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(MySQLJSON, "mysql"),
        nullable=False,
        default=list,
    )

    # Relacionamentos
    carta: Mapped["CartaControleModel"] = relationship(
        back_populates="subgrupos",
        lazy="selectin",
    )
    amostras: Mapped[list["AmostraItemModel"]] = relationship(
        back_populates="subgrupo",
        cascade="all, delete-orphan",
        order_by="AmostraItemModel.ordem_coleta",
        lazy="selectin",
    )
    ocorrencias: Mapped[list["OcorrenciaCausaEspModel"]] = relationship(
        back_populates="subgrupo",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("carta_id", "numero_subgrupo", name="uq_subgrupo_carta_numero"),
    )
