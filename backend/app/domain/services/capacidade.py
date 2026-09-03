
from app.domain.value_objects.capacidade import IndicesCapacidade
from app.domain.value_objects.limites import LimitesEspecificacao


class CalculadorCapacidade:
    """Serviço de domínio para cálculo dos índices de capacidade do processo (Cp, Cpk, Cpl, Cpu)."""

    @staticmethod
    def calcular(
        media_processo: float,
        sigma_estimado: float,
        especificacoes: LimitesEspecificacao,
    ) -> IndicesCapacidade:
        """Calcula os índices de capacidade do processo considerando tolerâncias de engenharia.

        Fórmulas:
        - Cp  = (LSE - LIE) / (6 * sigma)
        - Cpu = (LSE - media) / (3 * sigma)
        - Cpl = (media - LIE) / (3 * sigma)
        - Cpk = min(Cpu, Cpl)
        """
        if sigma_estimado <= 0:
            raise ValueError(
                f"Sigma estimado ({sigma_estimado}) deve ser estritamente positivo para cálculo de capacidade."
            )

        cp: float | None = None
        cpu: float | None = None
        cpl: float | None = None
        cpk: float | None = None

        if especificacoes.lse is not None and especificacoes.lie is not None:
            cp = float((especificacoes.lse - especificacoes.lie) / (6.0 * sigma_estimado))

        if especificacoes.lse is not None:
            cpu = float((especificacoes.lse - media_processo) / (3.0 * sigma_estimado))

        if especificacoes.lie is not None:
            cpl = float((media_processo - especificacoes.lie) / (3.0 * sigma_estimado))

        # Determinação do Cpk
        if cpu is not None and cpl is not None:
            cpk = min(cpu, cpl)
        elif cpu is not None:
            cpk = cpu
        elif cpl is not None:
            cpk = cpl

        return IndicesCapacidade(
            cp=round(cp, 4) if cp is not None else None,
            cpk=round(cpk, 4) if cpk is not None else None,
            cpu=round(cpu, 4) if cpu is not None else None,
            cpl=round(cpl, 4) if cpl is not None else None,
        )
