from app.domain.rules.base import IRegraNelson
from app.domain.rules.detector import DetectorRegrasNelson
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

__all__ = [
    "DetectorRegrasNelson",
    "IRegraNelson",
    "Regra1TresSigma",
    "Regra2NoveMesmoLado",
    "Regra3SeisTendencia",
    "Regra4QuatorzeAlternados",
    "Regra5DoisDeTresZonaA",
    "Regra6QuatroDeCincoZonaB",
    "Regra7QuinzeZonaC",
    "Regra8OitoForaZonaC",
]
