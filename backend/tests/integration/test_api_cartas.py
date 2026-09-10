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
async def auth_context(async_client: AsyncClient):
    email = f"eng_{uuid4().hex[:6]}@qualidade.com"
    await async_client.post(
        "/api/v1/auth/register",
        json={"nome": "Engenheiro", "email": email, "senha": "SenhaForte123!", "perfil": "ENGENHEIRO"},
    )
    res_login = await async_client.post("/api/v1/auth/login", json={"email": email, "senha": "SenhaForte123!"})
    token = res_login.json()["access_token"]
    header = {"Authorization": f"Bearer {token}"}

    # Cria processo
    res_proc = await async_client.post(
        "/api/v1/processos",
        headers=header,
        json={"nome": "Linha Teste", "codigo_linha": f"P-{uuid4().hex[:4].upper()}"},
    )
    proc_id = res_proc.json()["id"]

    return header, proc_id


@pytest.mark.asyncio
async def test_crud_cartas_e_especificacoes(async_client: AsyncClient, auth_context: tuple):
    header, proc_id = auth_context

    # 1. Criação de carta com seleção automática de tipo (n=5 -> X_R)
    res_carta = await async_client.post(
        "/api/v1/cartas",
        headers=header,
        json={
            "processo_id": proc_id,
            "tamanho_subgrupo": 5,
            "modo_limites": "DINAMICO",
        },
    )
    assert res_carta.status_code == 201
    carta_data = res_carta.json()
    carta_id = carta_data["id"]
    assert carta_data["tipo_carta"] == "X_R"
    assert carta_data["tamanho_subgrupo"] == 5
    assert carta_data["modo_limites"] == "DINAMICO"
    assert carta_data["total_subgrupos"] == 0

    # 2. Criação com n=1 -> deve resolver I_MR automaticamente [RN01]
    res_imr = await async_client.post(
        "/api/v1/cartas",
        headers=header,
        json={"processo_id": proc_id, "tamanho_subgrupo": 1},
    )
    assert res_imr.status_code == 201
    assert res_imr.json()["tipo_carta"] == "I_MR"

    # 3. Consulta de carta por ID
    res_get = await async_client.get(f"/api/v1/cartas/{carta_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == carta_id

    # 4. Listagem filtrada por processo
    res_lista = await async_client.get(f"/api/v1/cartas?processo_id={proc_id}")
    assert res_lista.status_code == 200
    assert len(res_lista.json()) >= 2

    # 5. Atualização de especificações LSE/LIE
    res_patch_specs = await async_client.patch(
        f"/api/v1/cartas/{carta_id}/especificacoes",
        headers=header,
        json={"lse": 26.0, "lie": 24.0, "valor_nominal": 25.0},
    )
    assert res_patch_specs.status_code == 200
    specs = res_patch_specs.json()["especificacoes"]
    assert specs["lse"] == 26.0
    assert specs["lie"] == 24.0
    assert specs["valor_nominal"] == 25.0

    # 6. Alternância de modo de limites para FIXO
    res_patch_modo = await async_client.patch(
        f"/api/v1/cartas/{carta_id}/modo",
        headers=header,
        json={"modo_limites": "FIXO"},
    )
    assert res_patch_modo.status_code == 200
    assert res_patch_modo.json()["modo_limites"] == "FIXO"

    # 7. Modo inválido -> 422
    res_modo_invalido = await async_client.patch(
        f"/api/v1/cartas/{carta_id}/modo",
        headers=header,
        json={"modo_limites": "INVALIDO"},
    )
    assert res_modo_invalido.status_code == 422

    # 8. Consulta de capacidade sem dados suficientes -> 400
    res_cap = await async_client.get(f"/api/v1/cartas/{carta_id}/capacidade")
    assert res_cap.status_code == 400
    assert "dispersão" in res_cap.json()["detail"].lower() or "histórico" in res_cap.json()["detail"].lower()
