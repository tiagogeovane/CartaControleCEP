from datetime import datetime
from uuid import UUID

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AmostraIngestaoRequest(BaseModel):
    """Payload de telemetria para envio de novas medições amostrais de um subgrupo."""

    valores: list[float] = Field(..., min_length=1, description="Array com as leituras numéricas do subgrupo amostral")
    numero_subgrupo: int | None = Field(default=None, ge=1, description="Identificador sequencial do subgrupo (opcional)")
    timestamp: datetime | None = Field(default=None, description="Data/hora da coleta (opcional, assume UTC agora)")
    goal: str | None = Field(default=None, description="Objetivo ou fase da amostra: 'Calibrar'/'Calibracao' ou 'Acompanhamento'/'Monitoramento'")
    modo_limites: str | None = Field(default=None, description="Override explícito de modo: 'DINAMICO' ou 'FIXO'")


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
    goal: str | None = Field(default=None, description="Objetivo ou fase do lote: 'Calibrar' ou 'Acompanhamento'")
    modo_limites: str | None = Field(default=None, description="Override explícito de modo: 'DINAMICO' ou 'FIXO'")

    @model_validator(mode="before")
    @classmethod
    def extrair_amostras(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "goal" not in data:
                for chave in ("Goal", "goal", "Meta", "meta"):
                    if chave in data and isinstance(data[chave], str):
                        data["goal"] = data[chave]
                        break
            if "amostras" not in data:
                for chave in ("Data", "data", "subgrupos", "dados"):
                    if chave in data and isinstance(data[chave], list):
                        data["amostras"] = data[chave]
                        break
            if "amostras" in data and isinstance(data["amostras"], list):
                amostras_norm = []
                for item in data["amostras"]:
                    if isinstance(item, (int, float)):
                        amostras_norm.append([float(item)])
                    elif isinstance(item, list):
                        amostras_norm.append([float(x) for x in item])
                    else:
                        amostras_norm.append(item)
                data["amostras"] = amostras_norm
        elif isinstance(data, list):
            amostras_norm = []
            for item in data:
                if isinstance(item, (int, float)):
                    amostras_norm.append([float(item)])
                elif isinstance(item, list):
                    amostras_norm.append([float(x) for x in item])
                else:
                    amostras_norm.append(item)
            return {"amostras": amostras_norm}
        return data


class ImportacaoLoteResponse(BaseModel):
    """Resultado da carga histórica de subgrupos."""

    carta_id: UUID
    total_importados: int
    subgrupos: list[SubgrupoResponse]
