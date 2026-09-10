from app.api.v1.routers.auth import router as auth_router
from app.api.v1.routers.cartas import router as cartas_router
from app.api.v1.routers.ingestao import router as ingestao_router
from app.api.v1.routers.processos import router as processos_router
from app.api.v1.websocket import router as websocket_router

__all__ = [
    "auth_router",
    "cartas_router",
    "ingestao_router",
    "processos_router",
    "websocket_router",
]
