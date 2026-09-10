from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base

if TYPE_CHECKING:
    from app.infrastructure.persistence.models.subgrupo import SubgrupoModel
    from app.infrastructure.persistence.models.usuario import UsuarioModel


class OcorrenciaCausaEspModel(Base):
    """Modelo relacional para registro de causas especiais e ações corretivas em anomalias."""

    __tablename__ = "ocorrencias_causa_esp"

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
    operador_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    regra_violada: Mapped[str | None] = mapped_column(String(50), nullable=True)
    causa_raiz_identificada: Mapped[str | None] = mapped_column(Text, nullable=True)
    acao_corretiva_tomada: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp_resolucao: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relacionamentos
    subgrupo: Mapped["SubgrupoModel"] = relationship(
        back_populates="ocorrencias",
        lazy="selectin",
    )
    operador: Mapped["UsuarioModel | None"] = relationship(
        back_populates="ocorrencias",
        lazy="selectin",
    )
