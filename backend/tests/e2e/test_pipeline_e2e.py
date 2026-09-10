"""Testes End-to-End (E2E) para o pipeline completo do sistema CEP.

Valida a integração ponta a ponta entre a camada REST (HTTP), persistência assíncrona MySQL,
cálculo estatístico e regras de Nelson, transmissão em tempo real via WebSockets
e o requisito não-funcional de desempenho e latência [RNF01] (< 500 ms).
"""

import time
from uuid import uuid4

import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def test_client() -> TestClient:
    """Fixture para cliente síncrono FastAPI TestClient com suporte a WebSocket."""
    return TestClient(app)


@pytest.fixture
def auth_header(test_client: TestClient) -> dict[str, str]:
    """Cria e autentica um usuário de teste, retornando o cabeçalho Authorization Bearer."""
    email = f"e2e_eng_{uuid4().hex[:6]}@industria.com"
    senha = "SenhaForte123!"

    res_reg = test_client.post(
        "/api/v1/auth/register",
        json={
            "nome": "Engenheiro Qualidade E2E",
            "email": email,
            "senha": senha,
            "perfil": "ENGENHEIRO",
        },
    )
    assert res_reg.status_code == 201

    res_login = test_client.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": senha},
    )
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup_processo_e_carta(test_client: TestClient, auth_header: dict[str, str]) -> tuple[str, str]:
    """Cadastra um processo industrial e uma carta de controle X-barra e R de teste."""
    # 1. Criação do processo
    cod_linha = f"E2E-{uuid4().hex[:4].upper()}"
    res_proc = test_client.post(
        "/api/v1/processos",
        headers=auth_header,
        json={
            "nome": f"Linha Usinagem Alta Precisão ({cod_linha})",
            "codigo_linha": cod_linha,
            "descricao": "Processo industrial para validação E2E de latência e CEP",
        },
    )
    assert res_proc.status_code == 201
    proc_id = res_proc.json()["id"]

    # 2. Criação da carta de controle (n=5, tolerâncias industriais LSE=26.5, LIE=23.5, Nominal=25.0)
    res_carta = test_client.post(
        "/api/v1/cartas",
        headers=auth_header,
        json={
            "processo_id": proc_id,
            "tamanho_subgrupo": 5,
            "tipo_carta": "X_R",
            "especificacoes": {
                "lse": 26.5,
                "lie": 23.5,
                "valor_nominal": 25.0,
            },
            "modo_limites": "DINAMICO",
        },
    )
    assert res_carta.status_code == 201
    carta_id = res_carta.json()["id"]
    return proc_id, carta_id


def test_e2e_fluxo_completo_e_latencia_tempo_real(
    test_client: TestClient,
    setup_processo_e_carta: tuple[str, str],
) -> None:
    """Valida o fluxo completo de ingestão REST, persistência e broadcast WebSocket.

    Verifica conformidade estrita com o requisito [RNF01] (latência ponta a ponta < 500 ms).
    """
    _proc_id, carta_id = setup_processo_e_carta
    latencias_ms: list[float] = []

    with test_client.websocket_connect(f"/ws/cartas/{carta_id}") as ws:
        # 1. Validação de Handshake
        handshake = ws.receive_json()
        assert handshake["event"] == "CONEXAO_ESTABELECIDA"
        assert handshake["carta_id"] == carta_id
        assert handshake["status"] == "online"

        # 2. Ingestão de 5 subgrupos estáveis consecutivos
        amostras_teste = [
            [25.05, 24.95, 25.00, 25.10, 24.90],
            [24.98, 25.02, 25.01, 24.95, 25.04],
            [25.12, 24.88, 25.00, 25.05, 24.95],
            [25.01, 25.03, 24.97, 25.00, 24.99],
            [24.92, 25.08, 25.02, 24.96, 25.02],
        ]

        for i, amostra in enumerate(amostras_teste, start=1):
            t_inicio = time.perf_counter()

            # Disparo da ingestão HTTP REST
            res_post = test_client.post(
                f"/api/v1/cartas/{carta_id}/amostras",
                json={"valores": amostra, "numero_subgrupo": i},
            )
            assert res_post.status_code == 201
            dados_post = res_post.json()
            assert dados_post["numero_subgrupo"] == i

            # Recepção do pacote via streaming WebSocket
            evento_ws = ws.receive_json()
            t_fim = time.perf_counter()

            latencia_ms = (t_fim - t_inicio) * 1000.0
            latencias_ms.append(latencia_ms)

            # [RNF01] Latência ponta a ponta estritamente inferior a 500 ms
            assert latencia_ms < 500.0, f"Latência E2E excedeu 500 ms: {latencia_ms:.2f} ms"

            # Validação do payload do WebSocket
            assert evento_ws["event"] == "NOVO_SUBGRUPO_PROCESSADO"
            assert evento_ws["carta_id"] == carta_id
            assert evento_ws["numero_subgrupo"] == i
            assert evento_ws["status_controle"]["fora_de_controle"] is False
            assert evento_ws["status_controle"]["regras_violadas"] == []

            # Invariantes estatísticos
            assert evento_ws["estatisticas"]["media_x"] == pytest.approx(25.0, abs=0.2)
            assert evento_ws["limites"]["lc"] is not None
            assert evento_ws["limites"]["lsc"] > evento_ws["limites"]["lc"]
            assert evento_ws["limites"]["lic"] < evento_ws["limites"]["lc"]

    # Média de latência deve ser excelente (geralmente < 80 ms em ambiente local)
    media_latencia = sum(latencias_ms) / len(latencias_ms)
    assert media_latencia < 200.0


def test_e2e_deteccao_anomalia_regras_nelson_via_websocket(
    test_client: TestClient,
    setup_processo_e_carta: tuple[str, str],
) -> None:
    """Valida detecção de causas especiais das Regras de Nelson e notificação imediata via WebSocket."""
    _proc_id, carta_id = setup_processo_e_carta

    with test_client.websocket_connect(f"/ws/cartas/{carta_id}") as ws:
        _ = ws.receive_json()  # Handshake

        # Popula subgrupos iniciais normais para estabelecer limites de controle
        for i in range(1, 4):
            res = test_client.post(
                f"/api/v1/cartas/{carta_id}/amostras",
                json={"valores": [25.0, 25.1, 24.9, 25.0, 25.0], "numero_subgrupo": i},
            )
            assert res.status_code == 201
            _ = ws.receive_json()

        # Injeta perturbação extrema (Regra 1: outlier além de 3 sigma, média = 35.0)
        res_anomalia = test_client.post(
            f"/api/v1/cartas/{carta_id}/amostras",
            json={"valores": [35.0, 35.1, 34.9, 35.2, 34.8], "numero_subgrupo": 4},
        )
        assert res_anomalia.status_code == 201
        dados_anomalia = res_anomalia.json()
        assert dados_anomalia["fora_de_controle"] is True

        # O WebSocket recebe o alarme em tempo real com detalhes da regra violada
        evento_alarme = ws.receive_json()
        assert evento_alarme["event"] == "NOVO_SUBGRUPO_PROCESSADO"
        assert evento_alarme["numero_subgrupo"] == 4
        assert evento_alarme["status_controle"]["fora_de_controle"] is True

        codigos_violados = [v["codigo_regra"] for v in evento_alarme["status_controle"]["regras_violadas"]]
        assert "REGRA_1" in codigos_violados


def test_e2e_concorrencia_multiplos_clientes_websocket(
    test_client: TestClient,
    setup_processo_e_carta: tuple[str, str],
) -> None:
    """Valida broadcast simultâneo para múltiplos clientes conectados na mesma carta."""
    _proc_id, carta_id = setup_processo_e_carta

    # Conecta 3 clientes WebSocket concorrentes
    with (
        test_client.websocket_connect(f"/ws/cartas/{carta_id}") as ws1,
        test_client.websocket_connect(f"/ws/cartas/{carta_id}") as ws2,
        test_client.websocket_connect(f"/ws/cartas/{carta_id}") as ws3,
    ):
        # Valida handshakes individuais
        assert ws1.receive_json()["status"] == "online"
        assert ws2.receive_json()["status"] == "online"
        assert ws3.receive_json()["status"] == "online"

        # Dispara ingestão via API REST
        amostra = [25.05, 24.95, 25.02, 24.98, 25.00]
        res_ingestao = test_client.post(
            f"/api/v1/cartas/{carta_id}/amostras",
            json={"valores": amostra, "numero_subgrupo": 1},
        )
        assert res_ingestao.status_code == 201

        # Todos os 3 clientes devem receber o mesmo pacote idêntico
        ev1 = ws1.receive_json()
        ev2 = ws2.receive_json()
        ev3 = ws3.receive_json()

        assert ev1["numero_subgrupo"] == 1
        assert ev2["numero_subgrupo"] == 1
        assert ev3["numero_subgrupo"] == 1
        assert ev1["estatisticas"]["media_x"] == ev2["estatisticas"]["media_x"] == ev3["estatisticas"]["media_x"]


def test_e2e_rejeicao_tamanho_invalido_rn02(
    test_client: TestClient,
    setup_processo_e_carta: tuple[str, str],
) -> None:
    """Valida que amostras com quantitativo incorreto são rejeitadas com HTTP 422 [RN02] sem poluir o WebSocket."""
    _proc_id, carta_id = setup_processo_e_carta

    with test_client.websocket_connect(f"/ws/cartas/{carta_id}") as ws:
        _ = ws.receive_json()  # Handshake

        # Envia apenas 3 medições quando a carta exige estritamente 5
        res_invalido = test_client.post(
            f"/api/v1/cartas/{carta_id}/amostras",
            json={"valores": [25.0, 25.1, 24.9]},
        )
        assert res_invalido.status_code == 422
        assert "esperado 5, recebido 3" in res_invalido.json()["detail"]

        # Keep-alive no WebSocket confirma que nenhum evento corrompido foi transmitido
        ws.send_text("ping")
        assert ws.receive_text() == "pong"


def test_e2e_importacao_lote_e_capacidade_processo(
    test_client: TestClient,
    setup_processo_e_carta: tuple[str, str],
) -> None:
    """Valida carga histórica em lote via POST /importar e cálculo dos índices de capacidade Cp e Cpk [RF08, RN04]."""
    _proc_id, carta_id = setup_processo_e_carta

    # Gera lote com 25 subgrupos estáveis de tamanho n=5
    lote = [
        [25.0 + ((i % 3) - 1) * 0.05 + ((j % 2) - 0.5) * 0.1 for j in range(5)]
        for i in range(25)
    ]

    res_lote = test_client.post(
        f"/api/v1/cartas/{carta_id}/importar",
        json={"amostras": lote},
    )
    assert res_lote.status_code == 201
    dados_lote = res_lote.json()
    assert dados_lote["total_importados"] == 25
    assert len(dados_lote["subgrupos"]) == 25

    # Consulta índices de capacidade do processo
    res_cap = test_client.get(f"/api/v1/cartas/{carta_id}/capacidade")
    assert res_cap.status_code == 200
    dados_cap = res_cap.json()

    assert dados_cap["carta_id"] == carta_id
    assert dados_cap["total_subgrupos"] == 25
    assert dados_cap["indices"]["cp"] is not None
    assert dados_cap["indices"]["cpk"] is not None
    assert dados_cap["indices"]["cp"] > 0
    assert "classificacao" in dados_cap

    # Consulta paginação/listagem histórica
    res_historico = test_client.get(f"/api/v1/cartas/{carta_id}/subgrupos?limite=10")
    assert res_historico.status_code == 200
    assert len(res_historico.json()) == 10
