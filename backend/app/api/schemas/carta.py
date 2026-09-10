from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LimitesEspecificacaoSchema(BaseModel):
    """Tolerâncias de engenharia para o produto ou processo."""

    lse: float | None = Field(default=None, description="Limite Superior de Especificação")
    lie: float | None = Field(default=None, description="Limite Inferior de Especificação")
    valor_nominal: float | None = Field(default=None, description="Valor Alvo / Nominal de projeto")


class LimitesControleSchema(BaseModel):
    """Limites estatísticos calculados pelo motor de CEP."""

    lc: float = Field(..., description="Linha Central (Média Global)")
    lsc: float = Field(..., description="Limite Superior de Controle (+3 sigma)")
    lic: float = Field(..., description="Limite Inferior de Controle (-3 sigma)")
    sigma_estimado: float = Field(..., description="Desvio padrão estimado do processo")


class CartaControleCreate(BaseModel):
    """Schema para criação de uma nova Carta de Controle."""

    processo_id: UUID = Field(..., description="ID do processo industrial associado")
    tamanho_subgrupo: int = Field(..., ge=1, description="Tamanho nominal das amostras coletadas (n)")
    tipo_carta: str | None = Field(default=None, description="Tipo da carta (X_R, X_S, I_MR). Se omitido, aplica RN01")
    especificacoes: LimitesEspecificacaoSchema | None = Field(default=None, description="Tolerâncias de engenharia")
    modo_limites: str = Field(default="DINAMICO", description="Modo dos limites: DINAMICO ou FIXO")


class CartaControleResponse(BaseModel):
    """Schema de retorno dos dados da Carta de Controle."""

    id: UUID
    processo_id: UUID
    tipo_carta: str
    tamanho_subgrupo: int
    especificacoes: LimitesEspecificacaoSchema | None = None
    limites_atuais: LimitesControleSchema | None = None
    modo_limites: str
    total_subgrupos: int = 0

    model_config = ConfigDict(from_attributes=True)


class ModoLimitesUpdate(BaseModel):
    """Schema para alternância do modo de limites da carta."""

    modo_limites: str = Field(..., pattern="^(DINAMICO|FIXO)$", description="Novo modo: 'DINAMICO' ou 'FIXO'")


class IndicesCapacidadeSchema(BaseModel):
    """Valores numéricos dos índices de capacidade do processo."""

    cp: float | None = None
    cpk: float | None = None
    cpu: float | None = None
    cpl: float | None = None


class CapacidadeResponse(BaseModel):
    """Relatório analítico de capacidade do processo (Cp e Cpk) conforme RN04."""

    carta_id: str
    processo_id: str
    tipo_carta: str
    tamanho_subgrupo: int
    total_subgrupos: int
    amostra_estatisticamente_robusta: bool
    aviso: str | None = None
    media_processo: float
    sigma_estimado: float
    especificacoes: LimitesEspecificacaoSchema
    limites_controle: LimitesControleSchema
    indices: IndicesCapacidadeSchema
    aprovado: bool
    criterio_aprovacao: float
    classificacao: str
