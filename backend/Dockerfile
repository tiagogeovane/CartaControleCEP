# ==============================================================================
# Dockerfile Multi-Stage: Backend FastAPI CEP (Controle Estatístico de Processos)
# ==============================================================================

# Estágio 1: Builder - compilação e instalação isolada de dependências
FROM python:3.12-slim AS builder

WORKDIR /app

# Instala ferramentas essenciais para compilação caso necessárias
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Estágio 2: Imagem final enxuta de produção
FROM python:3.12-slim

WORKDIR /app

# Copia as dependências Python compiladas/instaladas do builder
COPY --from=builder /root/.local /root/.local

# Copia o código-fonte da aplicação
COPY . .

# Atualiza PATH com os binários do pip local
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# Executa migrações estruturais do Alembic e inicia o servidor Uvicorn ASGI
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
