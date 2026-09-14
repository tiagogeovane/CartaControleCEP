from uuid import uuid4

import pytest
from app.main import app
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_fluxo_autenticacao_completo(async_client: AsyncClient):
    email = f"operador_{uuid4().hex[:6]}@industria.com"
    senha = "SenhaSegura123!"

    # 1. Registro
    res_reg = await async_client.post(
        "/api/v1/auth/register",
        json={
            "nome": "Operador Linha 01",
            "email": email,
            "senha": senha,
            "perfil": "OPERADOR",
        },
    )
    assert res_reg.status_code == 201
    dados_reg = res_reg.json()
    assert dados_reg["email"] == email
    assert dados_reg["nome"] == "Operador Linha 01"
    assert "senha" not in dados_reg
    assert "id" in dados_reg

    # 2. Conflito de email duplicado
    res_dup = await async_client.post(
        "/api/v1/auth/register",
        json={
            "nome": "Outro Operador",
            "email": email,
            "senha": "OutraSenha123",
        },
    )
    assert res_dup.status_code == 400
    assert "já está cadastrado" in res_dup.json()["detail"]

    # 3. Login com senha errada
    res_login_err = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": "SenhaErrada!"},
    )
    assert res_login_err.status_code == 401

    # 4. Login com sucesso (JSON)
    res_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": senha},
    )
    assert res_login.status_code == 200
    login_data = res_login.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    token = login_data["access_token"]

    # 5. Acesso ao endpoint protegido /me
    res_me = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["email"] == email
    assert me_data["nome"] == "Operador Linha 01"

    # 6. Acesso sem token -> retorna Administrador padrão (sistema sem contas)
    res_sem_token = await async_client.get("/api/v1/auth/me")
    assert res_sem_token.status_code == 200
    assert res_sem_token.json()["perfil"] == "ADMIN"
    assert res_sem_token.json()["nome"] == "Administrador"
