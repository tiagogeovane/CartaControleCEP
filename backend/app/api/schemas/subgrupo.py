from datetime import datetime
from uuid import UUID

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


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

    @model_validator(mode="before")
    @classmethod
    def extrair_amostras(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "amostras" not in data:
                for chave in ("Data", "data", "subgrupos", "dados"):
                    if chave in data and isinstance(data[chave], list):
                        data["amostras"] = data[chave]
                        break
        elif isinstance(data, list):
            return {"amostras": data}
        return data


class ImportacaoLoteResponse(BaseModel):
    """Resultado da carga histórica de subgrupos."""

    carta_id: UUID
    total_importados: int
    subgrupos: list[SubgrupoResponse]
