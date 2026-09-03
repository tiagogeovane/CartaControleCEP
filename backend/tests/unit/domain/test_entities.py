from uuid import uuid4

import pytest
from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.entities.subgrupo import Subgrupo
from app.domain.strategies.base import ICartaControleStrategy
from app.domain.strategies.factory import CartaStrategyFactory
from app.domain.strategies.imr_chart import CartaIMRStrategy
from app.domain.strategies.xr_chart import CartaXRStrategy
from app.domain.strategies.xs_chart import CartaXsStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle
from app.domain.value_objects.violacao import ViolacaoRegra


class TestCartaControleEntity:
    def test_criacao_carta_valida(self):
        processo_id = uuid4()
        carta = CartaControle(
            processo_id=processo_id,
            tipo_carta="X-R",
            tamanho_subgrupo=5,
        )
        assert carta.processo_id == processo_id
        assert carta.tipo_carta == "X_R"
        assert carta.tamanho_subgrupo == 5
        assert carta.total_subgrupos == 0

    def test_validar_amostra_rejeita_tamanho_divergente_rn02(self):
        carta = CartaControle(processo_id=uuid4(), tipo_carta="X-R", tamanho_subgrupo=5)
        # Amostra com 4 medições quando esperado é 5
        with pytest.raises(ValueError, match="Tamanho de amostra divergente: esperado 5, recebido 4"):
            carta.validar_amostra([1.0, 2.0, 3.0, 4.0])

    def test_adicionar_subgrupo_e_historico(self):
        carta = CartaControle(processo_id=uuid4(), tipo_carta="X-R", tamanho_subgrupo=3)
        sub1 = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=1,
            valores_brutos=[10.0, 11.0, 12.0],
            estatisticas=EstatisticasSubgrupo(media_x=11.0, amplitude_r=2.0, desvio_s=1.0),
        )
        sub2 = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=2,
            valores_brutos=[12.0, 13.0, 14.0],
            estatisticas=EstatisticasSubgrupo(media_x=13.0, amplitude_r=2.0, desvio_s=1.0),
        )

        carta.adicionar_subgrupo(sub1)
        carta.adicionar_subgrupo(sub2)

        assert carta.total_subgrupos == 2
        assert carta.obter_historico_medias() == [11.0, 13.0]
        assert carta.obter_historico_dispersoes() == [2.0, 2.0]

    def test_atualizar_limites(self):
        carta = CartaControle(processo_id=uuid4(), tipo_carta="X-R", tamanho_subgrupo=5)
        limites = LimitesControle(lc=10.0, lsc=12.0, lic=8.0, sigma_estimado=0.8)
        carta.atualizar_limites(limites)
        assert carta.limites_atuais == limites

    def test_tamanho_subgrupo_invalido_rejeitado(self):
        with pytest.raises(ValueError, match="Tamanho de subgrupo deve ser >= 1"):
            CartaControle(processo_id=uuid4(), tipo_carta="X_R", tamanho_subgrupo=0)

    def test_obter_historico_dispersoes_tipo_xs(self):
        carta = CartaControle(processo_id=uuid4(), tipo_carta="X_S", tamanho_subgrupo=15)
        sub = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=1,
            valores_brutos=[10.0] * 15,
            estatisticas=EstatisticasSubgrupo(media_x=10.0, amplitude_r=0.0, desvio_s=0.5),
        )
        carta.adicionar_subgrupo(sub)
        assert carta.obter_historico_dispersoes() == [0.5]

    def test_obter_historico_dispersoes_tipo_imr(self):
        carta = CartaControle(processo_id=uuid4(), tipo_carta="I_MR", tamanho_subgrupo=1)
        sub1 = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=1,
            valores_brutos=[10.0],
            estatisticas=EstatisticasSubgrupo(media_x=10.0, amplitude_r=0.0, desvio_s=0.0),
        )
        sub2 = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=2,
            valores_brutos=[12.5],
            estatisticas=EstatisticasSubgrupo(media_x=12.5, amplitude_r=0.0, desvio_s=0.0),
        )
        sub3 = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=3,
            valores_brutos=[9.0],
            estatisticas=EstatisticasSubgrupo(media_x=9.0, amplitude_r=0.0, desvio_s=0.0),
        )
        carta.adicionar_subgrupo(sub1)
        carta.adicionar_subgrupo(sub2)
        carta.adicionar_subgrupo(sub3)

        # Amplitudes móveis: |12.5 - 10.0| = 2.5, |9.0 - 12.5| = 3.5
        assert carta.obter_historico_dispersoes() == [2.5, 3.5]


    def test_obter_ultimas_medias(self):
        carta = CartaControle(processo_id=uuid4(), tipo_carta="X_R", tamanho_subgrupo=3)
        for i in range(1, 6):
            carta.adicionar_subgrupo(
                Subgrupo(
                    carta_id=carta.id,
                    numero_subgrupo=i,
                    valores_brutos=[float(i), float(i), float(i)],
                    estatisticas=EstatisticasSubgrupo(media_x=float(i), amplitude_r=0.0, desvio_s=0.0),
                )
            )
        assert carta.obter_ultimas_medias(3) == [3.0, 4.0, 5.0]
        assert carta.obter_ultimas_medias(10) == [1.0, 2.0, 3.0, 4.0, 5.0]


class TestSubgrupoEntity:
    def test_subgrupo_marca_fora_de_controle_com_violacao(self):
        carta_id = uuid4()
        sub = Subgrupo(
            carta_id=carta_id,
            numero_subgrupo=1,
            valores_brutos=[1.0, 2.0],
            estatisticas=EstatisticasSubgrupo(media_x=1.5, amplitude_r=1.0, desvio_s=0.7),
        )
        assert sub.fora_de_controle is False

        sub.adicionar_violacao(
            ViolacaoRegra(
                codigo_regra="REGRA_1",
                descricao="Além de 3 sigma",
                numero_subgrupo=1,
                pontos_violadores=(1,),
            )
        )
        assert sub.fora_de_controle is True
        assert len(sub.violacoes) == 1

    def test_subgrupo_to_dict(self):
        sub = Subgrupo(
            carta_id=uuid4(),
            numero_subgrupo=5,
            valores_brutos=[10.0, 12.0],
            estatisticas=EstatisticasSubgrupo(media_x=11.0, amplitude_r=2.0, desvio_s=1.41),
        )
        d = sub.to_dict()
        assert d["numero_subgrupo"] == 5
        assert d["media_x"] == 11.0
        assert d["amplitude_r"] == 2.0

    def test_subgrupo_validacoes_invariantes(self):
        carta_id = uuid4()
        est = EstatisticasSubgrupo(media_x=10.0, amplitude_r=1.0, desvio_s=0.5)
        with pytest.raises(ValueError, match="Número do subgrupo deve ser >= 1"):
            Subgrupo(carta_id=carta_id, numero_subgrupo=0, valores_brutos=[10.0], estatisticas=est)

        with pytest.raises(ValueError, match="Subgrupo não pode ter valores brutos vazios"):
            Subgrupo(carta_id=carta_id, numero_subgrupo=1, valores_brutos=[], estatisticas=est)

    def test_subgrupo_com_violacoes_iniciais(self):
        carta_id = uuid4()
        v = ViolacaoRegra(codigo_regra="REGRA_1", descricao="Fora 3s", numero_subgrupo=1, pontos_violadores=(1,))
        sub = Subgrupo(
            carta_id=carta_id,
            numero_subgrupo=1,
            valores_brutos=[10.0, 12.0],
            estatisticas=EstatisticasSubgrupo(media_x=11.0, amplitude_r=2.0, desvio_s=1.0),
            violacoes=[v],
        )
        assert sub.fora_de_controle is True
        assert len(sub.violacoes) == 1

    def test_subgrupo_adicionar_violacoes_em_lote(self):
        carta_id = uuid4()
        sub = Subgrupo(
            carta_id=carta_id,
            numero_subgrupo=1,
            valores_brutos=[10.0, 12.0],
            estatisticas=EstatisticasSubgrupo(media_x=11.0, amplitude_r=2.0, desvio_s=1.0),
        )
        assert sub.fora_de_controle is False
        v1 = ViolacaoRegra(codigo_regra="REGRA_1", descricao="Fora 3s", numero_subgrupo=1, pontos_violadores=(1,))
        v2 = ViolacaoRegra(codigo_regra="REGRA_2", descricao="9 lado", numero_subgrupo=1, pontos_violadores=(1,))
        sub.adicionar_violacoes([v1, v2])
        assert sub.fora_de_controle is True
        assert len(sub.violacoes) == 2
        # Chamada com lista vazia não altera estado
        sub.adicionar_violacoes([])
        assert len(sub.violacoes) == 2


class TestProcessoEntity:
    def test_processo_valido(self):
        proc = Processo(nome="Linha de Usinagem 01", codigo_linha="L-01")
        assert proc.nome == "Linha de Usinagem 01"
        assert proc.codigo_linha == "L-01"

    def test_rejeita_campos_vazios(self):
        with pytest.raises(ValueError, match="nome do processo é obrigatório"):
            Processo(nome="   ", codigo_linha="L-01")
        with pytest.raises(ValueError, match="código da linha de produção é obrigatório"):
            Processo(nome="Linha A", codigo_linha="")


class TestCartaStrategyFactory:
    def test_fabricacao_explicita(self):
        assert isinstance(CartaStrategyFactory.fabricar("X-R", 5), CartaXRStrategy)
        assert isinstance(CartaStrategyFactory.fabricar("X-S", 15), CartaXsStrategy)
        assert isinstance(CartaStrategyFactory.fabricar("I-MR", 1), CartaIMRStrategy)

    def test_fabricacao_automatica_rn01(self):
        # n = 1 -> I-MR
        assert isinstance(CartaStrategyFactory.fabricar(tamanho_subgrupo=1), CartaIMRStrategy)
        # n <= 10 -> X-R
        assert isinstance(CartaStrategyFactory.fabricar(tamanho_subgrupo=5), CartaXRStrategy)
        assert isinstance(CartaStrategyFactory.fabricar(tamanho_subgrupo=10), CartaXRStrategy)
        # n > 10 -> X-s
        assert isinstance(CartaStrategyFactory.fabricar(tamanho_subgrupo=15), CartaXsStrategy)

    def test_resolver_por_tamanho_direto(self):
        assert isinstance(CartaStrategyFactory.resolver_por_tamanho(1), CartaIMRStrategy)
        assert isinstance(CartaStrategyFactory.resolver_por_tamanho(5), CartaXRStrategy)
        assert isinstance(CartaStrategyFactory.resolver_por_tamanho(10), CartaXRStrategy)
        assert isinstance(CartaStrategyFactory.resolver_por_tamanho(15), CartaXsStrategy)
        with pytest.raises(ValueError, match="Tamanho de subgrupo deve ser >= 1"):
            CartaStrategyFactory.resolver_por_tamanho(0)

    def test_transicao_xr_para_xs_quando_n_maior_que_10(self):
        # Se tipo for X-R mas n > 10, transiciona para X-s
        assert isinstance(CartaStrategyFactory.fabricar("X-R", 12), CartaXsStrategy)

    def test_transicao_para_imr_quando_n_igual_a_1(self):
        # RN01: n = 1 em cartas por variáveis transiciona para I-MR
        assert isinstance(CartaStrategyFactory.fabricar("X-R", 1), CartaIMRStrategy)
        assert isinstance(CartaStrategyFactory.fabricar("X-S", 1), CartaIMRStrategy)


    def test_rejeita_tipo_nao_registrado(self):
        with pytest.raises(ValueError, match="Tipo de carta de controle não registrado: 'CARTA_DESCONHECIDA'"):
            CartaStrategyFactory.fabricar("CARTA_DESCONHECIDA", 5)

    def test_registrar_nova_estrategia_direto_e_desregistrar(self):
        class MockCustomStrategy(ICartaControleStrategy):
            def calcular_estatisticas(self, amostras):
                raise NotImplementedError

            def calcular_limites(self, h_m, h_d, n):
                raise NotImplementedError

        CartaStrategyFactory.registrar("CUSTOM_P", MockCustomStrategy)
        assert "CUSTOM_P" in CartaStrategyFactory.obter_estrategias_registradas()
        assert isinstance(CartaStrategyFactory.fabricar("CUSTOM_P", 5), MockCustomStrategy)

        removido = CartaStrategyFactory.desregistrar("CUSTOM_P")
        assert removido is True
        assert "CUSTOM_P" not in CartaStrategyFactory.obter_estrategias_registradas()

    def test_registrar_nova_estrategia_decorador(self):
        @CartaStrategyFactory.registrar("CUSTOM_DECORATED")
        class MockDecoratedStrategy(ICartaControleStrategy):
            def calcular_estatisticas(self, amostras):
                raise NotImplementedError

            def calcular_limites(self, h_m, h_d, n):
                raise NotImplementedError

        assert "CUSTOM_DECORATED" in CartaStrategyFactory.obter_estrategias_registradas()
        assert isinstance(CartaStrategyFactory.fabricar("custom-decorated", 3), MockDecoratedStrategy)
        CartaStrategyFactory.desregistrar("CUSTOM_DECORATED")
