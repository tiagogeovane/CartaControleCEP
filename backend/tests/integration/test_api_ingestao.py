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
async def carta_context(async_client: AsyncClient):
    email = f"eng_{uuid4().hex[:6]}@qualidade.com"
    await async_client.post(
        "/api/v1/auth/register",
        json={"nome": "Engenheiro", "email": email, "senha": "SenhaForte123!", "perfil": "ENGENHEIRO"},
    )
    res_login = await async_client.post("/api/v1/auth/login", json={"email": email, "senha": "SenhaForte123!"})
    token = res_login.json()["access_token"]
    header = {"Authorization": f"Bearer {token}"}

    # Processo
    res_proc = await async_client.post(
        "/api/v1/processos",
        headers=header,
        json={"nome": "Linha CNC", "codigo_linha": f"CNC-{uuid4().hex[:4].upper()}"},
    )
    proc_id = res_proc.json()["id"]

    # Carta com tolerâncias (LSE=52, LIE=48, Nominal=50)
    res_carta = await async_client.post(
        "/api/v1/cartas",
        headers=header,
        json={
            "processo_id": proc_id,
            "tamanho_subgrupo": 5,
            "tipo_carta": "X_R",
            "especificacoes": {"lse": 52.0, "lie": 48.0, "valor_nominal": 50.0},
            "modo_limites": "DINAMICO",
        },
    )
    carta_id = res_carta.json()["id"]
    return header, carta_id


@pytest.mark.asyncio
async def test_fluxo_ingestao_e_capacidade(async_client: AsyncClient, carta_context: tuple):
    _header, carta_id = carta_context

    # 1. Ingestão válida de 1º subgrupo
    amostra_1 = [50.1, 49.9, 50.0, 50.2, 49.8]
    res_amostra_1 = await async_client.post(
        f"/api/v1/cartas/{carta_id}/amostras",
        json={"valores": amostra_1},
    )
    assert res_amostra_1.status_code == 201
    dados_1 = res_amostra_1.json()
    assert dados_1["numero_subgrupo"] == 1
    assert dados_1["estatisticas"]["media_x"] == pytest.approx(50.0, 0.01)
    assert dados_1["estatisticas"]["amplitude_r"] == pytest.approx(0.4, 0.01)
    assert dados_1["fora_de_controle"] is False
    assert dados_1["violacoes"] == []

    # 2. Rejeição por tamanho divergente [RN02] -> HTTP 422
    res_amostra_invalida = await async_client.post(
        f"/api/v1/cartas/{carta_id}/amostras",
        json={"valores": [50.0, 50.1, 49.9]},  # 3 medições quando esperado é 5
    )
    assert res_amostra_invalida.status_code == 422
    assert "esperado 5, recebido 3" in res_amostra_invalida.json()["detail"]

    # 3. Ingestão de subgrupo com anomalia violando Regra 1 (ponto fora de 3 sigma)
    amostra_anomala = [65.0, 65.2, 64.8, 65.1, 65.0]
    res_anomala = await async_client.post(
        f"/api/v1/cartas/{carta_id}/amostras",
        json={"valores": amostra_anomala},
    )
    assert res_anomala.status_code == 201
    dados_anomala = res_anomala.json()
    assert dados_anomala["numero_subgrupo"] == 2
    assert dados_anomala["fora_de_controle"] is True
    regras = [v["codigo_regra"] for v in dados_anomala["violacoes"]]
    assert "REGRA_1" in regras

    # 4. Listagem histórica de subgrupos
    res_subgrupos = await async_client.get(f"/api/v1/cartas/{carta_id}/subgrupos")
    assert res_subgrupos.status_code == 200
    assert len(res_subgrupos.json()) == 2

    # 5. Importação em lote
    lote = [
        [50.1, 50.0, 49.9, 50.2, 49.8],
        [49.9, 50.1, 50.0, 49.8, 50.2],
        [50.0, 49.8, 50.2, 50.1, 49.9],
    ]
    res_import = await async_client.post(
        f"/api/v1/cartas/{carta_id}/importar",
        json={"amostras": lote},
    )
    assert res_import.status_code == 201
    assert res_import.json()["total_importados"] == 3

    # Total de subgrupos agora é 5
    res_sub_total = await async_client.get(f"/api/v1/cartas/{carta_id}/subgrupos")
    assert len(res_sub_total.json()) == 5

    # 6. Análise de Capacidade agora tem dados válidos -> HTTP 200
    res_cap = await async_client.get(f"/api/v1/cartas/{carta_id}/capacidade")
    assert res_cap.status_code == 200
    dados_cap = res_cap.json()
    assert dados_cap["carta_id"] == str(carta_id)
    assert dados_cap["total_subgrupos"] == 5
    assert dados_cap["indices"]["cp"] is not None
    assert dados_cap["indices"]["cpk"] is not None
    assert "classificacao" in dados_cap
