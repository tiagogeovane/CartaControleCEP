from datetime import datetime, timezone
from uuid import uuid4

from app.application.events.subgrupo_events import SubgrupoProcessadoEvent
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.value_objects.capacidade import IndicesCapacidade
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle
from app.domain.value_objects.violacao import ViolacaoRegra


def test_subgrupo_processado_event_to_dict_completo():
    """Valida serialização em dicionário conforme o contrato de WebSocket de Requisitos.md."""
    carta_id = uuid4()
    agora = datetime.now(timezone.utc)
    estatisticas = EstatisticasSubgrupo(
        media_x=25.42,
        amplitude_r=0.85,
        desvio_s=0.31,
        valores_brutos=(25.10, 25.50, 25.80, 25.20, 25.50),
    )
    limites = LimitesControle(lc=25.0, lsc=25.75, lic=24.25, sigma_estimado=0.25)
    violacao = ViolacaoRegra(
        codigo_regra="REGRA_1",
        descricao="Ponto além de 3 sigma",
        numero_subgrupo=26,
    )
    capacidade = IndicesCapacidade(cp=1.33, cpk=1.15, cpu=1.2, cpl=1.15)

    evento = SubgrupoProcessadoEvent(
        carta_id=carta_id,
        numero_subgrupo=26,
        timestamp=agora,
        estatisticas=estatisticas,
        valores_brutos=[25.10, 25.50, 25.80, 25.20, 25.50],
        limites=limites,
        fora_de_controle=True,
        violacoes=[violacao],
        capacidade=capacidade,
    )

    data = evento.to_dict()

    assert data["event"] == "NOVO_SUBGRUPO_PROCESSADO"
    assert data["carta_id"] == str(carta_id)
    assert data["numero_subgrupo"] == 26
    assert data["timestamp"] == agora.isoformat()
    assert data["estatisticas"]["media_x"] == 25.42
    assert data["estatisticas"]["amplitude_r"] == 0.85
    assert data["estatisticas"]["desvio_s"] == 0.31
    assert data["estatisticas"]["amostras_brutas"] == [25.10, 25.50, 25.80, 25.20, 25.50]
    assert data["limites"]["lc"] == 25.0
    assert data["limites"]["lsc"] == 25.75
    assert data["limites"]["lic"] == 24.25
    assert data["status_controle"]["fora_de_controle"] is True
    assert len(data["status_controle"]["regras_violadas"]) == 1
    assert data["status_controle"]["regras_violadas"][0]["codigo_regra"] == "REGRA_1"
    assert data["capacidade"]["cp"] == 1.33
    assert data["capacidade"]["cpk"] == 1.15


def test_subgrupo_processado_event_from_domain():
    """Valida a construção direta de evento a partir de instâncias de entidade Carta e Subgrupo."""
    proc_id = uuid4()
    carta = CartaControle(processo_id=proc_id, tipo_carta="X_R", tamanho_subgrupo=3)
    limites = LimitesControle(lc=10.0, lsc=12.0, lic=8.0, sigma_estimado=0.66)
    carta.atualizar_limites(limites)

    estatisticas = EstatisticasSubgrupo(
        media_x=10.5,
        amplitude_r=1.0,
        desvio_s=0.5,
        valores_brutos=(10.0, 11.0, 10.5),
    )
    subgrupo = Subgrupo(
        carta_id=carta.id,
        numero_subgrupo=1,
        valores_brutos=[10.0, 11.0, 10.5],
        estatisticas=estatisticas,
        fora_de_controle=False,
    )

    evento = SubgrupoProcessadoEvent.from_domain(carta, subgrupo)

    assert evento.carta_id == carta.id
    assert evento.numero_subgrupo == 1
    assert evento.limites == limites
    assert evento.fora_de_controle is False
    assert evento.violacoes == []
    assert evento.capacidade is None

    payload = evento.to_dict()
    assert payload["capacidade"] is None
    assert payload["status_controle"]["fora_de_controle"] is False
