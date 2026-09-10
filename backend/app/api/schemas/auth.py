from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UsuarioCreate(BaseModel):
    """Schema para cadastro de novos usuários no sistema."""

    nome: str = Field(..., min_length=2, max_length=150, description="Nome completo do usuário")
    email: str = Field(..., min_length=5, max_length=150, description="E-mail corporativo único")
    senha: str = Field(..., min_length=6, max_length=100, description="Senha de acesso")
    perfil: str = Field(default="OPERADOR", description="Perfil de acesso (OPERADOR, ENGENHEIRO, ADMIN)")


class UsuarioResponse(BaseModel):
    """Schema de retorno dos dados de um usuário (sem expor o hash da senha)."""

    id: UUID
    nome: str
    email: str
    perfil: str

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    """Schema para autenticação via JSON."""

    email: str = Field(..., description="E-mail corporativo")
    senha: str = Field(..., description="Senha de acesso")


class TokenResponse(BaseModel):
    """Schema de resposta do token de acesso JWT."""

    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse
