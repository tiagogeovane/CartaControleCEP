from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Processo:
    """Entidade que representa um processo industrial ou linha produtiva monitorada."""

    nome: str
    codigo_linha: str
    id: UUID = field(default_factory=uuid4)
    descricao: str | None = None

    def __post_init__(self) -> None:
        if not self.nome or not self.nome.strip():
            raise ValueError("O nome do processo é obrigatório.")
        if not self.codigo_linha or not self.codigo_linha.strip():
            raise ValueError("O código da linha de produção é obrigatório.")
        self.nome = self.nome.strip()
        self.codigo_linha = self.codigo_linha.strip()
