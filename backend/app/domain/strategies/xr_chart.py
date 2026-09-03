from collections.abc import Sequence
from typing import ClassVar

import numpy as np

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class CartaXRStrategy(ICartaControleStrategy):
    """Estratégia de cálculo para Cartas de Médias e Amplitudes (X-barra e R).

    Indicada primariamente para subgrupos amostrais pequenos (2 <= n <= 10).
    Utiliza fatores de correção empíricos baseados na amplitude amostral (R).
    """

    # Fatores normalizados da distribuição normal (Montgomery, 8ª ed.)
    A2_TABLE: ClassVar[dict[int, float]] = {
        2: 1.880,
        3: 1.023,
        4: 0.729,
        5: 0.577,
        6: 0.483,
        7: 0.419,
        8: 0.373,
        9: 0.337,
        10: 0.308,
        11: 0.285,
        12: 0.266,
        13: 0.249,
        14: 0.235,
        15: 0.223,
    }

    D3_TABLE: ClassVar[dict[int, float]] = {
        2: 0.0,
        3: 0.0,
        4: 0.0,
        5: 0.0,
        6: 0.0,
        7: 0.076,
        8: 0.136,
        9: 0.184,
        10: 0.223,
        11: 0.256,
        12: 0.283,
        13: 0.307,
        14: 0.328,
        15: 0.347,
    }

    D4_TABLE: ClassVar[dict[int, float]] = {
        2: 3.267,
        3: 2.574,
        4: 2.282,
        5: 2.114,
        6: 2.004,
        7: 1.924,
        8: 1.864,
        9: 1.816,
        10: 1.777,
        11: 1.744,
        12: 1.717,
        13: 1.693,
        14: 1.672,
        15: 1.653,
    }

    D2_TABLE: ClassVar[dict[int, float]] = {
        2: 1.128,
        3: 1.693,
        4: 2.059,
        5: 2.326,
        6: 2.534,
        7: 2.704,
        8: 2.847,
        9: 2.970,
        10: 3.078,
        11: 3.173,
        12: 3.258,
        13: 3.336,
        14: 3.407,
        15: 3.472,
    }

    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Calcula a média, a amplitude e o desvio padrão de um subgrupo."""
        if len(amostras) < 2:
            raise ValueError(
                f"Carta X-barra e R exige ao menos 2 medições por subgrupo (recebido: {len(amostras)})."
            )

        arr = np.array(amostras, dtype=np.float64)
        media = float(np.mean(arr))
        amplitude = float(np.ptp(arr))  # Max - Min
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
        """Calcula os limites LSC, LC, LIC para a carta de médias através de A2 e d2."""
        if not historico_medias or not historico_dispersoes:
            raise ValueError("Histórico de médias e dispersões não pode estar vazio para cálculo de limites.")

        if len(historico_medias) != len(historico_dispersoes):
            raise ValueError(
                f"Tamanhos divergentes no histórico: médias ({len(historico_medias)}) vs dispersões ({len(historico_dispersoes)})."
            )

        if n < 2:
            raise ValueError(f"Tamanho de subgrupo n={n} inválido para carta X-R. Requer n >= 2.")

        a2 = self.A2_TABLE.get(n)
        d2 = self.D2_TABLE.get(n)

        if a2 is None or d2 is None:
            raise ValueError(
                f"Tamanho de subgrupo n={n} não possui constantes tabeladas para Carta X-R (suportado até n=15)."
            )

        x_dupla_barra = float(np.mean(historico_medias))
        r_barra = float(np.mean(historico_dispersoes))

        lsc = x_dupla_barra + (a2 * r_barra)
        lic = x_dupla_barra - (a2 * r_barra)
        sigma = r_barra / d2 if d2 > 0 else 0.0

        return LimitesControle(
            lc=x_dupla_barra,
            lsc=lsc,
            lic=lic,
            sigma_estimado=sigma,
        )

    def calcular_limites_amplitude(
        self,
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> tuple[float, float, float]:
        """Retorna os limites da carta R auxiliar: (LIC_R, LC_R, LSC_R)."""
        if not historico_dispersoes:
            raise ValueError("Histórico de dispersões não pode estar vazio.")

        d3 = self.D3_TABLE.get(n, 0.0)
        d4 = self.D4_TABLE.get(n, 0.0)

        r_barra = float(np.mean(historico_dispersoes))
        lic_r = d3 * r_barra
        lsc_r = d4 * r_barra
        return lic_r, r_barra, lsc_r
