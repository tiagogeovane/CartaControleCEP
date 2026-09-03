import pytest
from app.domain.strategies.imr_chart import CartaIMRStrategy


class TestCartaIMRStrategy:
    @pytest.fixture
    def strategy(self) -> CartaIMRStrategy:
        return CartaIMRStrategy()

    def test_calcular_estatisticas_unitarias(self, strategy: CartaIMRStrategy):
        stats = strategy.calcular_estatisticas([42.5])
        assert stats.media_x == 42.5
        assert stats.amplitude_r == 0.0
        assert stats.desvio_s == 0.0
        assert stats.valores_brutos == (42.5,)

    def test_rejeita_mais_de_uma_amostra(self, strategy: CartaIMRStrategy):
        with pytest.raises(ValueError, match="exige exatamente 1 medição unitária"):
            strategy.calcular_estatisticas([10.0, 20.0])

    def test_calcular_amplitudes_moveis(self, strategy: CartaIMRStrategy):
        obs = [10.0, 12.0, 9.0, 14.0]
        mrs = strategy.calcular_amplitudes_moveis(obs)
        assert mrs == [2.0, 3.0, 5.0]

    def test_calcular_limites_imr(self, strategy: CartaIMRStrategy):
        obs = [10.0, 12.0, 9.0, 14.0]
        # x_barra = (10 + 12 + 9 + 14) / 4 = 11.25
        # MR = [2.0, 3.0, 5.0] -> MR_barra = 10 / 3 = 3.33333
        # fator = 3 / 1.128 = 2.65957
        # LSC = 11.25 + (2.65957 * 3.33333) = 20.115
        # LIC = 11.25 - (2.65957 * 3.33333) = 2.385
        limites = strategy.calcular_limites(obs, [])

        assert pytest.approx(limites.lc, abs=1e-2) == 11.25
        assert pytest.approx(limites.lsc, abs=1e-2) == 20.12
        assert pytest.approx(limites.lic, abs=1e-2) == 2.38
        assert pytest.approx(limites.sigma_estimado, abs=1e-2) == 2.95  # 3.3333 / 1.128

    def test_calcular_limites_mr(self, strategy: CartaIMRStrategy):
        mr_barra = 3.0
        lic_mr, lc_mr, lsc_mr = strategy.calcular_limites_mr(mr_barra)
        assert lic_mr == 0.0
        assert lc_mr == 3.0
        assert pytest.approx(lsc_mr, abs=1e-2) == 3.0 * 3.267

    def test_calcular_limites_dispersao_polimorfico(self, strategy: CartaIMRStrategy):
        historico_mr = [2.0, 4.0]  # média = 3.0
        lic, lc, lsc = strategy.calcular_limites_dispersao(historico_mr, n=1)
        assert lic == 0.0
        assert lc == 3.0
        assert pytest.approx(lsc, abs=1e-2) == 3.0 * 3.267

    def test_calcular_limites_dispersao_rejeita_vazio(self, strategy: CartaIMRStrategy):
        with pytest.raises(ValueError, match="Histórico de dispersões não pode estar vazio"):
            strategy.calcular_limites_dispersao([], n=1)


    def test_calcular_amplitudes_moveis_insuficiente(self, strategy: CartaIMRStrategy):
        assert strategy.calcular_amplitudes_moveis([10.0]) == []
        assert strategy.calcular_amplitudes_moveis([]) == []

    def test_calcular_limites_insuficiente(self, strategy: CartaIMRStrategy):
        with pytest.raises(ValueError, match="no mínimo 2 observações"):
            strategy.calcular_limites([10.0], [])

    def test_calcular_limites_com_dispersoes_fornecidas(self, strategy: CartaIMRStrategy):
        obs = [10.0, 12.0, 9.0, 14.0]
        limites = strategy.calcular_limites(obs, [2.0, 3.0, 5.0])
        assert pytest.approx(limites.lc, abs=1e-2) == 11.25
        assert pytest.approx(limites.lsc, abs=1e-2) == 20.12
