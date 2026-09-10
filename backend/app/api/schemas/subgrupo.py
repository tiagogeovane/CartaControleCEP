from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AmostraIngestaoRequest(BaseModel):
    """Payload de telemetria para envio de novas medições amostrais de um subgrupo."""

    valores: list[float] = Field(..., min_length=1, description="Array com as leituras numéricas do subgrupo amostral")
    numero_subgrupo: int | None = Field(default=None, ge=1, description="Identificador sequencial do subgrupo (opcional)")
    timestamp: datetime | None = Field(default=None, description="Data/hora da coleta (opcional, assume UTC agora)")


class ViolacaoRegraResponse(BaseModel):
    """Detalhes de uma regra de estabilidade (Nelson) violada."""

    codigo_regra: str
    descricao: str
    numero_subgrupo: int
    pontos_violadores: list[float] = Field(default_factory=list)


class EstatisticasResponse(BaseModel):
    """Métricas pontuais de posição e dispersão calculadas para o subgrupo."""

    media_x: float
    amplitude_r: float
    desvio_s: float
    valores_brutos: list[float]


class SubgrupoResponse(BaseModel):
    """Representação completa de um subgrupo processado e persistido no CEP."""

    id: UUID
    carta_id: UUID
    numero_subgrupo: int
    timestamp: datetime
    valores_brutos: list[float]
    estatisticas: EstatisticasResponse
    fora_de_controle: bool
    violacoes: list[ViolacaoRegraResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ImportacaoLoteRequest(BaseModel):
    """Payload para importação em lote de dados históricos pré-coletados."""

    amostras: list[list[float]] = Field(..., min_length=1, description="Matriz de amostras [[amostra_1], [amostra_2], ...]")


class ImportacaoLoteResponse(BaseModel):
    """Resultado da carga histórica de subgrupos."""

    carta_id: UUID
    total_importados: int
    subgrupos: list[SubgrupoResponse]
