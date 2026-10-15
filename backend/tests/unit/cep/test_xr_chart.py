import numpy as np
import pytest
from app.domain.strategies.xr_chart import CartaXRStrategy


class TestCartaXRStrategy:
    @pytest.fixture
    def strategy(self) -> CartaXRStrategy:
        return CartaXRStrategy()

    def test_calcular_estatisticas_subgrupo_n5(self, strategy: CartaXRStrategy):
        amostras = [1.50, 1.52, 1.49, 1.51, 1.53]
        stats = strategy.calcular_estatisticas(amostras)

        assert pytest.approx(stats.media_x, abs=1e-4) == 1.5100
        assert pytest.approx(stats.amplitude_r, abs=1e-4) == 0.0400
        assert pytest.approx(stats.desvio_s, abs=1e-4) == float(np.std(amostras, ddof=1))
        assert stats.valores_brutos == tuple(amostras)

    def test_calcular_estatisticas_rejeita_n_menor_que_2(self, strategy: CartaXRStrategy):
        with pytest.raises(ValueError, match="exige ao menos 2 medições"):
            strategy.calcular_estatisticas([10.0])

    def test_calcular_limites_exemplo_montgomery_n5(self, strategy: CartaXRStrategy):
        # Exemplo clássico da literatura (Montgomery - Exemplo 6.1):
        # x_dupla_barra = 1.5056, R_barra = 0.0325, n = 5
        # A2 = 0.577, d2 = 2.326, D3 = 0, D4 = 2.114
        # LSC = 1.5056 + (0.577 * 0.0325) = 1.52435
        # LIC = 1.5056 - (0.577 * 0.0325) = 1.48685
        # sigma = 0.0325 / 2.326 = 0.013972
        historico_medias = [1.5056]
        historico_dispersoes = [0.0325]
        n = 5

        limites = strategy.calcular_limites(historico_medias, historico_dispersoes, n)

        assert pytest.approx(limites.lc, abs=1e-4) == 1.5056
        assert pytest.approx(limites.lsc, abs=1e-4) == 1.5244
        assert pytest.approx(limites.lic, abs=1e-4) == 1.4869
        assert pytest.approx(limites.sigma_estimado, abs=1e-4) == 0.0140

    def test_calcular_limites_amplitude_r(self, strategy: CartaXRStrategy):
        historico_dispersoes = [0.0325]
        n = 5
        lic_r, lc_r, lsc_r = strategy.calcular_limites_amplitude(historico_dispersoes, n)

        # D3(5) = 0.0 -> LIC_R = 0.0
        # D4(5) = 2.114 -> LSC_R = 2.114 * 0.0325 = 0.068705
        assert lic_r == 0.0
        assert pytest.approx(lc_r, abs=1e-4) == 0.0325
        assert pytest.approx(lsc_r, abs=1e-4) == 0.0687

    def test_calcular_limites_dispersao_polimorfico(self, strategy: CartaXRStrategy):
        historico_dispersoes = [0.0325]
        lic, lc, lsc = strategy.calcular_limites_dispersao(historico_dispersoes, n=5)
        assert lic == 0.0
        assert pytest.approx(lc, abs=1e-4) == 0.0325
        assert pytest.approx(lsc, abs=1e-4) == 0.0687


    def test_rejeita_historico_vazio(self, strategy: CartaXRStrategy):
        with pytest.raises(ValueError, match="não pode estar vazio"):
            strategy.calcular_limites([], [], n=5)

    def test_rejeita_tamanhos_divergentes(self, strategy: CartaXRStrategy):
        with pytest.raises(ValueError, match="Tamanhos divergentes"):
            strategy.calcular_limites([1.0, 2.0], [0.5], n=5)

    def test_rejeita_n_menor_que_2_em_limites(self, strategy: CartaXRStrategy):
        with pytest.raises(ValueError, match="Tamanho de subgrupo n=1 inválido"):
            strategy.calcular_limites([1.0], [0.5], n=1)

    def test_rejeita_n_sem_constantes_tabeladas(self, strategy: CartaXRStrategy):
        with pytest.raises(ValueError, match="não possui constantes tabeladas para Carta X-R"):
            strategy.calcular_limites([10.0], [1.0], n=20)

    def test_calcular_limites_amplitude_rejeita_historico_vazio(self, strategy: CartaXRStrategy):
        with pytest.raises(ValueError, match="Histórico de dispersões não pode estar vazio"):
            strategy.calcular_limites_amplitude([], n=5)

    def test_calcular_limites_dataset_20_subgrupos_relatorio(self, strategy: CartaXRStrategy):
        medias = [
            4.9540, 4.9420, 4.9510, 4.9610, 4.9570, 4.9590, 4.9520, 4.9590, 4.9540, 4.9540,
            4.9670, 4.9590, 4.9700, 4.9630, 4.9700, 4.9520, 4.9760, 4.9710, 4.9710, 4.9710,
        ]
        amplitudes = [
            0.014, 0.031, 0.042, 0.042, 0.014, 0.018, 0.016, 0.020, 0.056, 0.036,
            0.016, 0.032, 0.012, 0.016, 0.020, 0.018, 0.010, 0.007, 0.011, 0.008,
        ]
        limites = strategy.calcular_limites(medias, amplitudes, n=5)

        assert pytest.approx(limites.lc, abs=1e-4) == 4.9607
        assert pytest.approx(limites.lsc, abs=1e-4) == 4.9733
        assert pytest.approx(limites.lic, abs=1e-4) == 4.9480
        assert pytest.approx(limites.sigma_estimado, abs=1e-4) == 0.0094

        assert pytest.approx(limites.lc_dispersao, abs=1e-5) == 0.02195
        assert pytest.approx(limites.lsc_dispersao, abs=1e-4) == 0.0464
        assert limites.lic_dispersao == 0.0
