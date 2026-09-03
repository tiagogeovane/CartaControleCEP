from collections.abc import Sequence

from app.domain.rules.base import IRegraNelson
from app.domain.rules.nelson_rules import (
    Regra1TresSigma,
    Regra2NoveMesmoLado,
    Regra3SeisTendencia,
    Regra4QuatorzeAlternados,
    Regra5DoisDeTresZonaA,
    Regra6QuatroDeCincoZonaB,
    Regra7QuinzeZonaC,
    Regra8OitoForaZonaC,
)
from app.domain.value_objects.limites import LimitesControle
from app.domain.value_objects.violacao import ViolacaoRegra


class DetectorRegrasNelson:
    """Avaliador e agregador (Composite) das 8 Regras de Nelson para detecção de anomalias em CEP."""

    def __init__(self, regras: list[IRegraNelson] | None = None) -> None:
        self._regras: list[IRegraNelson] = (
            regras
            if regras is not None
            else [
                Regra1TresSigma(),
                Regra2NoveMesmoLado(),
                Regra3SeisTendencia(),
                Regra4QuatorzeAlternados(),
                Regra5DoisDeTresZonaA(),
                Regra6QuatroDeCincoZonaB(),
                Regra7QuinzeZonaC(),
                Regra8OitoForaZonaC(),
            ]
        )

    @property
    def regras_ativas(self) -> list[IRegraNelson]:
        """Lista de regras atualmente ativas no detector."""
        return list(self._regras)

    def adicionar_regra(self, regra: IRegraNelson) -> None:
        """Adiciona uma nova regra de detecção de causas especiais."""
        self._regras.append(regra)

    def remover_regra(self, codigo_regra: str) -> bool:
        """Desativa uma regra a partir de seu código. Retorna True se encontrada e removida."""
        inicial = len(self._regras)
        self._regras = [r for r in self._regras if r.codigo != codigo_regra]
        return len(self._regras) < inicial

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> list[ViolacaoRegra]:
        """Executa todas as regras ativas sobre a sequência histórica e consolida as anomalias detectadas."""
        if not historico_medias:
            return []

        violacoes: list[ViolacaoRegra] = []
        for regra in self._regras:
            resultado = regra.avaliar(historico_medias, limites)
            if resultado is not None:
                violacoes.append(resultado)

        return violacoes
