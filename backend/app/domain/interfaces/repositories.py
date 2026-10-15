from abc import ABC, abstractmethod
from collections.abc import Sequence
from uuid import UUID

from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.entities.subgrupo import Subgrupo
from app.domain.entities.usuario import Usuario
from app.domain.value_objects.limites import LimitesControle


class ICartaControleRepository(ABC):
    """Contrato abstrato para persistência e recuperação de Cartas de Controle."""

    @abstractmethod
    async def obter_por_id(self, carta_id: UUID) -> CartaControle | None:
        """Recupera uma carta pelo seu identificador único, incluindo seu histórico."""

    @abstractmethod
    async def salvar(self, carta: CartaControle) -> CartaControle:
        """Persiste ou atualiza os dados da carta de controle."""

    @abstractmethod
    async def listar_todas(self, processo_id: UUID | None = None) -> list[CartaControle]:
        """Lista cartas cadastradas, opcionalmente filtradas por processo."""

    @abstractmethod
    async def atualizar_limites(
        self,
        carta_id: UUID,
        novos_limites: LimitesControle,
    ) -> None:
        """Atualização pontual dos limites calculados da carta."""


class ISubgrupoRepository(ABC):
    """Contrato abstrato para persistência e recuperação de Subgrupos e medições."""

    @abstractmethod
    async def salvar(self, subgrupo: Subgrupo) -> Subgrupo:
        """Persiste um subgrupo com suas medições brutas e violações associadas."""

    @abstractmethod
    async def salvar_em_lote(self, subgrupos: Sequence[Subgrupo]) -> list[Subgrupo]:
        """Persiste múltiplos subgrupos em transação única (importação em lote)."""

    @abstractmethod
    async def listar_por_carta(
        self,
        carta_id: UUID,
        limite: int | None = None,
    ) -> list[Subgrupo]:
        """Recupera os subgrupos de uma carta ordenados cronologicamente."""

    @abstractmethod
    async def atualizar_violacoes_em_lote(self, subgrupos: Sequence[Subgrupo]) -> None:
        """Atualiza fora_de_controle e regras_violadas de múltiplos subgrupos existentes."""


class IProcessoRepository(ABC):
    """Contrato abstrato para gestão de Processos Industriais."""

    @abstractmethod
    async def obter_por_id(self, processo_id: UUID) -> Processo | None:
        pass

    @abstractmethod
    async def salvar(self, processo: Processo) -> Processo:
        pass

    @abstractmethod
    async def listar_todos(self) -> list[Processo]:
        pass


class IUsuarioRepository(ABC):
    """Contrato abstrato para gestão e consulta de Usuários."""

    @abstractmethod
    async def obter_por_id(self, usuario_id: UUID) -> Usuario | None:
        pass

    @abstractmethod
    async def obter_por_email(self, email: str) -> Usuario | None:
        pass

    @abstractmethod
    async def salvar(self, usuario: Usuario) -> Usuario:
        pass

    @abstractmethod
    async def listar_todos(self) -> list[Usuario]:
        pass
