from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base

if TYPE_CHECKING:
    from app.infrastructure.persistence.models.processo import ProcessoModel
    from app.infrastructure.persistence.models.subgrupo import SubgrupoModel


class CartaControleModel(Base):
    """Modelo relacional da tabela de cartas de controle estatístico de processos."""

    __tablename__ = "cartas_controle"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    processo_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("processos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tipo_carta: Mapped[str] = mapped_column(String(30), nullable=False)
    tamanho_subgrupo: Mapped[int] = mapped_column(Integer, nullable=False)

    # Limites de Especificação / Engenharia
    limite_superior_esp: Mapped[float | None] = mapped_column(Float, nullable=True)
    limite_inferior_esp: Mapped[float | None] = mapped_column(Float, nullable=True)
    valor_nominal: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Limites Estatísticos de Controle Calculados
    lsc_calculado: Mapped[float | None] = mapped_column(Float, nullable=True)
    lic_calculado: Mapped[float | None] = mapped_column(Float, nullable=True)
    lc_calculado: Mapped[float | None] = mapped_column(Float, nullable=True)
    sigma_estimado: Mapped[float | None] = mapped_column(Float, nullable=True)

    modo_limites: Mapped[str] = mapped_column(String(20), nullable=False, default="DINAMICO")

    # Relacionamentos
    processo: Mapped["ProcessoModel"] = relationship(
        back_populates="cartas",
        lazy="selectin",
    )
    subgrupos: Mapped[list["SubgrupoModel"]] = relationship(
        back_populates="carta",
        cascade="all, delete-orphan",
        order_by="SubgrupoModel.numero_subgrupo",
        lazy="selectin",
    )
