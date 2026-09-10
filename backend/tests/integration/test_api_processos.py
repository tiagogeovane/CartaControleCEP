from uuid import uuid4

import pytest
from app.main import app
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def auth_header(async_client: AsyncClient):
    email = f"eng_{uuid4().hex[:6]}@qualidade.com"
    await async_client.post(
        "/api/v1/auth/register",
        json={"nome": "Engenheiro", "email": email, "senha": "SenhaForte123!", "perfil": "ENGENHEIRO"},
    )
    res = await async_client.post("/api/v1/auth/login", json={"email": email, "senha": "SenhaForte123!"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_crud_processos(async_client: AsyncClient, auth_header: dict):
    # 1. Tentativa sem token -> 401
    res_sem_auth = await async_client.post(
        "/api/v1/processos",
        json={"nome": "Prensa Hidráulica", "codigo_linha": "PRENSA-01"},
    )
    assert res_sem_auth.status_code == 401

    # 2. Cadastro de processo
    cod_linha = f"LINHA-{uuid4().hex[:5].upper()}"
    res_criacao = await async_client.post(
        "/api/v1/processos",
        headers=auth_header,
        json={
            "nome": "Usinagem de Bielas",
            "codigo_linha": cod_linha,
            "descricao": "Monitoramento de diâmetro interno",
        },
    )
    assert res_criacao.status_code == 201
    proc = res_criacao.json()
    assert proc["codigo_linha"] == cod_linha
    proc_id = proc["id"]

    # 3. Consulta por ID
    res_detalhe = await async_client.get(f"/api/v1/processos/{proc_id}")
    assert res_detalhe.status_code == 200
    assert res_detalhe.json()["id"] == proc_id

    # 4. Consulta ID inexistente -> 404
    res_404 = await async_client.get(f"/api/v1/processos/{uuid4()}")
    assert res_404.status_code == 404

    # 5. Listagem
    res_lista = await async_client.get("/api/v1/processos")
    assert res_lista.status_code == 200
    ids = [p["id"] for p in res_lista.json()]
    assert proc_id in ids
