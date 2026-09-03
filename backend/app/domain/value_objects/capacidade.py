from dataclasses import dataclass


@dataclass(frozen=True)
class IndicesCapacidade:
    """Objeto de valor imutável contendo os índices de capacidade do processo (Cp, Cpk, Cpl, Cpu)."""

    cp: float | None = None
    cpk: float | None = None
    cpu: float | None = None
    cpl: float | None = None

    def esta_aprovado(self, criterio: float = 1.00) -> bool:
        """Verifica se o processo é capaz de acordo com o critério industrial padrão (Cpk >= 1.33)."""
        if self.cpk is None:
            return False
        return self.cpk >= criterio

    @property
    def classificacao(self) -> str:
        """Retorna uma classificação textual do estado de capacidade do processo."""
        if self.cpk is None:
            return "Indeterminado"
        if self.cpk >= 1.67:
            return "Excelente (Seis Sigma)"
        if self.cpk >= 1.33:
            return "Capaz / Adequado"
        if self.cpk >= 1.00:
            return "Marginalmente Capaz"
        return "Incapaz (Necessita Ação Corretiva)"
