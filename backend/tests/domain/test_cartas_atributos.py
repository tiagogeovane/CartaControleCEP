import math
import uuid
from datetime import datetime, timezone

import numpy as np
import pytest

from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.rules.detector import DetectorRegrasNelson
from app.domain.strategies.c_chart import CartaAtributosCStrategy
from app.domain.strategies.factory import CartaStrategyFactory
from app.domain.strategies.p_chart import CartaAtributosPStrategy


class TestCartaAtributosP:
    """Testes completos da Carta p (Proporção de Itens Defeituosos - Binomial)."""

    def test_calcular_estatisticas_modo_binario(self):
        strategy = CartaAtributosPStrategy()
        amostras = [0, 1, 0, 0, 1]  # n = 5, 2 defeituosos
        stats = strategy.calcular_estatisticas(amostras)

        assert stats.media_x == pytest.approx(0.4, abs=1e-5)
        assert stats.amplitude_r == 2.0  # d_i contagem de defeituosos
        desvio_esperado = math.sqrt(0.4 * 0.6 / 5)
        assert stats.desvio_s == pytest.approx(desvio_esperado, abs=1e-5)
        assert stats.valores_brutos == (0.0, 1.0, 0.0, 0.0, 1.0)

    def test_calcular_estatisticas_modo_proporcao_direta(self):
        strategy = CartaAtributosPStrategy()
        amostras = [0.25]
        stats = strategy.calcular_estatisticas(amostras)

        assert stats.media_x == pytest.approx(0.25, abs=1e-5)
        assert stats.amplitude_r == pytest.approx(0.25, abs=1e-5)
        assert stats.desvio_s == pytest.approx(math.sqrt(0.25 * 0.75 / 1), abs=1e-5)

    def test_validacao_amostras_invalidas(self):
        strategy = CartaAtributosPStrategy()

        # Vazio
        with pytest.raises(ValueError, match="exige ao menos 1 item"):
            strategy.calcular_estatisticas([])

        # Valor negativo
        with pytest.raises(ValueError, match="intervalo \\[0.0, 1.0\\]"):
            strategy.calcular_estatisticas([0, -1, 1])

        # Valor maior que 1
        with pytest.raises(ValueError, match="intervalo \\[0.0, 1.0\\]"):
            strategy.calcular_estatisticas([0, 1.5, 1])

        # NaN ou Inf
        with pytest.raises(ValueError, match="NaN ou infinito"):
            strategy.calcular_estatisticas([0, float("nan"), 1])

    def test_gabarito_calibracao_carta_p(self):
        """Validação com gabarito exato especificado na seção 6.1 do prompt."""
        payload_p_data = [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
        ]
        strategy = CartaAtributosPStrategy()
        n = 5

        # 1. Proporções por subgrupo (p_i)
        subgrupos_stats = [strategy.calcular_estatisticas(am) for am in payload_p_data]
        p_valores = [s.media_x for s in subgrupos_stats]
        esperado_p = [0.0, 0.2, 0.0, 0.2, 0.0, 0.2, 0.0, 0.2, 0.0, 0.8]
        assert [pytest.approx(p, abs=1e-4) for p in p_valores] == esperado_p

        # 2. Limites de Controle
        limites = strategy.calcular_limites(p_valores, [], n=n)

        # LC = 0.1600
        assert limites.lc == pytest.approx(0.1600, abs=1e-4)
        # sigma_p = sqrt((0.16 * 0.84) / 5) = 0.16395...
        sigma_esperado = math.sqrt((0.16 * 0.84) / 5)
        assert limites.sigma_estimado == pytest.approx(sigma_esperado, abs=1e-4)
        assert limites.sigma_estimado == pytest.approx(0.1640, abs=1e-3)
        # LSC = 0.1600 + 3 * 0.16395 = 0.65185... (0.6519)
        assert limites.lsc == pytest.approx(0.6519, abs=1e-3)
        # LIC = max(0.0, 0.1600 - 3 * 0.16395) = 0.0000
        assert limites.lic == 0.0
        # Dispersão zerada
        assert limites.lc_dispersao == 0.0
        assert limites.lsc_dispersao == 0.0
        assert limites.lic_dispersao == 0.0

        # Invariante LIC <= LC <= LSC
        assert limites.lic <= limites.lc <= limites.lsc

        # 3. Avaliação de Anomalias com Detector
        detector = DetectorRegrasNelson()

        # Subgrupos 1 a 9 estão sob controle
        for i in range(1, 10):
            violacoes = detector.avaliar(
                historico_medias=p_valores[:i],
                limites=limites,
                historico_dispersoes=[s.amplitude_r for s in subgrupos_stats[:i]],
                numero_subgrupo=i,
            )
            assert len(violacoes) == 0, f"Subgrupo {i} não deveria violar regras"

        # Subgrupo 10 (p_10 = 0.8 > 0.6519) deve acusar REGRA_1 e SEM REGRA_1_DISP
        violacoes_10 = detector.avaliar(
            historico_medias=p_valores,
            limites=limites,
            historico_dispersoes=[s.amplitude_r for s in subgrupos_stats],
            numero_subgrupo=10,
        )
        codigos = [v.codigo_regra for v in violacoes_10]
        assert "REGRA_1" in codigos
        assert "REGRA_1_DISP" not in codigos

    def test_truncamento_limites_carta_p(self):
        strategy = CartaAtributosPStrategy()

        # Proporção muito alta: LSC deve ser truncado em 1.0
        limites_alto = strategy.calcular_limites([0.95], [], n=5)
        assert limites_alto.lsc == 1.0
        assert limites_alto.lic <= limites_alto.lc <= limites_alto.lsc

        # Proporção muito baixa: LIC deve ser truncado em 0.0
        limites_baixo = strategy.calcular_limites([0.02], [], n=5)
        assert limites_baixo.lic == 0.0
        assert limites_baixo.lic <= limites_baixo.lc <= limites_baixo.lsc


class TestCartaAtributosC:
    """Testes completos da Carta c (Contagem de Defeitos por Lote - Poisson)."""

    def test_calcular_estatisticas_n1(self):
        strategy = CartaAtributosCStrategy()
        amostras = [4.0]
        stats = strategy.calcular_estatisticas(amostras)

        assert stats.media_x == 4.0
        assert stats.amplitude_r == 0.0
        assert stats.desvio_s == 2.0  # sqrt(4) = 2
        assert stats.valores_brutos == (4.0,)

    def test_calcular_estatisticas_subinspecoes(self):
        strategy = CartaAtributosCStrategy()
        amostras = [1, 0, 2, 1, 0]  # soma = 4
        stats = strategy.calcular_estatisticas(amostras)

        assert stats.media_x == 4.0
        assert stats.amplitude_r == 0.0
        assert stats.desvio_s == 2.0

    def test_validacao_amostras_invalidas(self):
        strategy = CartaAtributosCStrategy()

        # Vazio
        with pytest.raises(ValueError, match="exige ao menos 1 leitura"):
            strategy.calcular_estatisticas([])

        # Negativo
        with pytest.raises(ValueError, match="não pode ser negativa"):
            strategy.calcular_estatisticas([-1])

        # Não inteiro
        with pytest.raises(ValueError, match="devem ser números inteiros"):
            strategy.calcular_estatisticas([4.5])

        # NaN
        with pytest.raises(ValueError, match="NaN ou infinito"):
            strategy.calcular_estatisticas([float("nan")])

    def test_gabarito_calibracao_carta_c(self):
        """Validação com gabarito exato especificado na seção 6.2 do prompt."""
        payload_c_data = [
            [3],
            [4],
            [2],
            [5],
            [3],
            [4],
            [2],
            [3],
            [4],
            [14],
        ]
        strategy = CartaAtributosCStrategy()

        # 1. Contagens por lote (c_i)
        subgrupos_stats = [strategy.calcular_estatisticas(am) for am in payload_c_data]
        c_valores = [s.media_x for s in subgrupos_stats]
        esperado_c = [3.0, 4.0, 2.0, 5.0, 3.0, 4.0, 2.0, 3.0, 4.0, 14.0]
        assert [pytest.approx(c, abs=1e-4) for c in c_valores] == esperado_c

        # 2. Limites de Controle
        limites = strategy.calcular_limites(c_valores, [], n=1)

        # LC = 4.4000
        assert limites.lc == pytest.approx(4.4000, abs=1e-4)
        # sigma_c = sqrt(4.4) = 2.0976...
        sigma_esperado = math.sqrt(4.4)
        assert limites.sigma_estimado == pytest.approx(sigma_esperado, abs=1e-4)
        assert limites.sigma_estimado == pytest.approx(2.0976, abs=1e-3)
        # LSC = 4.4000 + 3 * 2.0976 = 10.6928... (10.6929)
        assert limites.lsc == pytest.approx(10.6929, abs=1e-3)
        # LIC = max(0.0, 4.4000 - 3 * 2.0976) = 0.0000
        assert limites.lic == 0.0
        # Dispersão zerada
        assert limites.lc_dispersao == 0.0
        assert limites.lsc_dispersao == 0.0
        assert limites.lic_dispersao == 0.0

        # Invariante LIC <= LC <= LSC
        assert limites.lic <= limites.lc <= limites.lsc

        # 3. Avaliação de Anomalias com Detector
        detector = DetectorRegrasNelson()

        # Lotes 1 a 9 estão sob controle
        for i in range(1, 10):
            violacoes = detector.avaliar(
                historico_medias=c_valores[:i],
                limites=limites,
                historico_dispersoes=[s.amplitude_r for s in subgrupos_stats[:i]],
                numero_subgrupo=i,
            )
            assert len(violacoes) == 0, f"Lote {i} não deveria violar regras"

        # Lote 10 (c_10 = 14 > 10.6929) deve acusar REGRA_1 e SEM REGRA_1_DISP
        violacoes_10 = detector.avaliar(
            historico_medias=c_valores,
            limites=limites,
            historico_dispersoes=[s.amplitude_r for s in subgrupos_stats],
            numero_subgrupo=10,
        )
        codigos = [v.codigo_regra for v in violacoes_10]
        assert "REGRA_1" in codigos
        assert "REGRA_1_DISP" not in codigos

    def test_truncamento_limites_carta_c(self):
        strategy = CartaAtributosCStrategy()

        # Contagem média baixa (c_barra = 2.0): LIC seria 2 - 3*sqrt(2) = -2.24 -> deve truncar em 0.0
        limites = strategy.calcular_limites([2.0], [], n=1)
        assert limites.lic == 0.0
        assert limites.lic <= limites.lc <= limites.lsc


class TestCartaStrategyFactoryAtributos:
    """Validação da fábrica para estratégias de atributos."""

    def test_fabricar_p(self):
        strategy = CartaStrategyFactory.fabricar("P", 5)
        assert isinstance(strategy, CartaAtributosPStrategy)
        assert strategy.tipo_carta == "P"
        assert strategy.possui_grafico_dispersao is False

        strategy_alias = CartaStrategyFactory.fabricar("CARTA_P")
        assert isinstance(strategy_alias, CartaAtributosPStrategy)

    def test_fabricar_c(self):
        strategy = CartaStrategyFactory.fabricar("C", 1)
        assert isinstance(strategy, CartaAtributosCStrategy)
        assert strategy.tipo_carta == "C"
        assert strategy.possui_grafico_dispersao is False

        strategy_alias = CartaStrategyFactory.fabricar("CARTA_C")
        assert isinstance(strategy_alias, CartaAtributosCStrategy)


class TestEntidadeCartaAtributos:
    """Validação do comportamento agregado da entidade CartaControle com cartas P e C."""

    def test_reavaliacao_retroativa_carta_p(self):
        strategy = CartaAtributosPStrategy()
        carta = CartaControle(
            processo_id=uuid.uuid4(),
            tipo_carta="P",
            tamanho_subgrupo=5,
        )

        dados = [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0],
            [1, 1, 1, 1, 0],
        ]

        for idx, amostra in enumerate(dados, start=1):
            stats = strategy.calcular_estatisticas(amostra)
            sub = Subgrupo(
                carta_id=carta.id,
                numero_subgrupo=idx,
                valores_brutos=amostra,
                estatisticas=stats,
                timestamp=datetime.now(timezone.utc),
            )
            carta.adicionar_subgrupo(sub)

        medias = carta.obter_historico_medias()
        novos_limites = strategy.calcular_limites(medias, [], n=5)
        carta.atualizar_limites(novos_limites)

        detector = DetectorRegrasNelson()
        subgrupos_avaliados = carta.reavaliar_historico_completo(detector)

        assert len(subgrupos_avaliados) == 10
        assert subgrupos_avaliados[-1].fora_de_controle is True
        codigos = [v.codigo_regra for v in subgrupos_avaliados[-1].violacoes]
        assert "REGRA_1" in codigos
        assert "REGRA_1_DISP" not in codigos

    def test_reavaliacao_retroativa_carta_c(self):
        strategy = CartaAtributosCStrategy()
        carta = CartaControle(
            processo_id=uuid.uuid4(),
            tipo_carta="C",
            tamanho_subgrupo=1,
        )

        dados = [[3], [4], [2], [5], [3], [4], [2], [3], [4], [14]]

        for idx, amostra in enumerate(dados, start=1):
            stats = strategy.calcular_estatisticas(amostra)
            sub = Subgrupo(
                carta_id=carta.id,
                numero_subgrupo=idx,
                valores_brutos=amostra,
                estatisticas=stats,
                timestamp=datetime.now(timezone.utc),
            )
            carta.adicionar_subgrupo(sub)

        medias = carta.obter_historico_medias()
        novos_limites = strategy.calcular_limites(medias, [], n=1)
        carta.atualizar_limites(novos_limites)

        detector = DetectorRegrasNelson()
        subgrupos_avaliados = carta.reavaliar_historico_completo(detector)

        assert len(subgrupos_avaliados) == 10
        assert subgrupos_avaliados[-1].fora_de_controle is True
        codigos = [v.codigo_regra for v in subgrupos_avaliados[-1].violacoes]
        assert "REGRA_1" in codigos
        assert "REGRA_1_DISP" not in codigos
