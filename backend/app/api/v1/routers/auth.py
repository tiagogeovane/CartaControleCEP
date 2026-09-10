from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import get_current_user, get_usuario_repository
from app.api.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UsuarioCreate,
    UsuarioResponse,
)
from app.core.security import criar_token_acesso, gerar_hash_senha, verificar_senha
from app.domain.entities.usuario import Usuario
from app.domain.interfaces.repositories import IUsuarioRepository

router = APIRouter()


@router.post(
    "/register",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastro de novo usuário",
)
async def registrar_usuario(
    dados: UsuarioCreate,
    usuario_repo: Annotated[IUsuarioRepository, Depends(get_usuario_repository)],
) -> UsuarioResponse:
    """Cadastra um novo usuário no sistema garantindo unicidade do e-mail."""
    existente = await usuario_repo.obter_por_email(dados.email)
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"O e-mail '{dados.email}' já está cadastrado no sistema.",
        )

    hash_senha = gerar_hash_senha(dados.senha)
    usuario = Usuario(
        nome=dados.nome,
        email=dados.email,
        senha_hash=hash_senha,
        perfil=dados.perfil.upper(),
    )

    salvo = await usuario_repo.salvar(usuario)
    return UsuarioResponse(
        id=salvo.id,
        nome=salvo.nome,
        email=salvo.email,
        perfil=salvo.perfil,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autenticação e emissão de JWT (JSON)",
)
async def login_json(
    credenciais: LoginRequest,
    usuario_repo: Annotated[IUsuarioRepository, Depends(get_usuario_repository)],
) -> TokenResponse:
    """Valida credenciais (e-mail e senha) e emite token de acesso JWT."""
    usuario = await usuario_repo.obter_por_email(credenciais.email)
    if usuario is None or not verificar_senha(credenciais.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = criar_token_acesso(
        dados={
            "sub": str(usuario.id),
            "email": usuario.email,
            "perfil": usuario.perfil,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        usuario=UsuarioResponse(
            id=usuario.id,
            nome=usuario.nome,
            email=usuario.email,
            perfil=usuario.perfil,
        ),
    )


@router.post(
    "/token",
    response_model=TokenResponse,
    include_in_schema=False,
    summary="Autenticação OAuth2 Password Form (Swagger UI)",
)
async def login_oauth2_form(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    usuario_repo: Annotated[IUsuarioRepository, Depends(get_usuario_repository)],
) -> TokenResponse:
    """Endpoint compatível com OAuth2PasswordRequestForm para autenticação direta na documentação OpenAPI."""
    usuario = await usuario_repo.obter_por_email(form_data.username)
    if usuario is None or not verificar_senha(form_data.password, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = criar_token_acesso(
        dados={
            "sub": str(usuario.id),
            "email": usuario.email,
            "perfil": usuario.perfil,
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        usuario=UsuarioResponse(
            id=usuario.id,
            nome=usuario.nome,
            email=usuario.email,
            perfil=usuario.perfil,
        ),
    )


@router.get(
    "/me",
    response_model=UsuarioResponse,
    summary="Dados do usuário logado",
)
async def obter_usuario_logado(
    current_user: Annotated[Usuario, Depends(get_current_user)],
) -> UsuarioResponse:
    """Retorna os dados do usuário atualmente autenticado a partir do token JWT."""
    return UsuarioResponse(
        id=current_user.id,
        nome=current_user.nome,
        email=current_user.email,
        perfil=current_user.perfil,
    )
