from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Usuario:
    """Entidade que representa um usuário do sistema (operador, engenheiro de qualidade ou administrador)."""

    nome: str
    email: str
    senha_hash: str
    id: UUID = field(default_factory=uuid4)
    perfil: str = "OPERADOR"

    def __post_init__(self) -> None:
        if not self.nome or not self.nome.strip():
            raise ValueError("O nome do usuário é obrigatório.")
        if not self.email or "@" not in self.email:
            raise ValueError(f"E-mail do usuário inválido: {self.email}")
        if not self.senha_hash or not self.senha_hash.strip():
            raise ValueError("O hash da senha é obrigatório.")

        self.nome = self.nome.strip()
        self.email = self.email.strip().lower()
        self.perfil = self.perfil.strip().upper()
