from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    get_processamento_subgrupo_service,
    get_subgrupo_repository,
)
from app.api.schemas.subgrupo import (
    AmostraIngestaoRequest,
    EstatisticasResponse,
    ImportacaoLoteRequest,
    ImportacaoLoteResponse,
    SubgrupoResponse,
    ViolacaoRegraResponse,
)
from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.repositories import ISubgrupoRepository

router = APIRouter()


def _formatar_subgrupo_response(subgrupo: Subgrupo) -> SubgrupoResponse:
    """Mapeia uma entidade de domínio Subgrupo no DTO SubgrupoResponse."""
    return SubgrupoResponse(
        id=subgrupo.id,
        carta_id=subgrupo.carta_id,
        numero_subgrupo=subgrupo.numero_subgrupo,
        timestamp=subgrupo.timestamp,
        valores_brutos=list(subgrupo.valores_brutos),
        estatisticas=EstatisticasResponse(
            media_x=round(subgrupo.estatisticas.media_x, 4),
            amplitude_r=round(subgrupo.estatisticas.amplitude_r, 4),
            desvio_s=round(subgrupo.estatisticas.desvio_s, 4),
            valores_brutos=list(subgrupo.estatisticas.valores_brutos),
        ),
        fora_de_controle=subgrupo.fora_de_controle,
        violacoes=[
            ViolacaoRegraResponse(
                codigo_regra=v.codigo_regra,
                descricao=v.descricao,
                numero_subgrupo=v.numero_subgrupo,
                pontos_violadores=list(v.pontos_violadores),
            )
            for v in subgrupo.violacoes
        ],
    )


@router.post(
    "/{carta_id}/amostras",
    response_model=SubgrupoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingestão de Amostra de Subgrupo (Telemetria CEP)",
)
async def ingerir_amostra(
    carta_id: UUID,
    dados: AmostraIngestaoRequest,
    service: Annotated[ProcessamentoSubgrupoService, Depends(get_processamento_subgrupo_service)],
) -> SubgrupoResponse:
    """Endpoint principal de ingestão industrial [RF07].

    Calcula métricas pontuais, atualiza limites dinâmicos, avalia Regras de Nelson,
    persiste atomicamente e transmite o novo ponto instantaneamente via WebSockets.
    """
    subgrupo = await service.executar(
        carta_id=carta_id,
        amostras_valores=dados.valores,
        timestamp=dados.timestamp,
        numero_subgrupo=dados.numero_subgrupo,
        goal=dados.goal,
        modo_limites=dados.modo_limites,
    )
    return _formatar_subgrupo_response(subgrupo)


@router.post(
    "/{carta_id}/importar",
    response_model=ImportacaoLoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Importação de Dados Históricos em Lote",
)
async def importar_lote_amostras(
    carta_id: UUID,
    dados: ImportacaoLoteRequest,
    service: Annotated[ProcessamentoSubgrupoService, Depends(get_processamento_subgrupo_service)],
) -> ImportacaoLoteResponse:
    """Carga em massa de subgrupos históricos pré-coletados a partir de matriz numérica [RF08]."""
    subgrupos = await service.executar_lote(
        carta_id=carta_id,
        lote_amostras=dados.amostras,
        goal=dados.goal,
        modo_limites=dados.modo_limites,
    )
    return ImportacaoLoteResponse(
        carta_id=carta_id,
        total_importados=len(subgrupos),
        subgrupos=[_formatar_subgrupo_response(s) for s in subgrupos],
    )


@router.get(
    "/{carta_id}/subgrupos",
    response_model=list[SubgrupoResponse],
    summary="Consultar Histórico de Subgrupos",
)
async def listar_subgrupos_da_carta(
    carta_id: UUID,
    subgrupo_repo: Annotated[ISubgrupoRepository, Depends(get_subgrupo_repository)],
    limite: Annotated[int | None, Query(ge=1, le=1000, description="Número máximo de subgrupos mais recentes")] = None,
) -> list[SubgrupoResponse]:
    """Recupera os subgrupos coletados da carta de controle ordenados cronologicamente."""
    subgrupos = await subgrupo_repo.listar_por_carta(carta_id=carta_id, limite=limite)
    return [_formatar_subgrupo_response(s) for s in subgrupos]
