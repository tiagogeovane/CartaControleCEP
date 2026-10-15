from collections.abc import Sequence

import numpy as np

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class CartaIMRStrategy(ICartaControleStrategy):
    """Estratégia de cálculo para Cartas de Leituras Individuais e Amplitude Móvel (I-MR).

    Utilizada quando o tamanho amostral é unitário (n = 1), comum em processos químicos,
    medições contínuas automatizadas ou testes destrutivos de alto custo.
    """

    tipo_carta: str = "I_MR"
    nome_carta: str = "I-MR (Valores Individuais e Amplitude Móvel)"
    nome_posicao: str = "Carta de Valores Individuais (X)"
    nome_dispersao: str = "Carta de Amplitude Móvel (MR)"
    rotulo_posicao: str = "Valor Individual (X)"
    rotulo_dispersao: str = "Amplitude Móvel (MR)"
    sigla_dispersao: str = "MR"


    D2_N2: float = 1.128  # d2 para n=2 (janela da amplitude móvel)
    D4_N2: float = 3.267  # D4 para n=2
    D3_N2: float = 0.0    # D3 para n=2

    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Para n=1, a estatística pontual do subgrupo é o próprio valor da medição."""
        if len(amostras) != 1:
            raise ValueError(
                f"Carta I-MR exige exatamente 1 medição unitária por ponto (recebido: {len(amostras)})."
            )

        valor = float(amostras[0])
        return EstatisticasSubgrupo(
            media_x=valor,
            amplitude_r=0.0,
            desvio_s=0.0,
            valores_brutos=tuple(amostras),
        )

    def calcular_amplitudes_moveis(self, observacoes: Sequence[float]) -> list[float]:
        """Calcula a série de amplitudes móveis: MR_i = |x_i - x_{i-1}| para i >= 1."""
        if len(observacoes) < 2:
            return []
        return [abs(observacoes[i] - observacoes[i - 1]) for i in range(1, len(observacoes))]

    def calcular_limites(
        self,
        historico_medias: Sequence[float],
        historico_dispersoes: Sequence[float],
        n: int = 1,
    ) -> LimitesControle:
        """Calcula limites LSC, LC, LIC para cartas I-MR a partir das amplitudes móveis."""
        if len(historico_medias) < 2:
            raise ValueError(
                "Carta I-MR requer no mínimo 2 observações para calcular a amplitude móvel e os limites."
            )

        # Se dispersões foram passadas, utiliza; senão recalcula amplitudes móveis das médias
        if historico_dispersoes and len(historico_dispersoes) > 0:
            mr_barra = float(np.mean(historico_dispersoes))
        else:
            mrs = self.calcular_amplitudes_moveis(historico_medias)
            mr_barra = float(np.mean(mrs))

        x_barra = float(np.mean(historico_medias))
        fator_mr = 3.0 / self.D2_N2  # ~ 2.6596

        lsc = x_barra + (fator_mr * mr_barra)
        lic = x_barra - (fator_mr * mr_barra)
        sigma = mr_barra / self.D2_N2
        lic_mr, lc_mr, lsc_mr = self.calcular_limites_mr(mr_barra)

        return LimitesControle(
            lc=x_barra,
            lsc=lsc,
            lic=lic,
            sigma_estimado=sigma,
            lc_dispersao=lc_mr,
            lsc_dispersao=lsc_mr,
            lic_dispersao=lic_mr,
        )

    def calcular_limites_mr(self, mr_barra: float) -> tuple[float, float, float]:
        """Retorna os limites da carta MR auxiliar: (LIC_MR, LC_MR, LSC_MR)."""
        lic_mr = self.D3_N2 * mr_barra
        lsc_mr = self.D4_N2 * mr_barra
        return lic_mr, mr_barra, lsc_mr

    def calcular_limites_dispersao(
        self,
        historico_dispersoes: Sequence[float],
        n: int = 1,
    ) -> tuple[float, float, float]:
        """Calcula os limites da carta MR auxiliar: (LIC_MR, LC_MR, LSC_MR)."""
        if not historico_dispersoes:
            raise ValueError("Histórico de dispersões não pode estar vazio.")
        mr_barra = float(np.mean(historico_dispersoes))
        return self.calcular_limites_mr(mr_barra)

