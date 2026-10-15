import pytest

from app.domain.services.simulacao_binomial import CalculadorSimulacaoBinomial
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.domain.value_objects.simulacao_binomial import (
    CriterioConformidade,
    EscopoAmostral,
    TipoArranjo,
)


def test_simulacao_z_sigmas_consecutivo_exemplo_oficial():
    """Valida o exemplo exato apresentado na especificação do usuário:

    Z = 2.50, X = 5, Consecutivo -> p = 98.7581%, P(X=5) = 93.9412%.
    """
    res = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.CONSECUTIVO,
        criterio=CriterioConformidade.Z_SIGMAS,
        escopo=EscopoAmostral.INDIVIDUAL,
        media_processo=10.0,
        sigma_estimado=0.06,
        tamanho_subgrupo=5,
        tamanho_lote_x=5,
        sucessos_desejados_y=5,
        z_valor=2.50,
    )

    # 1. Probabilidade unitária p (erf(2.5 / sqrt(2)))
    assert round(res.probabilidade_unitaria_p, 4) == 0.9876
    assert round(res.probabilidade_falha_q, 4) == 0.0124

    # 2. Arranjo e probabilidade final
    assert res.combinacoes == 1
    assert round(res.probabilidade_final, 4) == 0.9394

    # 3. Faixa de tolerância avaliada
    assert res.faixa_inferior == round(10.0 - 2.5 * 0.06, 4)  # 9.85
    assert res.faixa_superior == round(10.0 + 2.5 * 0.06, 4)  # 10.15

    # 4. Distribuição completa de k=0 a 5
    assert len(res.distribuicao_completa) == 6
    assert res.distribuicao_completa[5].destaque is True
    assert res.distribuicao_completa[4].destaque is False


def test_simulacao_z_sigmas_tres_sigmas():
    """Valida Z = 3.00 resultando no clássico 99.73% de probabilidade."""
    res = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.EXATAMENTE,
        criterio=CriterioConformidade.Z_SIGMAS,
        escopo=EscopoAmostral.INDIVIDUAL,
        media_processo=50.0,
        sigma_estimado=2.0,
        tamanho_subgrupo=5,
        tamanho_lote_x=10,
        sucessos_desejados_y=10,
        z_valor=3.00,
    )

    assert round(res.probabilidade_unitaria_p, 4) == 0.9973
    assert res.combinacoes == 1


def test_simulacao_limites_controle_escopos():
    """Testa a distinção de escopo: Produto Individual vs Média de Subgrupo."""
    limites = LimitesControle(lc=20.0, lsc=20.6, lic=19.4, sigma_estimado=0.2)

    # 1. Produto Individual (sigma = 0.2, limites a +-3 sigmas)
    res_indiv = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.CONSECUTIVO,
        criterio=CriterioConformidade.LIMITES_CONTROLE,
        escopo=EscopoAmostral.INDIVIDUAL,
        media_processo=20.0,
        sigma_estimado=0.2,
        tamanho_subgrupo=4,
        tamanho_lote_x=3,
        sucessos_desejados_y=3,
        limites_controle=limites,
    )
    assert res_indiv.sigma_usado == 0.2
    assert round(res_indiv.probabilidade_unitaria_p, 4) == 0.9973

    # 2. Média de Subgrupo (sigma = 0.2 / sqrt(4) = 0.1 -> limites a +-6 sigmas da média)
    res_media = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.CONSECUTIVO,
        criterio=CriterioConformidade.LIMITES_CONTROLE,
        escopo=EscopoAmostral.MEDIA_SUBGRUPO,
        media_processo=20.0,
        sigma_estimado=0.2,
        tamanho_subgrupo=4,
        tamanho_lote_x=3,
        sucessos_desejados_y=3,
        limites_controle=limites,
    )
    assert res_media.sigma_usado == 0.1
    assert round(res_media.probabilidade_unitaria_p, 4) == 1.0


def test_simulacao_limites_especificacao_descentrado():
    """Valida o cálculo com limites de especificação e processo descentrado."""
    # Processo com média 10.0 e sigma 0.5
    # Especificação LIE = 9.5 (-1.0 sigma), LSE = 11.5 (+3.0 sigmas)
    # Phi(3.0) - Phi(-1.0) = 0.99865 - 0.158655 = 0.8400
    specs = LimitesEspecificacao(lse=11.5, lie=9.5, valor_nominal=10.5)

    res = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.EXATAMENTE,
        criterio=CriterioConformidade.LIMITES_ESPECIFICACAO,
        escopo=EscopoAmostral.INDIVIDUAL,
        media_processo=10.0,
        sigma_estimado=0.5,
        tamanho_subgrupo=5,
        tamanho_lote_x=4,
        sucessos_desejados_y=4,
        especificacoes=specs,
    )

    assert round(res.probabilidade_unitaria_p, 4) == 0.8400
    # P(K=4 em N=4) com p=0.84 -> 0.84^4 = 0.4979
    assert round(res.probabilidade_final, 4) == 0.4979


def test_simulacao_arranjos_pelo_menos_e_no_maximo():
    """Valida operadores cumulativos P(K >= Y) e P(K <= Y)."""
    # Lote de X=4, p=0.5
    # P(K=0) = 1/16, P(K=1) = 4/16, P(K=2) = 6/16, P(K=3) = 4/16, P(K=4) = 1/16
    limites = LimitesControle(lc=10.0, lsc=10.0, lic=10.0, sigma_estimado=1.0)

    # Forçamos p=0.5 via Z=0.67448975
    res_pelo_menos = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.PELO_MENOS,
        criterio=CriterioConformidade.Z_SIGMAS,
        escopo=EscopoAmostral.INDIVIDUAL,
        media_processo=10.0,
        sigma_estimado=1.0,
        tamanho_subgrupo=5,
        tamanho_lote_x=4,
        sucessos_desejados_y=3,
        z_valor=0.67448975,  # erf(0.67448975 / sqrt(2)) ~ 0.5
    )
    # P(K >= 3) = P(K=3) + P(K=4) = 4/16 + 1/16 = 5/16 = 0.3125
    assert round(res_pelo_menos.probabilidade_unitaria_p, 2) == 0.50
    assert round(res_pelo_menos.probabilidade_final, 4) == 0.3125
    assert res_pelo_menos.distribuicao_completa[3].destaque is True
    assert res_pelo_menos.distribuicao_completa[4].destaque is True
    assert res_pelo_menos.distribuicao_completa[2].destaque is False

    res_no_maximo = CalculadorSimulacaoBinomial.calcular(
        tipo_arranjo=TipoArranjo.NO_MAXIMO,
        criterio=CriterioConformidade.Z_SIGMAS,
        escopo=EscopoAmostral.INDIVIDUAL,
        media_processo=10.0,
        sigma_estimado=1.0,
        tamanho_subgrupo=5,
        tamanho_lote_x=4,
        sucessos_desejados_y=1,
        z_valor=0.67448975,
    )
    # P(K <= 1) = P(K=0) + P(K=1) = 1/16 + 4/16 = 5/16 = 0.3125
    assert round(res_no_maximo.probabilidade_final, 4) == 0.3125
    assert res_no_maximo.distribuicao_completa[0].destaque is True
    assert res_no_maximo.distribuicao_completa[1].destaque is True
    assert res_no_maximo.distribuicao_completa[2].destaque is False


def test_simulacao_erros_validacao():
    """Garante que entradas inválidas geram ValueError com mensagens claras."""
    # 1. Sigma não positivo
    with pytest.raises(ValueError, match="Sigma estimado"):
        CalculadorSimulacaoBinomial.calcular(
            tipo_arranjo=TipoArranjo.CONSECUTIVO,
            criterio=CriterioConformidade.Z_SIGMAS,
            escopo=EscopoAmostral.INDIVIDUAL,
            media_processo=10.0,
            sigma_estimado=0.0,
            tamanho_subgrupo=5,
            tamanho_lote_x=5,
            sucessos_desejados_y=5,
            z_valor=2.5,
        )

    # 2. Y > X
    with pytest.raises(ValueError, match="Sucessos desejados Y"):
        CalculadorSimulacaoBinomial.calcular(
            tipo_arranjo=TipoArranjo.EXATAMENTE,
            criterio=CriterioConformidade.Z_SIGMAS,
            escopo=EscopoAmostral.INDIVIDUAL,
            media_processo=10.0,
            sigma_estimado=1.0,
            tamanho_subgrupo=5,
            tamanho_lote_x=5,
            sucessos_desejados_y=6,
            z_valor=2.5,
        )

    # 3. Z ausente para critério Z_SIGMAS
    with pytest.raises(ValueError, match="Distância Z"):
        CalculadorSimulacaoBinomial.calcular(
            tipo_arranjo=TipoArranjo.CONSECUTIVO,
            criterio=CriterioConformidade.Z_SIGMAS,
            escopo=EscopoAmostral.INDIVIDUAL,
            media_processo=10.0,
            sigma_estimado=1.0,
            tamanho_subgrupo=5,
            tamanho_lote_x=5,
            sucessos_desejados_y=5,
            z_valor=None,
        )

    # 4. Especificações ausentes
    with pytest.raises(ValueError, match="não possui limites de especificação"):
        CalculadorSimulacaoBinomial.calcular(
            tipo_arranjo=TipoArranjo.CONSECUTIVO,
            criterio=CriterioConformidade.LIMITES_ESPECIFICACAO,
            escopo=EscopoAmostral.INDIVIDUAL,
            media_processo=10.0,
            sigma_estimado=1.0,
            tamanho_subgrupo=5,
            tamanho_lote_x=5,
            sucessos_desejados_y=5,
            especificacoes=None,
        )
