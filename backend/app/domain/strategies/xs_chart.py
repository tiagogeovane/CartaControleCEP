import math
from collections.abc import Sequence

import numpy as np
from scipy.special import gamma

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class CartaXsStrategy(ICartaControleStrategy):
    """Estratégia de cálculo para Cartas de Médias e Desvios Padrão (X-barra e s).

    Recomendada para subgrupos de tamanho moderado a grande (n > 10),
    onde o desvio padrão amostral 's' é um estimador de variabilidade mais eficiente que 'R'.
    """

    @staticmethod
    def calcular_c4(n: int) -> float:
        """Calcula o coeficiente exato c4(n) via função Gamma ou aproximação assintótica."""
        if n < 2:
            raise ValueError(f"Fator c4 requer n >= 2 (recebido: {n}).")
        if n > 100:
            # Aproximação assintótica clássica para grandes amostras
            return float(4.0 * (n - 1) / (4.0 * n - 3))
        # Cálculo analítico exato via função Gamma
        return float(math.sqrt(2.0 / (n - 1)) * (gamma(n / 2.0) / gamma((n - 1) / 2.0)))

    @classmethod
    def calcular_a3(cls, n: int) -> float:
        """Calcula a constante A3 = 3 / (c4 * sqrt(n))."""
        c4 = cls.calcular_c4(n)
        return float(3.0 / (c4 * math.sqrt(n)))

    @classmethod
    def calcular_b3_b4(cls, n: int) -> tuple[float, float]:
        """Calcula as constantes B3 e B4 para a carta de desvio padrão 's'."""
        c4 = cls.calcular_c4(n)
        termo_dispersao = (3.0 / c4) * math.sqrt(max(0.0, 1.0 - c4**2))
        b3 = max(0.0, 1.0 - termo_dispersao)
        b4 = 1.0 + termo_dispersao
        return float(b3), float(b4)

    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Calcula média, amplitude e desvio padrão amostral s."""
        if len(amostras) < 2:
            raise ValueError(
                f"Carta X-barra e s exige ao menos 2 medições por subgrupo (recebido: {len(amostras)})."
            )

        arr = np.array(amostras, dtype=np.float64)
        media = float(np.mean(arr))
        amplitude = float(np.ptp(arr))
        desvio = float(np.std(arr, ddof=1))

        return EstatisticasSubgrupo(
            media_x=media,
            amplitude_r=amplitude,
            desvio_s=desvio,
            valores_brutos=tuple(amostras),
        )

    def calcular_limites(
        self,
        historico_medias: Sequence[float],
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> LimitesControle:
        """Calcula os limites LSC, LC, LIC para a carta de médias através de A3 e c4."""
        if not historico_medias or not historico_dispersoes:
            raise ValueError("Histórico de médias e dispersões não pode estar vazio.")

        if len(historico_medias) != len(historico_dispersoes):
            raise ValueError("Tamanhos divergentes entre histórico de médias e desvios.")

        if n < 2:
            raise ValueError(f"Tamanho de subgrupo n={n} inválido. Requer n >= 2.")

        a3 = self.calcular_a3(n)
        c4 = self.calcular_c4(n)

        x_dupla_barra = float(np.mean(historico_medias))
        s_barra = float(np.mean(historico_dispersoes))

        lsc = x_dupla_barra + (a3 * s_barra)
        lic = x_dupla_barra - (a3 * s_barra)
        sigma = s_barra / c4 if c4 > 0 else 0.0

        return LimitesControle(
            lc=x_dupla_barra,
            lsc=lsc,
            lic=lic,
            sigma_estimado=sigma,
        )

    def calcular_limites_desvio(
        self,
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> tuple[float, float, float]:
        """Retorna os limites da carta s auxiliar: (LIC_s, LC_s, LSC_s)."""
        if not historico_dispersoes:
            raise ValueError("Histórico de dispersões não pode estar vazio.")

        b3, b4 = self.calcular_b3_b4(n)
        s_barra = float(np.mean(historico_dispersoes))
        lic_s = b3 * s_barra
        lsc_s = b4 * s_barra
        return lic_s, s_barra, lsc_s
