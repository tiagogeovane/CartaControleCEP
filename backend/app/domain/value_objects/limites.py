from dataclasses import dataclass


@dataclass(frozen=True)
class LimitesControle:
    """Objeto de valor imutável representando os limites estatísticos de controle da carta.

    `lc`, `lsc` e `lic` referem-se à carta principal (posição: X-barra ou I).
    Os campos `*_dispersao` são opcionais e referem-se à carta secundária de
    dispersão (R, s ou MR), permitindo detectar anomalias de variabilidade.
    """

    lc: float
    lsc: float
    lic: float
    sigma_estimado: float
    lc_dispersao: float | None = None
    lsc_dispersao: float | None = None
    lic_dispersao: float | None = None

    def __post_init__(self) -> None:
        if not (self.lic <= self.lc <= self.lsc):
            raise ValueError(
                f"Invariante estatística violada: LIC ({self.lic}) <= LC ({self.lc}) <= LSC ({self.lsc}) não é satisfeita."
            )
        if self.sigma_estimado < 0:
            raise ValueError(
                f"Invariante estatística violada: Sigma estimado ({self.sigma_estimado}) não pode ser negativo."
            )
        if self.possui_limites_dispersao and not (
            self.lic_dispersao <= self.lc_dispersao <= self.lsc_dispersao  # type: ignore[operator]
        ):
            raise ValueError(
                "Invariante estatística violada nos limites de dispersão: "
                f"LIC ({self.lic_dispersao}) <= LC ({self.lc_dispersao}) <= LSC ({self.lsc_dispersao}) "
                "não é satisfeita."
            )

    @property
    def possui_limites_dispersao(self) -> bool:
        """Indica se os três limites da carta secundária de dispersão foram informados."""
        return (
            self.lc_dispersao is not None
            and self.lsc_dispersao is not None
            and self.lic_dispersao is not None
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
