# ==============================================================================
# Multi-Stage Dockerfile para Produção Industrial (React + Vite + Nginx Alpine)
# ==============================================================================

# Estágio 1: Compilação e Minificação do Frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências aproveitando cache de camadas do Docker
COPY package*.json ./
RUN npm ci

# Copiar código-fonte e compilar bundle estático otimizado
COPY . .
RUN npm run build

# Estágio 2: Servidor Web Leve com Nginx Alpine
FROM nginx:1.27-alpine AS runner

# Remover configuração padrão do Nginx e injetar configuração otimizada
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar artefatos gerados pelo build Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta 80 HTTP
EXPOSE 80

# Verificação de integridade interna do container
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
