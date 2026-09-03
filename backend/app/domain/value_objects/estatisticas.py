from dataclasses import dataclass, field


@dataclass(frozen=True)
class EstatisticasSubgrupo:
    """Objeto de valor imutável contendo as estatísticas calculadas de um subgrupo amostral."""

    media_x: float
    amplitude_r: float
    desvio_s: float
    valores_brutos: tuple[float, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.amplitude_r < 0:
            raise ValueError(f"Amplitude amostral R ({self.amplitude_r}) não pode ser negativa.")
        if self.desvio_s < 0:
            raise ValueError(f"Desvio padrão amostral s ({self.desvio_s}) não pode ser negativo.")
