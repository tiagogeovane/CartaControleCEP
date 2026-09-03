import pytest
from app.domain.services.capacidade import CalculadorCapacidade
from app.domain.value_objects.limites import LimitesEspecificacao


class TestCalculadorCapacidade:
    def test_calculo_processo_perfeitamente_centralizado(self):
        # Media = 10.0, Sigma = 1.0, Tolerancia = [7.0, 13.0]
        # Cp = (13 - 7) / 6 = 1.0
        # Cpu = (13 - 10) / 3 = 1.0, Cpl = (10 - 7) / 3 = 1.0 -> Cpk = 1.0
        esp = LimitesEspecificacao(lse=13.0, lie=7.0, valor_nominal=10.0)
        res = CalculadorCapacidade.calcular(media_processo=10.0, sigma_estimado=1.0, especificacoes=esp)

        assert res.cp == 1.0
        assert res.cpk == 1.0
        assert res.cpu == 1.0
        assert res.cpl == 1.0
        assert res.esta_aprovado(1.0) is True

    def test_calculo_processo_deslocado_cp_maior_que_cpk(self):
        # Media = 12.0 (deslocada para perto do LSE), Sigma = 1.0, LSE = 14.0, LIE = 8.0
        # Cp = (14 - 8) / 6 = 1.0
        # Cpu = (14 - 12) / 3 = 0.6667
        # Cpl = (12 - 8) / 3 = 1.3333
        # Cpk = min(0.6667, 1.3333) = 0.6667
        esp = LimitesEspecificacao(lse=14.0, lie=8.0)
        res = CalculadorCapacidade.calcular(media_processo=12.0, sigma_estimado=1.0, especificacoes=esp)

        assert res.cp == 1.0
        assert pytest.approx(res.cpk, abs=1e-4) == 0.6667
        assert pytest.approx(res.cpu, abs=1e-4) == 0.6667
        assert pytest.approx(res.cpl, abs=1e-4) == 1.3333

    def test_especificacao_unilateral_superior(self):
        esp = LimitesEspecificacao(lse=100.0)
        res = CalculadorCapacidade.calcular(media_processo=85.0, sigma_estimado=5.0, especificacoes=esp)

        # Cp é None (não há LIE)
        # Cpu = (100 - 85) / 15 = 1.0
        # Cpk = Cpu = 1.0
        assert res.cp is None
        assert res.cpk == 1.0
        assert res.cpu == 1.0
        assert res.cpl is None

    def test_rejeita_sigma_zero_ou_negativo(self):
        esp = LimitesEspecificacao(lse=20.0, lie=10.0)
        with pytest.raises(ValueError, match="estritamente positivo"):
            CalculadorCapacidade.calcular(media_processo=15.0, sigma_estimado=0.0, especificacoes=esp)

    def test_especificacao_unilateral_inferior(self):
        esp = LimitesEspecificacao(lie=50.0)
        res = CalculadorCapacidade.calcular(media_processo=65.0, sigma_estimado=5.0, especificacoes=esp)

        # Cp e Cpu são None (não há LSE)
        # Cpl = (65 - 50) / 15 = 1.0
        # Cpk = Cpl = 1.0
        assert res.cp is None
        assert res.cpu is None
        assert res.cpl == 1.0
        assert res.cpk == 1.0

    def test_indices_capacidade_casos_especiais(self):
        from app.domain.value_objects.capacidade import IndicesCapacidade

        ind_nulo = IndicesCapacidade()
        assert ind_nulo.esta_aprovado() is False
        assert ind_nulo.classificacao == "Indeterminado"

        ind_marginal = IndicesCapacidade(cpk=1.15)
        assert ind_marginal.classificacao == "Marginalmente Capaz"
