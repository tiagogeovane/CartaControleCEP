from datetime import timedelta

from app.core.security import (
    criar_token_acesso,
    decodificar_token,
    gerar_hash_senha,
    verificar_senha,
)


def test_gerar_e_verificar_senha():
    senha = "SenhaForte123!@#"
    hash_senha = gerar_hash_senha(senha)

    assert hash_senha != senha
    assert verificar_senha(senha, hash_senha) is True
    assert verificar_senha("SenhaIncorreta", hash_senha) is False


def test_criar_e_decodificar_token_valido():
    dados = {"sub": "12345", "perfil": "ADMIN"}
    token = criar_token_acesso(dados, expira_delta=timedelta(minutes=15))

    payload = decodificar_token(token)
    assert payload is not None
    assert payload["sub"] == "12345"
    assert payload["perfil"] == "ADMIN"
    assert "exp" in payload


def test_decodificar_token_invalido():
    payload = decodificar_token("token_totalmente_invalido.123.456")
    assert payload is None
