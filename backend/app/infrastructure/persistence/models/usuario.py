from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base

if TYPE_CHECKING:
    from app.infrastructure.persistence.models.ocorrencia import OcorrenciaCausaEspModel


class UsuarioModel(Base):
    """Modelo relacional da tabela de usuários."""

    __tablename__ = "usuarios"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    perfil: Mapped[str] = mapped_column(String(50), nullable=False, default="OPERADOR")

    # Relacionamentos
    ocorrencias: Mapped[list["OcorrenciaCausaEspModel"]] = relationship(
        back_populates="operador",
        lazy="selectin",
    )
