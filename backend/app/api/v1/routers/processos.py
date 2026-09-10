from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_processo_repository
from app.api.schemas.processo import ProcessoCreate, ProcessoResponse
from app.domain.entities.processo import Processo
from app.domain.entities.usuario import Usuario
from app.domain.interfaces.repositories import IProcessoRepository

router = APIRouter()


@router.post(
    "",
    response_model=ProcessoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar Processo Industrial",
)
async def cadastrar_processo(
    dados: ProcessoCreate,
    processo_repo: Annotated[IProcessoRepository, Depends(get_processo_repository)],
    _usuario: Annotated[Usuario, Depends(get_current_user)],
) -> ProcessoResponse:
    """Cadastra um novo processo industrial ou linha de usinagem."""
    processo = Processo(
        nome=dados.nome,
        codigo_linha=dados.codigo_linha,
        descricao=dados.descricao,
    )
    salvo = await processo_repo.salvar(processo)
    return ProcessoResponse(
        id=salvo.id,
        nome=salvo.nome,
        codigo_linha=salvo.codigo_linha,
        descricao=salvo.descricao,
    )


@router.get(
    "",
    response_model=list[ProcessoResponse],
    summary="Listar Processos Industriais",
)
async def listar_processos(
    processo_repo: Annotated[IProcessoRepository, Depends(get_processo_repository)],
) -> list[ProcessoResponse]:
    """Lista todos os processos industriais cadastrados."""
    processos = await processo_repo.listar_todos()
    return [
        ProcessoResponse(
            id=p.id,
            nome=p.nome,
            codigo_linha=p.codigo_linha,
            descricao=p.descricao,
        )
        for p in processos
    ]


@router.get(
    "/{processo_id}",
    response_model=ProcessoResponse,
    summary="Detalhar Processo Industrial",
)
async def detalhar_processo(
    processo_id: UUID,
    processo_repo: Annotated[IProcessoRepository, Depends(get_processo_repository)],
) -> ProcessoResponse:
    """Busca os detalhes de um processo industrial pelo seu identificador único."""
    processo = await processo_repo.obter_por_id(processo_id)
    if processo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Processo '{processo_id}' não foi localizado.",
        )
    return ProcessoResponse(
        id=processo.id,
        nome=processo.nome,
        codigo_linha=processo.codigo_linha,
        descricao=processo.descricao,
    )
