from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.routers import (
    auth_router,
    cartas_router,
    ingestao_router,
    processos_router,
    websocket_router,
)
from app.core.config import settings
from app.domain.exceptions import (
    AmostraInvalidaError,
    DadosInsuficientesError,
    DominioException,
    EntidadeNaoEncontradaError,
    EspecificacoesNaoDefinidasError,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend de alta performance para monitoramento CEP em tempo real com Clean Architecture e WebSockets.",
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# Configuração de CORS para permitir acesso do frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS if settings.BACKEND_CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers Globais para o Domínio
@app.exception_handler(EntidadeNaoEncontradaError)
async def entidade_nao_encontrada_handler(_request: Request, exc: EntidadeNaoEncontradaError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"detail": exc.mensagem},
    )


@app.exception_handler(AmostraInvalidaError)
async def amostra_invalida_handler(_request: Request, exc: AmostraInvalidaError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.mensagem},
    )


@app.exception_handler(EspecificacoesNaoDefinidasError)
async def especificacoes_handler(_request: Request, exc: EspecificacoesNaoDefinidasError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.mensagem},
    )


@app.exception_handler(DadosInsuficientesError)
async def dados_insuficientes_handler(_request: Request, exc: DadosInsuficientesError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.mensagem},
    )


@app.exception_handler(DominioException)
async def dominio_generico_handler(_request: Request, exc: DominioException) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.mensagem},
    )


# Registro de Roteadores
app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["Autenticação"])
app.include_router(processos_router, prefix=f"{settings.API_V1_STR}/processos", tags=["Processos Industriais"])
app.include_router(cartas_router, prefix=f"{settings.API_V1_STR}/cartas", tags=["Cartas de Controle"])
app.include_router(ingestao_router, prefix=f"{settings.API_V1_STR}/cartas", tags=["Ingestão & Telemetria CEP"])
app.include_router(websocket_router, tags=["Tempo Real"])


@app.get("/health", tags=["Infraestrutura"])
async def health_check() -> dict[str, str]:
    """Health check operacional do backend."""
    return {"status": "ok", "service": "cep-backend"}
