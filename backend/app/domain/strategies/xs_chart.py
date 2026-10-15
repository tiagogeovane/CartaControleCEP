import math
from collections.abc import Sequence

import numpy as np

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class CartaXsStrategy(ICartaControleStrategy):
    """Estratégia de cálculo para Cartas de Médias e Desvios Padrão (X-barra e s).

    Recomendada para subgrupos de tamanho moderado a grande (n > 10),
    onde o desvio padrão amostral 's' é um estimador de variabilidade mais eficiente que 'R'.
    """

    tipo_carta: str = "X_S"
    nome_carta: str = "X-barra e s"
    nome_posicao: str = "Carta X-barra (Médias)"
    nome_dispersao: str = "Carta s (Desvios Padrão)"
    rotulo_posicao: str = "Média do Subgrupo (X̄)"
    rotulo_dispersao: str = "Desvio Padrão (s)"
    sigla_dispersao: str = "s"

    @staticmethod
    def calcular_c4(n: int) -> float:
        """Calcula o coeficiente exato c4(n) via log-Gamma (sem overflow e sem Scipy)."""
        if n < 2:
            raise ValueError(f"Fator c4 requer n >= 2 (recebido: {n}).")
        
        log_c4 = (
            0.5 * math.log(2.0 / (n - 1))
            + math.lgamma(n / 2.0)
            - math.lgamma((n - 1) / 2.0)
        )
        return float(math.exp(log_c4))

    @classmethod
    def calcular_a3(cls, n: int, c4: float | None = None) -> float:
        """Calcula a constante A3 = 3 / (c4 * sqrt(n))."""
        fator_c4 = c4 if c4 is not None else cls.calcular_c4(n)
        return float(3.0 / (fator_c4 * math.sqrt(n)))

    @classmethod
    def calcular_b3_b4(cls, n: int, c4: float | None = None) -> tuple[float, float]:
        """Calcula as constantes B3 e B4 para a carta de desvio padrão 's'."""
        fator_c4 = c4 if c4 is not None else cls.calcular_c4(n)
        termo_dispersao = (3.0 / fator_c4) * math.sqrt(max(0.0, 1.0 - fator_c4**2))
        b3 = max(0.0, 1.0 - termo_dispersao)
        b4 = 1.0 + termo_dispersao
        return float(b3), float(b4)

    def obter_valor_dispersao(self, estatisticas: EstatisticasSubgrupo) -> float:
        """Extrai polimorficamente o desvio padrão (s) como métrica de dispersão."""
        return estatisticas.desvio_s

    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Calcula média, amplitude e desvio padrão amostral s."""
        if len(amostras) < 2:
            raise ValueError(
                f"Carta X-barra e s exige ao menos 2 medições por subgrupo (recebido: {len(amostras)})."
            )

        arr = np.asarray(amostras, dtype=np.float64)
        if not np.all(np.isfinite(arr)):
            raise ValueError("As amostras contêm valores inválidos (NaN ou infinito).")

        media = float(np.mean(arr))
        amplitude = float(np.ptp(arr))
        desvio = float(np.std(arr, ddof=1))

        return EstatisticasSubgrupo(
            media_x=media,
            amplitude_r=amplitude,
            desvio_s=desvio,
            valores_brutos=tuple(float(x) for x in arr),
        )

    def calcular_limites(
        self,
        historico_medias: Sequence[float],
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> LimitesControle:
        """Calcula os limites LSC, LC, LIC para a carta de médias e de desvio padrão."""
        if not historico_medias or not historico_dispersoes:
            raise ValueError("Histórico de médias e dispersões não pode estar vazio.")

        if len(historico_medias) != len(historico_dispersoes):
            raise ValueError("Tamanhos divergentes entre histórico de médias e desvios.")

        if n < 2:
            raise ValueError(f"Tamanho de subgrupo n={n} inválido. Requer n >= 2.")

        c4 = self.calcular_c4(n)
        a3 = self.calcular_a3(n, c4=c4)
        b3, b4 = self.calcular_b3_b4(n, c4=c4)

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
            lc_dispersao=s_barra,
            lsc_dispersao=b4 * s_barra,
            lic_dispersao=b3 * s_barra,
        )

    def calcular_limites_dispersao(
        self,
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> tuple[float, float, float]:
        """Calcula os limites da carta s auxiliar: (LIC_s, LC_s, LSC_s)."""
        if not historico_dispersoes:
            raise ValueError("Histórico de dispersões não pode estar vazio.")

        b3, b4 = self.calcular_b3_b4(n)
        s_barra = float(np.mean(historico_dispersoes))
        return b3 * s_barra, s_barra, b4 * s_barra

    def calcular_limites_desvio(
        self,
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> tuple[float, float, float]:
        """Alias para manter compatibilidade com chamadas legadas."""
        return self.calcular_limites_dispersao(historico_dispersoes, n)