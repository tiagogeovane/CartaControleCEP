import pytest
from app.domain.strategies.c_chart import CartaAtributosCStrategy
from app.domain.strategies.factory import CartaStrategyFactory
from app.domain.strategies.p_chart import CartaAtributosPStrategy


class TestPCChartsUnit:
    def test_p_chart_properties(self):
        strat = CartaAtributosPStrategy()
        assert strat.tipo_carta == "P"
        assert strat.possui_grafico_dispersao is False
        assert strat.sigla_dispersao == "d"
        assert strat.calcular_limites_dispersao([], 5) == (0.0, 0.0, 0.0)

    def test_c_chart_properties(self):
        strat = CartaAtributosCStrategy()
        assert strat.tipo_carta == "C"
        assert strat.possui_grafico_dispersao is False
        assert strat.sigla_dispersao == "c"
        assert strat.calcular_limites_dispersao([], 1) == (0.0, 0.0, 0.0)

    def test_factory_registration(self):
        assert isinstance(CartaStrategyFactory.fabricar("P"), CartaAtributosPStrategy)
        assert isinstance(CartaStrategyFactory.fabricar("C"), CartaAtributosCStrategy)
        assert isinstance(CartaStrategyFactory.fabricar("p"), CartaAtributosPStrategy)
        assert isinstance(CartaStrategyFactory.fabricar("c"), CartaAtributosCStrategy)
