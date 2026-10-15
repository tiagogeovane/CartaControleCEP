import pytest
from app.domain.rules.detector import DetectorRegrasNelson
from app.domain.rules.nelson_rules import (
    Regra1TresSigma,
    Regra2NoveMesmoLado,
    Regra3SeisTendencia,
    Regra4QuatorzeAlternados,
    Regra5DoisDeTresZonaA,
    Regra6QuatroDeCincoZonaB,
    Regra7QuinzeZonaC,
    Regra8OitoForaZonaC,
)
from app.domain.value_objects.limites import LimitesControle


@pytest.fixture
def limites_padrao() -> LimitesControle:
    # LC = 10.0, LSC = 13.0, LIC = 7.0, sigma_media = 1.0
    return LimitesControle(lc=10.0, lsc=13.0, lic=7.0, sigma_estimado=2.0)


class TestRegra1TresSigma:
    def test_detecta_ponto_acima_lsc(self, limites_padrao: LimitesControle):
        regra = Regra1TresSigma()
        # LSC = 13.0; ponto 13.5 está fora
        historico = [10.0, 10.5, 13.5]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_1"
        assert violacao.numero_subgrupo == 3

    def test_detecta_ponto_abaixo_lic(self, limites_padrao: LimitesControle):
        regra = Regra1TresSigma()
        historico = [10.0, 9.5, 6.8]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_1"

    def test_sem_violacao_quando_dentro_dos_limites(self, limites_padrao: LimitesControle):
        regra = Regra1TresSigma()
        historico = [10.0, 11.0, 9.0, 12.0]
        assert regra.avaliar(historico, limites_padrao) is None

    def test_historico_vazio_retorna_none(self, limites_padrao: LimitesControle):
        regra = Regra1TresSigma()
        assert regra.avaliar([], limites_padrao) is None


class TestRegra2NoveMesmoLado:
    def test_detecta_nove_pontos_acima_lc(self, limites_padrao: LimitesControle):
        regra = Regra2NoveMesmoLado()
        # 9 pontos estritamente maiores que LC (10.0)
        historico = [10.1, 10.5, 10.2, 10.8, 10.4, 10.3, 10.7, 10.6, 10.9]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_2"
        assert len(violacao.pontos_violadores) == 9

    def test_sem_violacao_quando_alterna_em_relacao_ao_lc(self, limites_padrao: LimitesControle):
        regra = Regra2NoveMesmoLado()
        historico = [10.1, 10.5, 9.8, 10.8, 10.4, 10.3, 10.7, 10.6, 10.9]
        assert regra.avaliar(historico, limites_padrao) is None


class TestRegra3SeisTendencia:
    def test_detecta_seis_pontos_crescentes(self, limites_padrao: LimitesControle):
        regra = Regra3SeisTendencia()
        historico = [9.0, 9.2, 9.5, 9.8, 10.1, 10.5]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_3"

    def test_detecta_seis_pontos_decrescentes(self, limites_padrao: LimitesControle):
        regra = Regra3SeisTendencia()
        historico = [11.0, 10.8, 10.5, 10.2, 9.9, 9.6]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_3"

    def test_sem_violacao_com_interrupcao_de_tendencia(self, limites_padrao: LimitesControle):
        regra = Regra3SeisTendencia()
        historico = [9.0, 9.2, 9.5, 9.4, 9.8, 10.1]
        assert regra.avaliar(historico, limites_padrao) is None


class TestRegra4QuatorzeAlternados:
    def test_detecta_quatorze_pontos_alternados(self, limites_padrao: LimitesControle):
        regra = Regra4QuatorzeAlternados()
        # 14 pontos alternando sobe/desce
        historico = [10, 11, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_4"

    def test_sem_violacao_se_nao_alternar(self, limites_padrao: LimitesControle):
        regra = Regra4QuatorzeAlternados()
        historico = [10, 11, 12, 11, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11]
        assert regra.avaliar(historico, limites_padrao) is None


class TestRegra5DoisDeTresZonaA:
    def test_detecta_dois_de_tres_alem_dois_sigma_superior(self, limites_padrao: LimitesControle):
        regra = Regra5DoisDeTresZonaA()
        # LC = 10, sigma_media = 1.0 -> 2 sigma sup = 12.0
        # Janela de 3: [12.2, 11.5, 12.5] -> 2 pontos > 12.0
        historico = [10.0, 12.2, 11.5, 12.5]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_5"

    def test_detecta_dois_de_tres_alem_dois_sigma_inferior(self, limites_padrao: LimitesControle):
        regra = Regra5DoisDeTresZonaA()
        # 2 sigma inf = 8.0
        historico = [10.0, 7.8, 8.5, 7.5]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_5"

    def test_historico_insuficiente_retorna_none(self, limites_padrao: LimitesControle):
        regra = Regra5DoisDeTresZonaA()
        assert regra.avaliar([10.0, 12.5], limites_padrao) is None


class TestRegra6QuatroDeCincoZonaB:
    def test_detecta_quatro_de_cinco_alem_um_sigma(self, limites_padrao: LimitesControle):
        regra = Regra6QuatroDeCincoZonaB()
        # 1 sigma sup = 11.0
        # 4 de 5 > 11.0: [11.2, 11.5, 10.5, 11.3, 11.8]
        historico = [11.2, 11.5, 10.5, 11.3, 11.8]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_6"

    def test_sem_violacao_quando_menos_de_quatro_fora_zona_b(self, limites_padrao: LimitesControle):
        regra = Regra6QuatroDeCincoZonaB()
        historico = [11.2, 10.5, 10.5, 10.3, 11.8]
        assert regra.avaliar(historico, limites_padrao) is None


class TestRegra7QuinzeZonaC:
    def test_detecta_quinze_pontos_na_zona_c(self, limites_padrao: LimitesControle):
        regra = Regra7QuinzeZonaC()
        # Zona C = [9.0, 11.0]
        historico = [10.0, 10.2, 9.8, 10.1, 9.9, 10.0, 10.3, 9.7, 10.1, 10.2, 9.9, 10.0, 10.1, 9.8, 10.0]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_7"

    def test_sem_violacao_quando_ponto_fora_da_zona_c(self, limites_padrao: LimitesControle):
        regra = Regra7QuinzeZonaC()
        historico = [10.0, 10.2, 9.8, 10.1, 9.9, 10.0, 12.0, 9.7, 10.1, 10.2, 9.9, 10.0, 10.1, 9.8, 10.0]
        assert regra.avaliar(historico, limites_padrao) is None


class TestRegra8OitoForaZonaC:
    def test_detecta_oito_pontos_fora_zona_c(self, limites_padrao: LimitesControle):
        regra = Regra8OitoForaZonaC()
        # Todos com |x - 10| > 1.0 (ou > 11.0 ou < 9.0)
        historico = [11.5, 8.5, 11.8, 8.2, 12.0, 8.0, 11.4, 8.8]
        violacao = regra.avaliar(historico, limites_padrao)
        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_8"

    def test_sem_violacao_quando_ha_ponto_na_zona_c(self, limites_padrao: LimitesControle):
        regra = Regra8OitoForaZonaC()
        historico = [11.5, 8.5, 11.8, 10.0, 12.0, 8.0, 11.4, 8.8]
        assert regra.avaliar(historico, limites_padrao) is None


class TestDetectorRegrasNelson:
    def test_executa_multiplas_regras_e_detecta(self, limites_padrao: LimitesControle):
        detector = DetectorRegrasNelson()
        # Ponto 14.0 dispara Regra 1 (> 13.0)
        historico = [10.0, 10.5, 14.0]
        violacoes = detector.avaliar(historico, limites_padrao)
        codigos = [v.codigo_regra for v in violacoes]
        assert "REGRA_1" in codigos

    def test_remover_regra(self):
        detector = DetectorRegrasNelson()
        removido = detector.remover_regra("REGRA_1")
        assert removido is True
        codigos = [r.codigo for r in detector.regras_ativas]
        assert "REGRA_1" not in codigos

    def test_adicionar_regra_e_avaliar_vazio(self, limites_padrao: LimitesControle):
        detector = DetectorRegrasNelson(regras=[])
        assert len(detector.regras_ativas) == 0
        detector.adicionar_regra(Regra1TresSigma())
        assert len(detector.regras_ativas) == 1
        assert detector.avaliar([], limites_padrao) == []

    def test_detector_identifica_anomalia_dispersao_subgrupo_009(self):
        # Limites da carta do relatório para n=5:
        limites = LimitesControle(
            lc=4.9607,
            lsc=4.9733,
            lic=4.9480,
            sigma_estimado=0.0094,
            lc_dispersao=0.02195,
            lsc_dispersao=0.0464,
            lic_dispersao=0.0,
        )
        # Subgrupo #009 possui média 4.9540 (dentro de [4.9480, 4.9733]) e R = 0.0560 (> 0.0464)
        historico_medias = [4.9540]
        historico_dispersoes = [0.0560]

        detector = DetectorRegrasNelson()
        violacoes = detector.avaliar(
            historico_medias=historico_medias,
            limites=limites,
            historico_dispersoes=historico_dispersoes,
            numero_subgrupo=9,
        )

        assert len(violacoes) == 1
        assert violacoes[0].codigo_regra == "REGRA_1_DISP"
        assert violacoes[0].numero_subgrupo == 9
        assert "Dispers" in violacoes[0].descricao


class TestRegraDispersaoForaLimites:
    def test_detecta_dispersao_acima_lsc(self):
        from app.domain.rules.nelson_rules import RegraDispersaoForaLimites

        limites = LimitesControle(
            lc=4.9607,
            lsc=4.9733,
            lic=4.9480,
            sigma_estimado=0.0094,
            lc_dispersao=0.02195,
            lsc_dispersao=0.0464,
            lic_dispersao=0.0,
        )
        regra = RegraDispersaoForaLimites()
        violacao = regra.avaliar(
            historico_dispersoes=[0.020, 0.0560],
            limites=limites,
            numero_subgrupo=9,
        )

        assert violacao is not None
        assert violacao.codigo_regra == "REGRA_1_DISP"
        assert violacao.numero_subgrupo == 9
        assert violacao.pontos_violadores == (9,)

    def test_sem_violacao_quando_dispersao_dentro_dos_limites(self):
        from app.domain.rules.nelson_rules import RegraDispersaoForaLimites

        limites = LimitesControle(
            lc=4.9607,
            lsc=4.9733,
            lic=4.9480,
            sigma_estimado=0.0094,
            lc_dispersao=0.02195,
            lsc_dispersao=0.0464,
            lic_dispersao=0.0,
        )
        regra = RegraDispersaoForaLimites()
        violacao = regra.avaliar(
            historico_dispersoes=[0.020, 0.035],
            limites=limites,
            numero_subgrupo=2,
        )
        assert violacao is None
