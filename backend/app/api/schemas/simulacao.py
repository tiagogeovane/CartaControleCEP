from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.value_objects.simulacao_binomial import (
    CriterioConformidade,
    EscopoAmostral,
    TipoArranjo,
)


class SimulacaoBinomialRequest(BaseModel):
    """Payload para solicitação de cálculo de simulação probabilística binomial."""

    tipo_arranjo: TipoArranjo = Field(
        default=TipoArranjo.CONSECUTIVO,
        description="Estrutura do arranjo (CONSECUTIVO, EXATAMENTE, PELO_MENOS, NO_MAXIMO)",
    )
    criterio: CriterioConformidade = Field(
        default=CriterioConformidade.Z_SIGMAS,
        description="Critério de conformidade (Z_SIGMAS, LIMITES_CONTROLE, LIMITES_ESPECIFICACAO)",
    )
    escopo: EscopoAmostral = Field(
        default=EscopoAmostral.INDIVIDUAL,
        description="Escopo amostral (INDIVIDUAL ou MEDIA_SUBGRUPO)",
    )
    z_valor: float | None = Field(
        default=2.50,
        gt=0,
        description="Distância Z em desvios da linha central (obrigatório para Z_SIGMAS)",
    )
    tamanho_lote_x: int = Field(
        default=5,
        ge=1,
        le=500,
        description="Tamanho da sequência ou amostra do lote (X)",
    )
    sucessos_desejados_y: int = Field(
        default=5,
        ge=0,
        le=500,
        description="Quantidade de sucessos ou produtos conformes desejados (Y <= X)",
    )


class PontoDistribuicaoSchema(BaseModel):
    """Ponto discreto da distribuição binomial para k sucessos."""

    k: int
    probabilidade: float
    destaque: bool = False


class SimulacaoBinomialResponse(BaseModel):
    """Resposta com os resultados da simulação probabilística binomial e distribuição completa."""

    carta_id: UUID
    tipo_arranjo: TipoArranjo
    criterio: CriterioConformidade
    escopo: EscopoAmostral
    media_processo: float
    sigma_usado: float
    z_valor: float | None
    faixa_inferior: float | None
    faixa_superior: float | None
    probabilidade_unitaria_p: float
    probabilidade_falha_q: float
    tamanho_lote_x: int
    sucessos_desejados_y: int
    combinacoes: int
    probabilidade_final: float
    distribuicao_completa: list[PontoDistribuicaoSchema]
