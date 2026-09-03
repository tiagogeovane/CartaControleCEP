from dataclasses import dataclass


@dataclass(frozen=True)
class LimitesControle:
    """Objeto de valor imutável representando os limites estatísticos de controle da carta."""

    lc: float
    lsc: float
    lic: float
    sigma_estimado: float

    def __post_init__(self) -> None:
        if not (self.lic <= self.lc <= self.lsc):
            raise ValueError(
                f"Invariante estatística violada: LIC ({self.lic}) <= LC ({self.lc}) <= LSC ({self.lsc}) não é satisfeita."
            )
        if self.sigma_estimado < 0:
            raise ValueError(
                f"Invariante estatística violada: Sigma estimado ({self.sigma_estimado}) não pode ser negativo."
            )

    @property
    def amplitude_limites(self) -> float:
        """Diferença entre Limite Superior e Linha Central (equivale a 3 sigma da média)."""
        return self.lsc - self.lc

    @property
    def sigma_media(self) -> float:
        """Desvio padrão da média das amostras (sigma / sqrt(n) ou amplitude / 3)."""
        return (self.lsc - self.lc) / 3.0 if (self.lsc - self.lc) > 0 else 0.0


@dataclass(frozen=True)
class LimitesEspecificacao:
    """Objeto de valor imutável representando os limites de engenharia/projeto (tolerâncias)."""

    lse: float | None = None
    lie: float | None = None
    valor_nominal: float | None = None

    def __post_init__(self) -> None:
        if self.lse is None and self.lie is None:
            raise ValueError("Ao menos um dos limites de especificação (LSE ou LIE) deve ser informado.")

        if self.lse is not None and self.lie is not None and self.lie >= self.lse:
            raise ValueError(
                f"Invariante violada: Limite Inferior ({self.lie}) deve ser menor que o Limite Superior ({self.lse})."
            )

        if self.valor_nominal is not None:
            if self.lie is not None and self.valor_nominal < self.lie:
                raise ValueError(
                    f"Valor nominal ({self.valor_nominal}) não pode ser inferior ao LIE ({self.lie})."
                )
            if self.lse is not None and self.valor_nominal > self.lse:
                raise ValueError(
                    f"Valor nominal ({self.valor_nominal}) não pode ser superior ao LSE ({self.lse})."
                )
