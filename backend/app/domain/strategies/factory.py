
from typing import ClassVar

from app.domain.strategies.base import ICartaControleStrategy
from app.domain.strategies.imr_chart import CartaIMRStrategy
from app.domain.strategies.xr_chart import CartaXRStrategy
from app.domain.strategies.xs_chart import CartaXsStrategy


class CartaStrategyFactory:
    """Fábrica baseada no Registry Pattern para estratégias de cartas de controle.

    Encapsula o mapeamento entre identificadores de cartas e suas respectivas
    classes de estratégia, garantindo conformidade com o princípio Aberto/Fechado (OCP).
    Permite registrar novas estratégias em tempo de execução sem modificar a fábrica.
    """

    _registry: ClassVar[dict[str, type[ICartaControleStrategy]]] = {
        "X_R": CartaXRStrategy,
        "XR": CartaXRStrategy,
        "X_S": CartaXsStrategy,
        "XS": CartaXsStrategy,
        "I_MR": CartaIMRStrategy,
        "IMR": CartaIMRStrategy,
        "INDIVIDUAL": CartaIMRStrategy,
    }

    @classmethod
    def _normalizar_tipo(cls, tipo: str) -> str:
        """Normaliza o identificador textual do tipo de carta (ex: 'x-r' -> 'X_R')."""
        return tipo.strip().upper().replace("-", "_").replace(" ", "_")

    @classmethod
    def registrar(
        cls,
        tipo: str,
        estrategia_classe: type[ICartaControleStrategy] | None = None,
    ):
        """Registra uma nova estratégia no registry.

        Pode ser utilizado como método direto ou como decorador de classe:
        >>> CartaStrategyFactory.registrar("NOVA_CARTA", NovaCartaStrategy)
        >>> @CartaStrategyFactory.registrar("NOVA_CARTA")
        ... class NovaCartaStrategy(ICartaControleStrategy): ...
        """
        def decorator(subclasse: type[ICartaControleStrategy]) -> type[ICartaControleStrategy]:
            chave = cls._normalizar_tipo(tipo)
            cls._registry[chave] = subclasse
            return subclasse

        if estrategia_classe is not None:
            return decorator(estrategia_classe)
        return decorator

    @classmethod
    def desregistrar(cls, tipo: str) -> bool:
        """Remove uma estratégia do registry. Retorna True se existia e foi removida."""
        chave = cls._normalizar_tipo(tipo)
        return cls._registry.pop(chave, None) is not None

    @classmethod
    def obter_estrategias_registradas(cls) -> dict[str, type[ICartaControleStrategy]]:
        """Retorna uma cópia do dicionário contendo as estratégias registradas."""
        return dict(cls._registry)

    @classmethod
    def resolver_por_tamanho(cls, tamanho_subgrupo: int) -> ICartaControleStrategy:
        """Resolve a estratégia apropriada a partir do tamanho amostral (Regra de Negócio [RN01]).

        - n = 1: I-MR (Valores Individuais e Amplitude Móvel)
        - 2 <= n <= 10: X-R (Médias e Amplitudes)
        - n > 10: X-s (Médias e Desvios Padrão)
        """
        if tamanho_subgrupo < 1:
            raise ValueError(f"Tamanho de subgrupo deve ser >= 1 (recebido: {tamanho_subgrupo}).")

        if tamanho_subgrupo == 1:
            estrategia_cls = cls._registry.get("I_MR", CartaIMRStrategy)
        elif tamanho_subgrupo <= 10:
            estrategia_cls = cls._registry.get("X_R", CartaXRStrategy)
        else:
            estrategia_cls = cls._registry.get("X_S", CartaXsStrategy)

        return estrategia_cls()

    @classmethod
    def fabricar(
        cls,
        tipo_carta: str | None = None,
        tamanho_subgrupo: int | None = None,
    ) -> ICartaControleStrategy:
        """Resolve e instancia a estratégia de controle.

        - Se tipo_carta não for fornecido: delega diretamente para resolver_por_tamanho(tamanho_subgrupo).
        - Se tipo_carta for fornecido: normaliza a chave e instancia direto do registry.
        """
        # 1. Se nenhum tipo for fornecido, resolve puramente pelo tamanho amostral
        if not tipo_carta or not tipo_carta.strip():
            n = tamanho_subgrupo if tamanho_subgrupo is not None else 5
            return cls.resolver_por_tamanho(n)

        chave = cls._normalizar_tipo(tipo_carta)

        # 2. Transições estatísticas recomendadas (Montgomery / RN01):
        if tamanho_subgrupo is not None:
            if tamanho_subgrupo == 1 and chave in ("X_R", "XR", "X_S", "XS"):
                return cls.resolver_por_tamanho(1)
            if tamanho_subgrupo > 10 and chave in ("X_R", "XR"):
                return cls.resolver_por_tamanho(tamanho_subgrupo)


        # 3. Lookup no registry com erro explícito
        if chave not in cls._registry:
            tipos_validos = ", ".join(sorted(set(cls._registry.keys())))
            raise ValueError(
                f"Tipo de carta de controle não registrado: '{tipo_carta}'. "
                f"Tipos disponíveis no registry: {tipos_validos}."
            )

        estrategia_cls = cls._registry[chave]
        return estrategia_cls()
