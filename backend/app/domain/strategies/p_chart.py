import math
from collections.abc import Sequence

import numpy as np

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class CartaAtributosPStrategy(ICartaControleStrategy):
    """Estratégia de cálculo para Carta p (Proporção de Itens Defeituosos).

    Baseada na Distribuição Binomial. Cada amostra no subgrupo de tamanho n
    assume valor 0 (bom/conforme) ou 1 (ruim/defeituoso), ou proporção direta em [0, 1].
    """

    tipo_carta: str = "P"
    nome_carta: str = "Carta p (Proporção de Defeituosos)"
    nome_posicao: str = "Carta p (Proporção de Não-Conformes)"
    nome_dispersao: str = "N/A (Atributo Binomial)"
    rotulo_posicao: str = "Proporção de Defeituosos (p)"
    rotulo_dispersao: str = "Contagem de Defeituosos (d)"
    sigla_dispersao: str = "d"
    possui_grafico_dispersao: bool = False

    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Calcula a proporção p_i de itens defeituosos no subgrupo."""
        if len(amostras) < 1:
            raise ValueError("Carta p exige ao menos 1 item inspecionado no subgrupo.")

        arr = np.asarray(amostras, dtype=np.float64)
        if not np.all(np.isfinite(arr)):
            raise ValueError("As amostras contêm valores inválidos (NaN ou infinito).")

        if np.any((arr < 0.0) | (arr > 1.0)):
            raise ValueError(
                "Na Carta p, cada amostra deve ser 0 (bom) ou 1 (ruim), no intervalo [0.0, 1.0]."
            )

        n = len(arr)
        proporcao_p = float(np.mean(arr))
        contagem_defeituosos = float(np.sum(arr))
        desvio_binomial = float(math.sqrt(max(0.0, proporcao_p * (1.0 - proporcao_p)) / n))

        return EstatisticasSubgrupo(
            media_x=proporcao_p,
            amplitude_r=contagem_defeituosos,
            desvio_s=desvio_binomial,
            valores_brutos=tuple(float(x) for x in arr),
        )

    def calcular_limites(
        self,
        historico_medias: Sequence[float],
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> LimitesControle:
        """Calcula os limites LSC_p, LC_p e LIC_p pela distribuição Binomial."""
        if not historico_medias:
            raise ValueError("Histórico de proporções (p) não pode estar vazio.")

        if n < 1:
            raise ValueError(f"Tamanho de subgrupo n={n} inválido para Carta p. Requer n >= 1.")

        p_barra = float(np.mean(historico_medias))
        p_barra = min(1.0, max(0.0, p_barra))

        sigma_p = float(math.sqrt((p_barra * (1.0 - p_barra)) / n))
        lsc = min(1.0, p_barra + (3.0 * sigma_p))
        lic = max(0.0, p_barra - (3.0 * sigma_p))

        return LimitesControle(
            lc=p_barra,
            lsc=lsc,
            lic=lic,
            sigma_estimado=sigma_p,
            lc_dispersao=0.0,
            lsc_dispersao=0.0,
            lic_dispersao=0.0,
        )

    def calcular_limites_dispersao(
        self,
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> tuple[float, float, float]:
        """Carta p não utiliza gráfico secundário de dispersão."""
        return 0.0, 0.0, 0.0
