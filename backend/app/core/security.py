from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def gerar_hash_senha(senha: str) -> str:
    """Gera o hash criptográfico seguro da senha utilizando bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(senha.encode("utf-8"), salt).decode("utf-8")


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """Valida se a senha plana coincide com o hash criptografado."""
    try:
        return bcrypt.checkpw(senha_plana.encode("utf-8"), senha_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def criar_token_acesso(
    dados: dict,
    expira_delta: timedelta | None = None,
) -> str:
    """Gera um token JWT com expiração temporal configurada."""
    a_codificar = dados.copy()
    if expira_delta:
        expira = datetime.now(timezone.utc) + expira_delta
    else:
        expira = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    a_codificar.update({"exp": expira})
    return jwt.encode(a_codificar, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decodificar_token(token: str) -> dict | None:
    """Decodifica e valida a assinatura e validade do token JWT. Retorna o payload ou None."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
