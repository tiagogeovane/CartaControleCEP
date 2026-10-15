import asyncio
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import httpx
import pytest
from app.application.services.gerenciar_carta import GerenciarCartaService
from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    IProcessoRepository,
)
from scripts.json.simulador_json import SimuladorJsonCEP


class InMemoryCartaRepo(ICartaControleRepository):
    def __init__(self) -> None:
        self.cartas: dict[UUID, CartaControle] = {}

    async def obter_por_id(self, carta_id: UUID) -> CartaControle | None:
        return self.cartas.get(carta_id)

    async def salvar(self, carta: CartaControle) -> CartaControle:
        self.cartas[carta.id] = carta
        return carta

    async def listar_todas(self, processo_id: UUID | None = None) -> list[CartaControle]:
        return list(self.cartas.values())

    async def atualizar_limites(self, carta_id: UUID, novos_limites) -> None:
        if carta_id in self.cartas:
            self.cartas[carta_id].atualizar_limites(novos_limites)


class InMemoryProcessoRepo(IProcessoRepository):
    def __init__(self) -> None:
        self.processos: dict[UUID, Processo] = {}

    async def obter_por_id(self, processo_id: UUID) -> Processo | None:
        return self.processos.get(processo_id)

    async def salvar(self, processo: Processo) -> Processo:
        self.processos[processo.id] = processo
        return processo

    async def listar_todos(self) -> list[Processo]:
        return list(self.processos.values())


def test_is_dados_calibracao_deteccao():
    # 1. Goal Calibrar
    sim_calib = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
        metadados={"goal": "Calibrar"},
    )
    assert sim_calib._is_dados_calibracao() is True

    # 2. Goal Acompanhamento
    sim_acomp = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
        metadados={"goal": "Acompanhamento"},
    )
    assert sim_acomp._is_dados_calibracao() is False

    # 3. Goal Monitoramento
    sim_monit = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
        metadados={"goal": "Monitoramento"},
    )
    assert sim_monit._is_dados_calibracao() is False

    # 4. Override via tipo_operacao_override
    sim_override_calib = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
        metadados={"goal": "Acompanhamento"},
        tipo_operacao_override="CALIBRACAO",
    )
    assert sim_override_calib._is_dados_calibracao() is True

    sim_override_acomp = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
        metadados={"goal": "Calibrar"},
        tipo_operacao_override="ACOMPANHAMENTO",
    )
    assert sim_override_acomp._is_dados_calibracao() is False

    # 5. Sem goal: depende de total_existentes
    sim_sem_goal = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
        metadados={},
    )
    sim_sem_goal.total_existentes = 0
    assert sim_sem_goal._is_dados_calibracao() is True

    sim_sem_goal.total_existentes = 15
    assert sim_sem_goal._is_dados_calibracao() is False


def test_alternar_modo_limites_validacao():
    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
    )
    sim.carta_id = str(uuid4())

    with pytest.raises(ValueError, match="Modo de limites inválido"):
        sim.alternar_modo_limites("INVALIDO")

    sim.carta_id = None
    assert sim.alternar_modo_limites("FIXO") is False


def test_alternar_modo_limites_com_servico_injetado():
    carta_repo = InMemoryCartaRepo()
    proc_repo = InMemoryProcessoRepo()
    service = GerenciarCartaService(carta_repository=carta_repo, processo_repository=proc_repo)

    proc_id = uuid4()
    carta = CartaControle(
        processo_id=proc_id,
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        modo_limites="DINAMICO",
    )
    carta_repo.cartas[carta.id] = carta

    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0, 4.0, 5.0]}],
        gerenciar_carta_service=service,
    )
    sim.carta_id = str(carta.id)

    # 1. Altera para FIXO
    sucesso_fixo = sim.alternar_modo_limites("FIXO")
    assert sucesso_fixo is True
    assert sim.modo_limites == "FIXO"
    assert carta.modo_limites == "FIXO"

    # 2. Altera de volta para DINAMICO
    sucesso_din = sim.alternar_modo_limites("DINAMICO")
    assert sucesso_din is True
    assert sim.modo_limites == "DINAMICO"
    assert carta.modo_limites == "DINAMICO"


def test_alternar_modo_limites_via_http():
    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0]}],
    )
    carta_id = str(uuid4())
    sim.carta_id = carta_id

    # Mock client.patch
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"id": carta_id, "modo_limites": "FIXO"}

    with patch.object(sim.client, "patch", return_value=mock_resp) as mock_patch:
        sucesso = sim.alternar_modo_limites("FIXO")
        assert sucesso is True
        assert sim.modo_limites == "FIXO"
        mock_patch.assert_called_once_with(
            f"/api/v1/cartas/{carta_id}/modo",
            json={"modo_limites": "FIXO"},
        )


def test_obter_ou_criar_carta_alterna_modo_para_fixo_ao_receber_acompanhamento():
    carta_id = str(uuid4())
    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0, 4.0, 5.0]}],
        metadados={"id": carta_id, "goal": "Acompanhamento"},
        alternar_modo_limites=True,
    )

    # Mock GET /cartas/{id} retornando carta existente
    mock_get = MagicMock()
    mock_get.status_code = 200
    mock_get.json.return_value = {
        "id": carta_id,
        "processo_id": str(uuid4()),
        "total_subgrupos": 20,
        "modo_limites": "DINAMICO",
    }

    mock_patch = MagicMock()
    mock_patch.status_code = 200
    mock_patch.json.return_value = {"id": carta_id, "modo_limites": "FIXO"}

    with patch.object(sim.client, "get", return_value=mock_get), \
         patch.object(sim.client, "patch", return_value=mock_patch) as patch_spy:
        res_id = sim.obter_ou_criar_carta()
        assert res_id == carta_id
        assert sim.modo_limites == "FIXO"
        patch_spy.assert_called_once_with(
            f"/api/v1/cartas/{carta_id}/modo",
            json={"modo_limites": "FIXO"},
        )


def test_obter_ou_criar_carta_alterna_modo_para_dinamico_ao_receber_calibracao():
    carta_id = str(uuid4())
    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0, 4.0, 5.0]}],
        metadados={"id": carta_id, "goal": "Calibrar"},
        alternar_modo_limites=True,
    )

    # Mock GET /cartas/{id} retornando carta existente em modo FIXO
    mock_get = MagicMock()
    mock_get.status_code = 200
    mock_get.json.return_value = {
        "id": carta_id,
        "processo_id": str(uuid4()),
        "total_subgrupos": 30,
        "modo_limites": "FIXO",
    }

    mock_patch = MagicMock()
    mock_patch.status_code = 200
    mock_patch.json.return_value = {"id": carta_id, "modo_limites": "DINAMICO"}

    with patch.object(sim.client, "get", return_value=mock_get), \
         patch.object(sim.client, "patch", return_value=mock_patch) as patch_spy:
        res_id = sim.obter_ou_criar_carta()
        assert res_id == carta_id
        assert sim.modo_limites == "DINAMICO"
        patch_spy.assert_called_once_with(
            f"/api/v1/cartas/{carta_id}/modo",
            json={"modo_limites": "DINAMICO"},
        )


def test_obter_ou_criar_carta_sem_flag_nao_alterna_modo():
    carta_id = str(uuid4())
    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0, 4.0, 5.0]}],
        metadados={"id": carta_id, "goal": "Acompanhamento"},
        alternar_modo_limites=False,
    )

    mock_get = MagicMock()
    mock_get.status_code = 200
    mock_get.json.return_value = {
        "id": carta_id,
        "processo_id": str(uuid4()),
        "total_subgrupos": 20,
        "modo_limites": "DINAMICO",
    }

    with patch.object(sim.client, "get", return_value=mock_get), \
         patch.object(sim.client, "patch") as patch_spy:
        res_id = sim.obter_ou_criar_carta()
        assert res_id == carta_id
        patch_spy.assert_not_called()


def test_obter_ou_criar_carta_fallback_para_carta_existente_ao_receber_acompanhamento_com_id_404():
    id_404 = str(uuid4())
    carta_existente_id = str(uuid4())

    sim = SimuladorJsonCEP(
        base_url="http://test",
        subgrupos=[{"valores": [1.0, 2.0, 3.0, 4.0, 5.0]}],
        metadados={"id": id_404, "goal": "Acompanhamento"},
        alternar_modo_limites=True,
    )

    def mock_get_router(url, **kwargs):
        resp = MagicMock()
        if f"/api/v1/cartas/{id_404}" in url:
            resp.status_code = 404
            return resp
        if url == "/api/v1/cartas":
            resp.status_code = 200
            resp.json.return_value = [
                {
                    "id": carta_existente_id,
                    "processo_id": str(uuid4()),
                    "tamanho_subgrupo": 5,
                    "total_subgrupos": 20,
                    "modo_limites": "DINAMICO",
                    "criado_em": "2026-10-15T12:00:00",
                }
            ]
            return resp
        resp.status_code = 404
        return resp

    mock_patch = MagicMock()
    mock_patch.status_code = 200
    mock_patch.json.return_value = {"id": carta_existente_id, "modo_limites": "FIXO"}

    with patch.object(sim.client, "get", side_effect=mock_get_router), \
         patch.object(sim.client, "patch", return_value=mock_patch) as patch_spy:
        res_id = sim.obter_ou_criar_carta()
        assert res_id == carta_existente_id
        assert sim.modo_limites == "FIXO"
        assert sim.total_existentes == 20
        patch_spy.assert_called_once_with(
            f"/api/v1/cartas/{carta_existente_id}/modo",
            json={"modo_limites": "FIXO"},
        )

