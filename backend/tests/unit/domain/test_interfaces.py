import inspect
from abc import ABC
from uuid import uuid4

import pytest
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces import (
    ICartaControleRepository,
    IProcessoRepository,
    ISubgrupoObserver,
    ISubgrupoRepository,
    IUsuarioRepository,
)
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo


def test_interfaces_are_abstract():
    """Garante que os contratos de persistência e notificação herdam de ABC e não podem ser instanciados."""
    interfaces = [
        ICartaControleRepository,
        ISubgrupoRepository,
        IProcessoRepository,
        IUsuarioRepository,
        ISubgrupoObserver,
    ]
    for iface in interfaces:
        assert issubclass(iface, ABC)
        with pytest.raises(TypeError):
            iface()  # type: ignore[abstract]


@pytest.mark.asyncio
async def test_subgrupo_observer_implementation():
    """Valida que uma implementação concreta do ISubgrupoObserver pode ser chamada assincronamente."""

    class MockObserver(ISubgrupoObserver):
        def __init__(self) -> None:
            self.notificado = False

        async def notificar_processamento(
            self,
            carta: CartaControle,
            subgrupo: Subgrupo,
        ) -> None:
            self.notificado = True

    observer = MockObserver()
    carta = CartaControle(processo_id=uuid4(), tipo_carta="X_R", tamanho_subgrupo=5)
    subgrupo = Subgrupo(
        carta_id=carta.id,
        numero_subgrupo=1,
        valores_brutos=[10.0, 11.0, 10.5, 9.5, 10.0],
        estatisticas=EstatisticasSubgrupo(
            media_x=10.2, amplitude_r=1.5, desvio_s=0.5, valores_brutos=(10.0, 11.0, 10.5, 9.5, 10.0)
        ),
    )

    await observer.notificar_processamento(carta, subgrupo)
    assert observer.notificado is True


def test_repository_interfaces_method_signatures():
    """Garante a existência e parâmetros esperados nos métodos dos contratos de repositório."""
    carta_methods = dict(inspect.getmembers(ICartaControleRepository, predicate=inspect.isfunction))
    assert "obter_por_id" in carta_methods
    assert "salvar" in carta_methods
    assert "listar_todas" in carta_methods
    assert "atualizar_limites" in carta_methods

    subgrupo_methods = dict(inspect.getmembers(ISubgrupoRepository, predicate=inspect.isfunction))
    assert "salvar" in subgrupo_methods
    assert "salvar_em_lote" in subgrupo_methods
    assert "listar_por_carta" in subgrupo_methods
    assert "atualizar_violacoes_em_lote" in subgrupo_methods

    processo_methods = dict(inspect.getmembers(IProcessoRepository, predicate=inspect.isfunction))
    assert "obter_por_id" in processo_methods
    assert "salvar" in processo_methods
    assert "listar_todos" in processo_methods

    usuario_methods = dict(inspect.getmembers(IUsuarioRepository, predicate=inspect.isfunction))
    assert "obter_por_id" in usuario_methods
    assert "obter_por_email" in usuario_methods
    assert "salvar" in usuario_methods
    assert "listar_todos" in usuario_methods
