import pytest
from app.domain.strategies.xs_chart import CartaXsStrategy


class TestCartaXsStrategy:
    @pytest.fixture
    def strategy(self) -> CartaXsStrategy:
        return CartaXsStrategy()

    def test_constante_c4_tabelada_conhecida(self, strategy: CartaXsStrategy):
        # Valores de referência clássicos da tabela de c4:
        # c4(5) = 0.9400, c4(10) = 0.9727, c4(12) = 0.9776, c4(25) = 0.9896
        assert pytest.approx(strategy.calcular_c4(5), abs=1e-3) == 0.9400
        assert pytest.approx(strategy.calcular_c4(10), abs=1e-3) == 0.9727
        assert pytest.approx(strategy.calcular_c4(12), abs=1e-3) == 0.9776
        assert pytest.approx(strategy.calcular_c4(25), abs=1e-3) == 0.9896

    def test_constante_a3_conhecida(self, strategy: CartaXsStrategy):
        # A3(10) = 3 / (0.9727 * sqrt(10)) = 3 / (0.9727 * 3.16227) = 3 / 3.0759 = 0.975
        a3_10 = strategy.calcular_a3(10)
        assert pytest.approx(a3_10, abs=1e-3) == 0.975

    def test_calcular_estatisticas_subgrupo(self, strategy: CartaXsStrategy):
        amostras = [20.0, 22.0, 19.0, 21.0, 23.0]
        stats = strategy.calcular_estatisticas(amostras)
        assert stats.media_x == 21.0
        assert stats.amplitude_r == 4.0
        assert stats.desvio_s > 0

    def test_calcular_limites_xs(self, strategy: CartaXsStrategy):
        # Suponha 10 subgrupos com media global = 100.0 e s_barra = 5.0 para n=10
        historico_medias = [100.0] * 10
        historico_desvios = [5.0] * 10
        n = 10

        limites = strategy.calcular_limites(historico_medias, historico_desvios, n)
        # A3(10) ~ 0.975
        # LSC = 100 + (0.975 * 5.0) = 104.875
        # LIC = 100 - (0.975 * 5.0) = 95.125
        # sigma = 5.0 / c4(10) = 5.0 / 0.9727 = 5.1403
        assert limites.lc == 100.0
        assert pytest.approx(limites.lsc, abs=1e-2) == 104.88
        assert pytest.approx(limites.lic, abs=1e-2) == 95.12
        assert pytest.approx(limites.sigma_estimado, abs=1e-2) == 5.14

    def test_calcular_limites_desvio_s(self, strategy: CartaXsStrategy):
        historico_desvios = [5.0] * 10
        n = 10
        lic_s, lc_s, lsc_s = strategy.calcular_limites_desvio(historico_desvios, n)
        assert lc_s == 5.0
        assert lic_s < lc_s < lsc_s

    def test_calcular_limites_dispersao_polimorfico(self, strategy: CartaXsStrategy):
        historico_desvios = [5.0] * 10
        lic, lc, lsc = strategy.calcular_limites_dispersao(historico_desvios, n=10)
        assert lc == 5.0
        assert lic < lc < lsc


    def test_calcular_c4_validacoes_e_assintotica(self, strategy: CartaXsStrategy):
        with pytest.raises(ValueError, match="Fator c4 requer n >= 2"):
            strategy.calcular_c4(1)
        c4_grande = strategy.calcular_c4(101)
        assert 0.99 < c4_grande < 1.0

    def test_calcular_estatisticas_rejeita_menos_de_2_amostras(self, strategy: CartaXsStrategy):
        with pytest.raises(ValueError, match="exige ao menos 2 medições"):
            strategy.calcular_estatisticas([5.0])

    def test_calcular_limites_validacoes(self, strategy: CartaXsStrategy):
        with pytest.raises(ValueError, match="não pode estar vazio"):
            strategy.calcular_limites([], [], n=10)
        with pytest.raises(ValueError, match="Tamanhos divergentes"):
            strategy.calcular_limites([10.0, 11.0], [1.0], n=10)
        with pytest.raises(ValueError, match="Requer n >= 2"):
            strategy.calcular_limites([10.0], [1.0], n=1)

    def test_calcular_limites_desvio_rejeita_vazio(self, strategy: CartaXsStrategy):
        with pytest.raises(ValueError, match="não pode estar vazio"):
            strategy.calcular_limites_desvio([], n=10)
