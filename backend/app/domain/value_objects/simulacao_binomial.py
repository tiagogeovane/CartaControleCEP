from dataclasses import dataclass
from enum import Enum


class TipoArranjo(str, Enum):
    """Define a estrutura do questionamento ou arranjo probabilístico formulado pelo usuário."""

    CONSECUTIVO = "CONSECUTIVO"  # X produtos seguidos sem falha (k = X, n = X, P = p^X)
    EXATAMENTE = "EXATAMENTE"  # Exatamente Y sucessos em X itens: P(K = Y)
    PELO_MENOS = "PELO_MENOS"  # Pelo menos Y sucessos em X itens: P(K >= Y)
    NO_MAXIMO = "NO_MAXIMO"  # No máximo Y sucessos em X itens: P(K <= Y)


class CriterioConformidade(str, Enum):
    """Critério estatístico ou de tolerância que define se uma peça/subgrupo é 'conforme'."""

    Z_SIGMAS = "Z_SIGMAS"  # Dentro de ±Z sigmas da linha central (LC ± Z*sigma)
    LIMITES_CONTROLE = "LIMITES_CONTROLE"  # Dentro dos limites estatísticos de controle (LIC e LSC)
    LIMITES_ESPECIFICACAO = "LIMITES_ESPECIFICACAO"  # Dentro dos limites de especificação de engenharia (LIE e LSE)


class EscopoAmostral(str, Enum):
    """Escopo da dispersão considerada para o cálculo da probabilidade base p."""

    INDIVIDUAL = "INDIVIDUAL"  # Produto individual (dispersão do processo sigma_indiv = sigma_estimado)
    MEDIA_SUBGRUPO = "MEDIA_SUBGRUPO"  # Média de subgrupo (erro padrão sigma_Xbar = sigma_estimado / sqrt(n))


@dataclass(frozen=True)
class PontoDistribuicaoBinomial:
    """Representa um ponto discreto da Função de Massa de Probabilidade (PMF) para k sucessos."""

    k: int
    probabilidade: float
    destaque: bool = False


@dataclass(frozen=True)
class ResultadoSimulacaoBinomial:
    """Resultado estatístico completo do arranjo probabilístico binomial."""

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
    distribuicao_completa: list[PontoDistribuicaoBinomial]
