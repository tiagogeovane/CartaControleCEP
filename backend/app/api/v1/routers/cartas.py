from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import (
    get_analise_capacidade_service,
    get_gerenciar_carta_service,
)
from app.api.schemas.carta import (
    CapacidadeResponse,
    CartaControleCreate,
    CartaControleResponse,
    IndicesCapacidadeSchema,
    LimitesControleSchema,
    LimitesEspecificacaoSchema,
    ModoLimitesUpdate,
)
from app.application.services.analise_capacidade import AnaliseCapacidadeService
from app.application.services.gerenciar_carta import GerenciarCartaService
from app.domain.entities.carta import CartaControle
from app.domain.value_objects.limites import LimitesEspecificacao

router = APIRouter()


def _formatar_carta_response(carta: CartaControle) -> CartaControleResponse:
    """Função auxiliar para mapear entidade CartaControle no schema CartaControleResponse."""
    specs_schema = None
    if carta.especificacoes is not None:
        specs_schema = LimitesEspecificacaoSchema(
            lse=carta.especificacoes.lse,
            lie=carta.especificacoes.lie,
            valor_nominal=carta.especificacoes.valor_nominal,
        )

    limites_schema = None
    if carta.limites_atuais is not None:
        limites_schema = LimitesControleSchema(
            lc=carta.limites_atuais.lc,
            lsc=carta.limites_atuais.lsc,
            lic=carta.limites_atuais.lic,
            sigma_estimado=carta.limites_atuais.sigma_estimado,
        )

    return CartaControleResponse(
        id=carta.id,
        processo_id=carta.processo_id,
        tipo_carta=carta.tipo_carta,
        tamanho_subgrupo=carta.tamanho_subgrupo,
        especificacoes=specs_schema,
        limites_atuais=limites_schema,
        modo_limites=carta.modo_limites,
        total_subgrupos=carta.total_subgrupos,
    )


@router.post(
    "",
    response_model=CartaControleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar Carta de Controle",
)
async def cadastrar_carta(
    dados: CartaControleCreate,
    service: Annotated[GerenciarCartaService, Depends(get_gerenciar_carta_service)],
) -> CartaControleResponse:
    """Cria e persiste uma nova Carta de Controle vinculada a um Processo Industrial.

    Caso o tipo de carta seja omitido, aplica a seleção automática da Regra [RN01].
    """
    especificacoes = None
    if dados.especificacoes is not None:
        especificacoes = LimitesEspecificacao(
            lse=dados.especificacoes.lse,
            lie=dados.especificacoes.lie,
            valor_nominal=dados.especificacoes.valor_nominal,
        )

    carta = await service.criar_carta(
        processo_id=dados.processo_id,
        tamanho_subgrupo=dados.tamanho_subgrupo,
        tipo_carta=dados.tipo_carta,
        especificacoes=especificacoes,
        modo_limites=dados.modo_limites,
    )

    return _formatar_carta_response(carta)


@router.get(
    "",
    response_model=list[CartaControleResponse],
    summary="Listar Cartas de Controle",
)
async def listar_cartas(
    service: Annotated[GerenciarCartaService, Depends(get_gerenciar_carta_service)],
    processo_id: Annotated[UUID | None, Query(description="Filtrar por processo")] = None,
) -> list[CartaControleResponse]:
    """Lista as cartas de controle cadastradas, com filtro opcional por processo industrial."""
    cartas = await service.listar_cartas(processo_id=processo_id)
    return [_formatar_carta_response(c) for c in cartas]


@router.get(
    "/{carta_id}",
    response_model=CartaControleResponse,
    summary="Detalhar Carta de Controle",
)
async def obter_carta(
    carta_id: UUID,
    service: Annotated[GerenciarCartaService, Depends(get_gerenciar_carta_service)],
) -> CartaControleResponse:
    """Recupera detalhes da carta de controle, limites calculados e histórico agregado."""
    carta = await service.obter_carta(carta_id)
    return _formatar_carta_response(carta)


@router.get(
    "/{carta_id}/capacidade",
    response_model=CapacidadeResponse,
    summary="Relatório de Capacidade do Processo (Cp/Cpk)",
)
async def obter_capacidade(
    carta_id: UUID,
    service: Annotated[AnaliseCapacidadeService, Depends(get_analise_capacidade_service)],
    criterio: Annotated[float, Query(description="Critério de aprovação do Cpk (padrão 1.33)")] = 1.33,
) -> CapacidadeResponse:
    """Calcula e retorna os índices de capacidade potencial (Cp) e real (Cpk) conforme a Regra [RN04]."""
    rel = await service.gerar_relatorio(carta_id=carta_id, criterio_aprovacao=criterio)

    specs = rel["especificacoes"]
    limites = rel["limites_controle"]
    ind = rel["indices"]

    return CapacidadeResponse(
        carta_id=rel["carta_id"],
        processo_id=rel["processo_id"],
        tipo_carta=rel["tipo_carta"],
        tamanho_subgrupo=rel["tamanho_subgrupo"],
        total_subgrupos=rel["total_subgrupos"],
        amostra_estatisticamente_robusta=rel["amostra_estatisticamente_robusta"],
        aviso=rel["aviso"],
        media_processo=rel["media_processo"],
        sigma_estimado=rel["sigma_estimado"],
        especificacoes=LimitesEspecificacaoSchema(
            lse=specs["lse"],
            lie=specs["lie"],
            valor_nominal=specs["valor_nominal"],
        ),
        limites_controle=LimitesControleSchema(
            lc=limites["lc"],
            lsc=limites["lsc"],
            lic=limites["lic"],
            sigma_estimado=rel["sigma_estimado"],
        ),
        indices=IndicesCapacidadeSchema(
            cp=ind["cp"],
            cpk=ind["cpk"],
            cpu=ind["cpu"],
            cpl=ind["cpl"],
        ),
        aprovado=rel["aprovado"],
        criterio_aprovacao=rel["criterio_aprovacao"],
        classificacao=rel["classificacao"],
    )


@router.patch(
    "/{carta_id}/especificacoes",
    response_model=CartaControleResponse,
    summary="Atualizar Limites de Especificação",
)
async def atualizar_especificacoes(
    carta_id: UUID,
    dados: LimitesEspecificacaoSchema,
    service: Annotated[GerenciarCartaService, Depends(get_gerenciar_carta_service)],
) -> CartaControleResponse:
    """Atualiza as tolerâncias de engenharia da carta de controle (LSE, LIE, Valor Nominal)."""
    specs = LimitesEspecificacao(
        lse=dados.lse,
        lie=dados.lie,
        valor_nominal=dados.valor_nominal,
    )
    carta = await service.atualizar_especificacoes(carta_id=carta_id, especificacoes=specs)
    return _formatar_carta_response(carta)


@router.patch(
    "/{carta_id}/modo",
    response_model=CartaControleResponse,
    summary="Alternar Modo de Limites (DINAMICO / FIXO)",
)
async def alternar_modo_limites(
    carta_id: UUID,
    dados: ModoLimitesUpdate,
    service: Annotated[GerenciarCartaService, Depends(get_gerenciar_carta_service)],
) -> CartaControleResponse:
    """Alterna o modo de atualização dos limites de controle entre DINAMICO e FIXO."""
    carta = await service.alternar_modo_limites(carta_id=carta_id, modo_limites=dados.modo_limites)
    return _formatar_carta_response(carta)
