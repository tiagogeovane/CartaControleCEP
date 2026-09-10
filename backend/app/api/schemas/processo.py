from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProcessoCreate(BaseModel):
    """Schema para cadastro de um novo Processo Industrial."""

    nome: str = Field(..., min_length=2, max_length=150, description="Nome da linha ou processo fabril")
    codigo_linha: str = Field(..., min_length=2, max_length=50, description="Código de identificação da linha de produção")
    descricao: str | None = Field(default=None, description="Descrição detalhada do processo ou peça usinada")


class ProcessoResponse(BaseModel):
    """Schema de retorno dos dados de um Processo Industrial."""

    id: UUID
    nome: str
    codigo_linha: str
    descricao: str | None

    model_config = ConfigDict(from_attributes=True)
