import pytest
from app.domain.value_objects.capacidade import IndicesCapacidade
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.domain.value_objects.violacao import ViolacaoRegra


class TestLimitesControle:
    def test_criacao_limites_valida(self):
        limites = LimitesControle(lc=25.0, lsc=28.0, lic=22.0, sigma_estimado=1.0)
        assert limites.lc == 25.0
        assert limites.lsc == 28.0
        assert limites.lic == 22.0
        assert limites.sigma_estimado == 1.0
        assert limites.amplitude_limites == 3.0
        assert pytest.approx(limites.sigma_media, rel=1e-3) == 1.0

    def test_invariante_lic_maior_que_lc_rejeitada(self):
        with pytest.raises(ValueError, match="Invariante estatística violada"):
            LimitesControle(lc=20.0, lsc=25.0, lic=22.0, sigma_estimado=1.0)

    def test_invariante_lc_maior_que_lsc_rejeitada(self):
        with pytest.raises(ValueError, match="Invariante estatística violada"):
            LimitesControle(lc=30.0, lsc=25.0, lic=20.0, sigma_estimado=1.0)

    def test_sigma_negativo_rejeitado(self):
        with pytest.raises(ValueError, match="Sigma estimado.*não pode ser negativo"):
            LimitesControle(lc=25.0, lsc=28.0, lic=22.0, sigma_estimado=-0.5)


class TestLimitesEspecificacao:
    def test_criacao_especificacao_bilateral_valida(self):
        esp = LimitesEspecificacao(lse=30.0, lie=20.0, valor_nominal=25.0)
        assert esp.lse == 30.0
        assert esp.lie == 20.0
        assert esp.valor_nominal == 25.0

    def test_especificacao_unilateral_valida(self):
        esp_sup = LimitesEspecificacao(lse=30.0)
        assert esp_sup.lse == 30.0
        assert esp_sup.lie is None

        esp_inf = LimitesEspecificacao(lie=20.0)
        assert esp_inf.lie == 20.0
        assert esp_inf.lse is None

    def test_rejeita_ambos_limites_nulos(self):
        with pytest.raises(ValueError, match="Ao menos um dos limites de especificação"):
            LimitesEspecificacao()

    def test_rejeita_lie_maior_ou_igual_ao_lse(self):
        with pytest.raises(ValueError, match="Limite Inferior.*deve ser menor que o Limite Superior"):
            LimitesEspecificacao(lse=20.0, lie=25.0)

    def test_rejeita_valor_nominal_fora_da_faixa(self):
        with pytest.raises(ValueError, match="Valor nominal.*não pode ser superior ao LSE"):
            LimitesEspecificacao(lse=30.0, lie=20.0, valor_nominal=35.0)

        with pytest.raises(ValueError, match="Valor nominal.*não pode ser inferior ao LIE"):
            LimitesEspecificacao(lse=30.0, lie=20.0, valor_nominal=15.0)


class TestEstatisticasSubgrupo:
    def test_estatisticas_validas(self):
        stats = EstatisticasSubgrupo(
            media_x=10.5,
            amplitude_r=2.0,
            desvio_s=0.8,
            valores_brutos=(9.5, 10.5, 11.5),
        )
        assert stats.media_x == 10.5
        assert stats.amplitude_r == 2.0
        assert stats.desvio_s == 0.8
        assert len(stats.valores_brutos) == 3

    def test_rejeita_amplitude_negativa(self):
        with pytest.raises(ValueError, match="Amplitude amostral R.*não pode ser negativa"):
            EstatisticasSubgrupo(media_x=10.0, amplitude_r=-1.0, desvio_s=0.5)

    def test_rejeita_desvio_negativo(self):
        with pytest.raises(ValueError, match="Desvio padrão amostral s.*não pode ser negativo"):
            EstatisticasSubgrupo(media_x=10.0, amplitude_r=1.0, desvio_s=-0.5)


class TestIndicesCapacidade:
    def test_processo_capaz_aprovado(self):
        ind = IndicesCapacidade(cp=1.50, cpk=1.40, cpu=1.45, cpl=1.40)
        assert ind.esta_aprovado(1.33) is True
        assert ind.classificacao == "Capaz / Adequado"

    def test_processo_excelente(self):
        ind = IndicesCapacidade(cp=2.0, cpk=1.80)
        assert ind.classificacao == "Excelente (Seis Sigma)"

    def test_processo_incapaz(self):
        ind = IndicesCapacidade(cp=1.0, cpk=0.85)
        assert ind.esta_aprovado(1.33) is False
        assert ind.classificacao == "Incapaz (Necessita Ação Corretiva)"


class TestViolacaoRegra:
    def test_serializacao_dicionario(self):
        v = ViolacaoRegra(
            codigo_regra="REGRA_1",
            descricao="Ponto além de 3 sigma",
            numero_subgrupo=15,
            pontos_violadores=(15,),
        )
        d = v.to_dict()
        assert d["codigo_regra"] == "REGRA_1"
        assert d["numero_subgrupo"] == 15
        assert d["pontos_violadores"] == [15]
