import math

from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.domain.value_objects.simulacao_binomial import (
    CriterioConformidade,
    EscopoAmostral,
    PontoDistribuicaoBinomial,
    ResultadoSimulacaoBinomial,
    TipoArranjo,
)


class CalculadorSimulacaoBinomial:
    """Serviço de domínio para cálculo de arranjos probabilísticos binomiais em cartas de controle."""

    @staticmethod
    def normal_cdf(z: float) -> float:
        """Função de Distribuição Acumulada da Normal Padrão Φ(z) = 0.5 * (1 + erf(z / sqrt(2)))."""
        return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))

    @classmethod
    def calcular_pmf_ponto(cls, n: int, k: int, p: float, q: float) -> float:
        """Calcula P(K = k) para distribuição Binomial(n, p)."""
        if p >= 1.0:
            return 1.0 if k == n else 0.0
        if p <= 0.0:
            return 1.0 if k == 0 else 0.0
        comb = math.comb(n, k)
        return float(comb * (p**k) * (q ** (n - k)))

    @classmethod
    def calcular(
        cls,
        tipo_arranjo: TipoArranjo,
        criterio: CriterioConformidade,
        escopo: EscopoAmostral,
        media_processo: float,
        sigma_estimado: float,
        tamanho_subgrupo: int,
        tamanho_lote_x: int,
        sucessos_desejados_y: int,
        z_valor: float | None = None,
        limites_controle: LimitesControle | None = None,
        especificacoes: LimitesEspecificacao | None = None,
    ) -> ResultadoSimulacaoBinomial:
        """Executa a simulação probabilística binomial considerando o critério de conformidade

        e os parâmetros do processo sob hipótese de normalidade.
        """
        # 1. Validações básicas de entrada
        if sigma_estimado <= 0:
            raise ValueError(f"Sigma estimado ({sigma_estimado}) deve ser estritamente positivo.")
        if tamanho_subgrupo < 1:
            raise ValueError(f"Tamanho de subgrupo ({tamanho_subgrupo}) deve ser >= 1.")
        if tamanho_lote_x < 1:
            raise ValueError(f"Tamanho do lote/sequência X ({tamanho_lote_x}) deve ser >= 1.")

        # Ajuste de parâmetro conforme o modo de arranjo
        if tipo_arranjo == TipoArranjo.CONSECUTIVO:
            sucessos_desejados_y = tamanho_lote_x
        elif not (0 <= sucessos_desejados_y <= tamanho_lote_x):
            raise ValueError(
                f"Sucessos desejados Y ({sucessos_desejados_y}) deve estar entre 0 e o tamanho do lote X ({tamanho_lote_x})."
            )

        # 2. Determinação da dispersão a ser usada (Individual vs Média de Subgrupo)
        if escopo == EscopoAmostral.MEDIA_SUBGRUPO:
            sigma_usado = sigma_estimado / math.sqrt(tamanho_subgrupo)
        else:
            sigma_usado = sigma_estimado

        # 3. Determinação da Probabilidade Unitária de Conformidade (p) e Faixa
        faixa_inf: float | None = None
        faixa_sup: float | None = None

        if criterio == CriterioConformidade.Z_SIGMAS:
            if z_valor is None or z_valor <= 0:
                raise ValueError(f"Distância Z ({z_valor}) deve ser estritamente positiva para critério Z_SIGMAS.")
            faixa_inf = media_processo - z_valor * sigma_usado
            faixa_sup = media_processo + z_valor * sigma_usado
            p = math.erf(z_valor / math.sqrt(2.0))

        elif criterio == CriterioConformidade.LIMITES_CONTROLE:
            if limites_controle is None:
                raise ValueError("Limites de controle da carta não foram calculados ou não estão disponíveis.")
            faixa_inf = limites_controle.lic
            faixa_sup = limites_controle.lsc
            z_inf = (faixa_inf - media_processo) / sigma_usado
            z_sup = (faixa_sup - media_processo) / sigma_usado
            p = cls.normal_cdf(z_sup) - cls.normal_cdf(z_inf)

        elif criterio == CriterioConformidade.LIMITES_ESPECIFICACAO:
            if especificacoes is None or (especificacoes.lse is None and especificacoes.lie is None):
                raise ValueError(
                    "A carta não possui limites de especificação (LSE e/ou LIE) definidos para este critério."
                )
            faixa_inf = especificacoes.lie
            faixa_sup = especificacoes.lse

            phi_sup = cls.normal_cdf((faixa_sup - media_processo) / sigma_usado) if faixa_sup is not None else 1.0
            phi_inf = cls.normal_cdf((faixa_inf - media_processo) / sigma_usado) if faixa_inf is not None else 0.0
            p = phi_sup - phi_inf
        else:
            raise ValueError(f"Critério de conformidade não reconhecido: {criterio}")

        # Trunca para garantir limites de probabilidade rigorosos [0, 1]
        p = max(0.0, min(1.0, float(p)))
        q = max(0.0, min(1.0, 1.0 - p))

        # 4. Cálculo da Distribuição Completa de k = 0 até X
        distribuicao: list[PontoDistribuicaoBinomial] = []
        for k in range(tamanho_lote_x + 1):
            prob_k = cls.calcular_pmf_ponto(tamanho_lote_x, k, p, q)

            destaque = False
            if tipo_arranjo in (TipoArranjo.CONSECUTIVO, TipoArranjo.EXATAMENTE):
                destaque = (k == sucessos_desejados_y)
            elif tipo_arranjo == TipoArranjo.PELO_MENOS:
                destaque = (k >= sucessos_desejados_y)
            elif tipo_arranjo == TipoArranjo.NO_MAXIMO:
                destaque = (k <= sucessos_desejados_y)

            distribuicao.append(
                PontoDistribuicaoBinomial(
                    k=k,
                    probabilidade=round(prob_k, 6),
                    destaque=destaque,
                )
            )

        # 5. Cálculo do Arranjo Solicitado
        combinacoes = math.comb(tamanho_lote_x, sucessos_desejados_y)

        if tipo_arranjo == TipoArranjo.CONSECUTIVO:
            combinacoes = 1
            prob_final = p**tamanho_lote_x
        elif tipo_arranjo == TipoArranjo.EXATAMENTE:
            prob_final = cls.calcular_pmf_ponto(tamanho_lote_x, sucessos_desejados_y, p, q)
        elif tipo_arranjo == TipoArranjo.PELO_MENOS:
            prob_final = sum(ponto.probabilidade for ponto in distribuicao if ponto.k >= sucessos_desejados_y)
        elif tipo_arranjo == TipoArranjo.NO_MAXIMO:
            prob_final = sum(ponto.probabilidade for ponto in distribuicao if ponto.k <= sucessos_desejados_y)
        else:
            raise ValueError(f"Tipo de arranjo não suportado: {tipo_arranjo}")

        prob_final = max(0.0, min(1.0, float(prob_final)))

        return ResultadoSimulacaoBinomial(
            tipo_arranjo=tipo_arranjo,
            criterio=criterio,
            escopo=escopo,
            media_processo=round(media_processo, 4),
            sigma_usado=round(sigma_usado, 6),
            z_valor=round(z_valor, 4) if z_valor is not None else None,
            faixa_inferior=round(faixa_inf, 4) if faixa_inf is not None else None,
            faixa_superior=round(faixa_sup, 4) if faixa_sup is not None else None,
            probabilidade_unitaria_p=round(p, 6),
            probabilidade_falha_q=round(q, 6),
            tamanho_lote_x=tamanho_lote_x,
            sucessos_desejados_y=sucessos_desejados_y,
            combinacoes=combinacoes,
            probabilidade_final=round(prob_final, 6),
            distribuicao_completa=distribuicao,
        )
