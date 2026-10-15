import math
from collections.abc import Sequence

import numpy as np

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class CartaAtributosCStrategy(ICartaControleStrategy):
    """Estratégia de cálculo para Carta c (Quantidade de Defeitos por Lote).

    Baseada na Distribuição de Poisson. Modela o número total de defeitos (c)
    encontrados em um lote ou unidade de inspeção constante.
    """

    tipo_carta: str = "C"
    nome_carta: str = "Carta c (Contagem de Defeitos por Lote)"
    nome_posicao: str = "Carta c (Quantidade de Defeitos)"
    nome_dispersao: str = "N/A (Atributo Poisson)"
    rotulo_posicao: str = "Quantidade de Defeitos (c)"
    rotulo_dispersao: str = "N/A"
    sigla_dispersao: str = "c"
    possui_grafico_dispersao: bool = False

    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Calcula o total de defeitos c_i registrados no lote inspecionado."""
        if len(amostras) < 1:
            raise ValueError("Carta c exige ao menos 1 leitura de contagem por lote.")

        arr = np.asarray(amostras, dtype=np.float64)
        if not np.all(np.isfinite(arr)):
            raise ValueError("As amostras contêm valores inválidos (NaN ou infinito).")

        if np.any(arr < 0.0):
            raise ValueError("Na Carta c, a quantidade de defeitos não pode ser negativa.")

        if not np.all(np.equal(np.mod(arr, 1), 0)):
            raise ValueError("Na Carta c, as contagens de defeitos devem ser números inteiros.")

        contagem_c = float(np.sum(arr))
        desvio_poisson = float(math.sqrt(contagem_c))

        return EstatisticasSubgrupo(
            media_x=contagem_c,
            amplitude_r=0.0,
            desvio_s=desvio_poisson,
            valores_brutos=tuple(float(x) for x in arr),
        )

    def calcular_limites(
        self,
        historico_medias: Sequence[float],
        historico_dispersoes: Sequence[float],
        n: int = 1,
    ) -> LimitesControle:
        """Calcula os limites LSC_c, LC_c e LIC_c pela distribuição de Poisson."""
        if not historico_medias:
            raise ValueError("Histórico de contagens (c) não pode estar vazio.")

        c_barra = max(0.0, float(np.mean(historico_medias)))
        sigma_c = float(math.sqrt(c_barra))

        lsc = c_barra + (3.0 * sigma_c)
        lic = max(0.0, c_barra - (3.0 * sigma_c))

        return LimitesControle(
            lc=c_barra,
            lsc=lsc,
            lic=lic,
            sigma_estimado=sigma_c,
            lc_dispersao=0.0,
            lsc_dispersao=0.0,
            lic_dispersao=0.0,
        )

    def calcular_limites_dispersao(
        self,
        historico_dispersoes: Sequence[float],
        n: int = 1,
    ) -> tuple[float, float, float]:
        """Carta c não utiliza gráfico secundário de dispersão."""
        return 0.0, 0.0, 0.0
