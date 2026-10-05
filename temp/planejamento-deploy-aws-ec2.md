# Planejamento Operacional e Técnico: Deploy do Sistema de Controle Estatístico de Processos (CEP) na AWS EC2

> **Documento de Engenharia de Infraestrutura e Implantação Cloud**  
> **Versão:** 1.0.0  
> **Data:** 23/09/2026  
> **Projeto:** Sistema de Controle Estatístico de Processos (CEP / SPC) em Tempo Real  
> **Destino:** Instância Amazon Elastic Compute Cloud (AWS EC2)  
> **Orquestração:** Docker & Docker Compose  

---

## 1. Contextualização e Diagnóstico do Projeto

Com base na auditoria estrutural dos documentos presentes em `docs/` (`Planejamento.md`, `Requisitos.md`, `Backend/`, `frontend/` e `docker-compose.yml`), o sistema possui uma arquitetura moderna, reativa e de alto desempenho:

* **Backend:** FastAPI (Python 3.12+), Clean Architecture, computação científica ultra-rápida (NumPy/SciPy), migrações estruturais automatizadas (Alembic) e WebSockets nativos gerenciados em memória (`ConnectionManager`), eliminando dependências externas como Redis.
* **Persistência Relacional:** MySQL 8.0 (InnoDB + suporte a JSON nativo), orquestrado com healthcheck estrito e migrações executadas na inicialização do backend.
* **Frontend:** React (Vite + TypeScript), Tailwind CSS, Apache ECharts (`echarts-for-react`), Zustand e TanStack Query, empacotado em multi-stage build servido por **Nginx Alpine 1.27**.
* **Arquitetura de Borda (Nginx Integrado):** O container do frontend não apenas serve os arquivos estáticos compilados, mas atua como **Proxy Reverso Unificado**:
  * Requisições para `/api/` são roteadas internamente para `http://backend:8000/api/`.
  * Conexões para `/ws/` são roteadas com upgrade de protocolo HTTP/1.1 para `http://backend:8000/ws/`.
  * Roteamento de rotas SPA resolvido via `try_files $uri $uri/ /index.html`.
* **Vantagem de Implantação:** O cliente final acessa todo o sistema (páginas, APIs REST e WebSockets) através de uma **única porta web**.

---

## 2. Topologia de Infraestrutura na AWS EC2

A implantação padrão utiliza uma instância EC2 executando Linux (Ubuntu 24.04 LTS), isolada por um Security Group restritivo e com armazenamento EBS persistente.

```mermaid
flowchart TD
    subgraph Internet["Tráfego Externo (Internet)"]
        Admin["Administrador / DevOps (SSH :22)"]
        UserBrowser["Navegadores / IHM Chão de Fábrica (HTTP :80 / HTTPS :443)"]
        Simulador["Emissor IoT / Linha de Produção (REST :80/443)"]
    end

    subgraph AWS["Nuvem AWS (Região sa-east-1 ou us-east-1)"]
        subgraph VPC["VPC Padrão / Privada"]
            IGW["Internet Gateway"]
            EIP["Elastic IP (IP Público Estático)"]
            
            subgraph SG["Security Group: sg-cep-production"]
                direction TB
                Port22["Porta 22 (SSH - Restrita ao IP Admin)"]
                Port80["Porta 80 (HTTP Web)"]
                Port443["Porta 443 (HTTPS / WSS Seguro)"]
            end

            subgraph EC2["Instância AWS EC2 (Ubuntu 24.04 LTS - t3.small / t2.micro)"]
                OS["Sistema Operacional + Docker Engine + Swap 2GB"]
                
                subgraph Compose["Rede Docker Bridge (cep_network)"]
                    direction TB
                    
                    subgraph ContFrontend["Container: cep_frontend (Nginx Alpine)"]
                        Nginx["Porta 80 Interna<br/>(Mapeada para 80 ou 3000 do Host)"]
                        StaticFiles["Assets SPA React (/usr/share/nginx/html)"]
                    end
                    
                    subgraph ContBackend["Container: cep_backend (FastAPI / Uvicorn)"]
                        FastAPI["Porta 8000 Interna<br/>NumPy Engine + Alembic + WebSockets"]
                    end
                    
                    subgraph ContDB["Container: cep_mysql (MySQL 8.0)"]
                        MySQL["Porta 3306 Interna<br/>InnoDB + JSON Support"]
                    end
                end
                
                subgraph Storage["Armazenamento Persistente"]
                    EBS["Volume EBS gp3 (25 - 30 GB)"]
                    VolDocker["Volume Docker: cep_mysql_data"]
                end
            end
        end
    end

    Admin -->|SSH Porta 22| OS
    UserBrowser -->|HTTP/HTTPS| IGW
    Simulador -->|POST Telemetria| IGW
    IGW --> EIP --> SG
    
    SG -->|Porta 80 / 443| ContFrontend
    ContFrontend -->|Proxy /api/| ContBackend
    ContFrontend -->|Proxy /ws/ (Upgrade)| ContBackend
    ContBackend -->|SQLAlchemy Asyncmy| ContDB
    ContDB --> VolDocker
    VolDocker --> EBS
```

---

## 3. Especificação e Dimensionamento dos Recursos AWS

### 3.1. Tipo de Instância EC2
* **Ambiente de Testes / Homologação (Elegível para Free Tier):**
  * **Tipo:** `t2.micro` ou `t3.micro` (1 vCPU, 1 GB RAM).
  * *Requisito Mandatório:* Criação de **Swap de 2 GB** no Linux para evitar congelamento durante o build das imagens Docker.
* **Ambiente de Produção Recomendado:**
  * **Tipo:** `t3.small` (2 vCPUs, 2 GB RAM) ou `t3.medium` (2 vCPUs, 4 GB RAM).
  * Oferece performance estável com tráfego simultâneo de WebSockets, motor de cálculo NumPy e compilador sem risco de *Out Of Memory* (OOM).

### 3.2. Armazenamento (EBS)
* **Tamanho Mínimo:** 25 GB a 30 GB.
* **Tipo:** `gp3` (General Purpose SSD, 3000 IOPS de base, 125 MB/s de vazão).
* Justificativa: Camadas Docker de Python, Node e MySQL consomem cerca de 4 a 6 GB; os 20 GB adicionais garantem espaço para dados históricos, logs e crescimento da base.

### 3.3. Configuração de Regras do Security Group (`sg-cep-production`)

| Tipo | Protocolo | Porta | Origem | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| **Inbound** | TCP | `22` | `Seu-IP-Publico/32` | Acesso administrativo SSH seguro |
| **Inbound** | TCP | `80` | `0.0.0.0/0` | Acesso HTTP e renovação Let's Encrypt |
| **Inbound** | TCP | `443` | `0.0.0.0/0` | Acesso HTTPS seguro e WebSockets (WSS) |
| **Inbound** | TCP | `3000` | *(Opcional)* | Apenas se o compose mapear 3000:80 sem proxy de borda |
| **Outbound** | Todos | Todas | `0.0.0.0/0` | Download de pacotes apt, imagens Docker e atualizações |

> [!CAUTION]
> **Nunca abra as portas 3306 (MySQL) e 8000 (FastAPI) para a Internet aberta (`0.0.0.0/0`)**. A comunicação entre o frontend, backend e banco é isolada dentro da rede interna do Docker (`bridge`), em estrita conformidade com o requisito não-funcional de segurança **[RNF04]**.

---

## 4. Passo a Passo de Execução: Provisionamento na AWS

### Fase 1: Criar e Lançar a Instância EC2

1. Acesse o Console da AWS $\to$ Serviço **EC2** $\to$ **Launch Instance** (Executar Instância).
2. **Nome da Instância:** `cep-server-production`.
3. **AMI (Amazon Machine Image):** Selecione **Ubuntu Server 24.04 LTS (HVM)**, arquitetura `64-bit (x86)`.
4. **Tipo de Instância:** Escolha `t3.small` (ou `t2.micro` com o procedimento de Swap a seguir).
5. **Key Pair (Par de Chaves):**
   * Selecione um par existente ou crie um novo (ex: `cep-key.pem`). Baixe e proteja o arquivo com permissão restrita:
     ```bash
     chmod 400 cep-key.pem
     ```
6. **Configurações de Rede (Network Settings):**
   * Atribuir IP público: **Enable** (Habilitado).
   * Criar Security Group (`sg-cep-production`) liberando as portas 22 (SSH restrito), 80 (HTTP) e 443 (HTTPS).
7. **Configuração de Armazenamento:**
   * Altere o tamanho do volume raiz de 8 GB para **30 GB** tipo **gp3**.
8. Clique em **Launch Instance**.
9. *(Recomendado)* No menu lateral esquerdo, vá em **Elastic IPs**, aloque um novo IP estático e associe-o à instância criada para manter o IP fixo caso a máquina seja parada/reiniciada.

---

### Fase 2: Acesso e Preparação do Sistema Operacional

Conecte-se à instância via terminal:

```bash
ssh -i "cep-key.pem" ubuntu@<SEU_ELASTIC_IP>
```

#### 2.1. Atualização dos Pacotes do Sistema
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release htop git
```

#### 2.2. Configuração Mandatória de Memória SWAP (Essencial para instâncias `t2.micro` / `t3.micro`)
A compilação do bundle React com Vite e a instalação de pacotes Python podem consumir mais de 1 GB de pico de RAM. A criação de 2 GB de Swap evita falhas com código `137` (OOM Killer):

```bash
# Cria arquivo de swap de 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Torna o swap permanente após reinicializações
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Ajusta agressividade do swap (swappiness ideal para servidores)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

---

### Fase 3: Instalação Oficial do Docker e Docker Compose v2

Instale a versão mais recente e estável do Docker diretamente do repositório oficial da Docker Inc.:

```bash
# Adicionar chave GPG oficial do Docker
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Configurar o repositório estável
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker Engine, CLI, Containerd e Compose Plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Permitir executar comandos docker sem 'sudo'
sudo usermod -aG docker $USER

# Habilitar o Docker para iniciar com o boot do sistema
sudo systemctl enable docker
sudo systemctl start docker
```

> [!NOTE]
> Após adicionar seu usuário ao grupo `docker`, recarregue a sessão executando `newgrp docker` ou desconecte e reconecte no SSH para aplicar as permissões.

Verifique a instalação:
```bash
docker --version
docker compose version
```

---

### Fase 4: Implantação da Aplicação (Duas Abordagens)

Você pode escolher a **Abordagem 1** (mais simples e direta) ou a **Abordagem 2** (pipeline de entrega contínua recomendada para produção).

#### Opção A: Deploy Direto via Repositório Git (Recomendado para início rápido)

1. **Clonar o Repositório:**
   ```bash
   cd /home/ubuntu
   git clone https://github.com/TiagoUNB/Controle-Estatistico-de-Processos.git cep-app
   cd cep-app
   ```

2. **Gerar Variáveis de Ambiente Seguras para Produção:**
   Crie o arquivo `.env` a partir do template, gerando uma `SECRET_KEY` criptograficamente segura:

   ```bash
   cp .env.example .env
   
   # Gerar chave aleatória forte de 32 bytes para o JWT
   NOVA_SECRET=$(openssl rand -hex 32)
   sed -i "s|SECRET_KEY=.*|SECRET_KEY=$NOVA_SECRET|g" .env
   
   # Gerar senhas fortes para o banco de dados MySQL
   NOVA_SENHA_USER=$(openssl rand -hex 16)
   NOVA_SENHA_ROOT=$(openssl rand -hex 16)
   sed -i "s|MYSQL_PASSWORD=.*|MYSQL_PASSWORD=$NOVA_SENHA_USER|g" .env
   sed -i "s|MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=$NOVA_SENHA_ROOT|g" .env
   ```

3. **Ajuste da Porta Pública no `.env`:**
   Para que o frontend responda diretamente na porta padrão HTTP (80) da EC2 sem precisar digitar `:3000` no navegador:
   ```bash
   echo "FRONTEND_PORT=80" >> .env
   ```

4. **Isolar o MySQL na Máquina de Produção:**
   No `docker-compose.yml`, o serviço `db` expõe a porta `${MYSQL_PORT:-3306}:3306`. Embora o Security Group da AWS bloqueie acessos externos, em produção recomenda-se vincular apenas à interface de loopback interna (`127.0.0.1`) ou remover o mapeamento de portas da máquina host:
   ```bash
   echo "MYSQL_PORT=127.0.0.1:3306" >> .env
   echo "BACKEND_PORT=127.0.0.1:8000" >> .env
   ```

---

#### Opção B: Deploy Profissional com Imagens Pré-compiladas (GitHub Actions + AWS ECR / Docker Hub)

Se não desejar compilar o código na própria instância EC2 (poupando 100% de CPU e tempo na máquina), utilize um fluxo de CI/CD:

1. **Build e Push:** Um workflow do GitHub Actions compila as imagens `frontend` e `backend` e faz o push para o AWS ECR (*Elastic Container Registry*) ou Docker Hub.
2. **Atualização no Compose:** No `docker-compose.prod.yml`, substitua o bloco `build` pelo campo `image`:
   ```yaml
   services:
     backend:
       image: <sua-conta>.dkr.ecr.sa-east-1.amazonaws.com/cep-backend:latest
       ...
     frontend:
       image: <sua-conta>.dkr.ecr.sa-east-1.amazonaws.com/cep-frontend:latest
       ...
   ```
3. **Pull e Execução na EC2:**
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   ```

---

### Fase 5: Execução e Validação dos Contêineres

Na pasta da aplicação (`/home/ubuntu/cep-app`), execute:

```bash
docker compose up -d --build
```

#### O que o Docker Compose executa em cadeia automática:
1. Sobe o container `cep_mysql` (MySQL 8.0) e aguarda o healthcheck de `mysqladmin ping` confirmar prontidão.
2. Compila a imagem do backend e executa o comando turnkey:
   ```bash
   alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   Isso apl ica todas as migrações estruturais do banco de dados (tabelas de usuários, processos, cartas, subgrupos e anomalias).
3. Aguarda o backend reportar `/health` com status `healthy`.
4. Compila o frontend React (multi-stage com Node 20), extrai a pasta minificada `dist/` para o Nginx Alpine e sobe na porta 80.

#### Validação do Status dos Serviços:
```bash
docker compose ps
```
A saída esperada deve exibir todos os containers com status `Up` e `(healthy)`:
```text
NAME           IMAGE                      STATUS                    PORTS
cep_mysql      mysql:8.0                  Up (healthy)              127.0.0.1:3306->3306/tcp
cep_backend    cep-app-backend            Up (healthy)              127.0.0.1:8000->8000/tcp
cep_frontend   cep-app-frontend           Up (healthy)              0.0.0.0:80->80/tcp
```

#### Verificação dos Logs em Tempo Real:
```bash
# Visualizar logs consolidados
docker compose logs -f

# Ou logs específicos da migração do Alembic e inicialização do FastAPI:
docker compose logs backend
```

---

## 5. Exposição Segura com Domínio e Certificado HTTPS / SSL

O sistema utiliza WebSockets (`ws://` ou `wss://`). **Regra da Web Moderna:** Se o frontend for acessado via HTTPS, os navegadores (Chrome, Firefox, Safari) bloqueiam conexões WebSocket inseguras (`ws://`) por política de conteúdo misto (*Mixed Content*). O código do frontend em `frontend/src/hooks/useWebSocketCEP.ts` já está preparado para alternar automaticamente:
```ts
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
```
Portanto, adicionar um domínio e certificado SSL Let's Encrypt garante comunicação criptografada ponta a ponta e funcionamento perfeito do streaming de dados.

### Opção Recomendada: Nginx de Borda no Host com Certbot

Nesta abordagem, o Docker Compose roda o frontend na porta local `127.0.0.1:3000`, e o Nginx instalado no host da EC2 gerencia as portas 80 e 443 com certificado renovado automaticamente pelo Certbot.

1. **Ajuste no `.env` da aplicação:**
   ```bash
   FRONTEND_PORT=127.0.0.1:3000
   ```
   Reinicie os containers:
   ```bash
   docker compose up -d
   ```

2. **Instalar Nginx e Certbot no Ubuntu:**
   ```bash
   sudo apt-get install -y nginx certbot python3-certbot-nginx
   ```

3. **Criar a Configuração do Nginx (`/etc/nginx/sites-available/cep.conf`):**
   ```nginx
   server {
       server_name cep.seudominio.com.br;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 86400s;
           proxy_send_timeout 86400s;
       }
   }
   ```

4. **Ativar o Site e Obter o Certificado:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/cep.conf /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl reload nginx

   # Emitir certificado SSL gratuito Let's Encrypt com redirecionamento automático
   sudo certbot --nginx -d cep.seudominio.com.br
   ```

O Certbot configurará a renovação automática via timer do systemd (`certbot.timer`).

---

## 6. Automação do Ciclo de Vida do Sistema (Systemd)

Para garantir que toda a malha de containers suba automaticamente caso a instância EC2 seja reiniciada ou sofra manutenção de hardware da AWS, configure um serviço no `systemd`:

1. **Criar o arquivo da unidade (`/etc/systemd/system/cep-docker.service`):**
   ```ini
   [Unit]
   Description=Servico Docker Compose - Controle Estatistico de Processos (CEP)
   Requires=docker.service
   After=docker.service network-online.target
   Wants=network-online.target

   [Service]
   Type=oneshot
   RemainAfterExit=yes
   WorkingDirectory=/home/ubuntu/cep-app
   User=ubuntu
   Group=docker
   ExecStart=/usr/bin/docker compose up -d
   ExecStop=/usr/bin/docker compose down
   TimeoutStartSec=300

   [Install]
   WantedBy=multi-user.target
   ```

2. **Habilitar o Serviço:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable cep-docker.service
   ```

---

## 7. Configuração de Rotação de Logs do Docker

Para evitar que os logs dos contêineres preencham todo o espaço em disco do volume EBS ao longo de meses de telemetria contínua, configure a rotação nativa do daemon Docker:

Crie ou edite `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  }
}
```

Reinicie o daemon:
```bash
sudo systemctl restart docker
```

---

## 8. Testes e Validação Pós-Deploy

Com o deploy concluído, execute os testes de integridade para homologar a entrega:

### 8.1. Teste de Healthcheck HTTP
```bash
curl -i http://localhost/api/v1/openapi.json
# Ou se configurado na porta 80 do IP público:
curl -i http://<SEU_ELASTIC_IP>/health
```
Resposta esperada: `{"status": "ok", "service": "cep-backend"}` com HTTP `200 OK`.

### 8.2. Validação E2E com o Simulador IoT
O projeto possui um script emulador de máquina industrial (`backend/scripts/simulador_iot.py`). Você pode executá-lo a partir de qualquer computador ou dentro da própria EC2 para validar o fluxo em tempo real:

```bash
# Executando dentro da máquina ou de uma máquina externa apontando para a nuvem:
python3 backend/scripts/simulador_iot.py --url http://<SEU_ELASTIC_IP> -i 1.5 -n 50
```

**Resultado Observável:**
1. O simulador se autentica automaticamente no endpoint `/api/v1/auth/register`.
2. Cria ou localiza o processo `CNC-SIM-01` e a carta $\bar{X}-R$.
3. Emite subgrupos estáveis e perturbações estatísticas para testar as 8 Regras de Nelson.
4. Abra o navegador no IP da EC2 (`http://<SEU_ELASTIC_IP>` ou seu domínio) e comprove que o gráfico ECharts atualiza a cada 1.5 segundos sem recarregar a tela, com pontos anômalos pintados em vermelho.

---

## 9. Política de Backup e Recuperação de Desastres (DR)

### 9.1. Backup Automático do Banco MySQL
Crie um script simples em `/home/ubuntu/backup_mysql.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATA=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker exec cep_mysql /usr/bin/mysqldump -u cep_user -pcep_password cep_db | gzip > "$BACKUP_DIR/cep_db_$DATA.sql.gz"

# Rotação local: remove backups com mais de 7 dias
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# (Opcional) Enviar cópia criptografada para o Amazon S3:
# aws s3 cp "$BACKUP_DIR/cep_db_$DATA.sql.gz" s3://meu-bucket-backups-cep/
```
Torne-o executável e agende no `crontab` diário:
```bash
chmod +x /home/ubuntu/backup_mysql.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /home/ubuntu/backup_mysql.sh") | crontab -
```

### 9.2. Snapshot do Volume EBS
Na AWS, habilite uma política do **Amazon Data Lifecycle Manager (DLM)** para tirar snapshots automáticos diários do volume EBS da instância, retendo os últimos 14 dias com impacto nulo na operação.

---

## 10. Procedimento Operacional de Atualização (CI/CD / Rollout)

Quando houver novas alterações ou correções no código, o procedimento de atualização na EC2 é executado com zero fricção:

```bash
cd /home/ubuntu/cep-app

# 1. Puxar alterações do repositório
git pull origin main

# 2. Reconstruir as imagens com cache inteligente e reiniciar
docker compose up -d --build

# 3. Remover imagens órfãs antigas para liberar espaço em disco
docker image prune -f

# 4. Verificar saúde dos serviços
docker compose ps
```

Caso uma migração com erro seja lançada:
```bash
# Rollback do banco via Alembic
docker exec -it cep_backend alembic downgrade -1
```

---

## 11. Checklist de Homologação Final

| Etapa | Item de Verificação | Status |
| :---: | :--- | :---: |
| 1 | Instância EC2 criada com Ubuntu 24.04 e volume EBS de 30 GB gp3 | [ ] |
| 2 | Elastic IP associado à instância | [ ] |
| 3 | Security Group configurado (apenas portas 22, 80 e 443 abertas) | [ ] |
| 4 | Memória Swap de 2 GB criada e ativa no sistema | [ ] |
| 5 | Docker Engine e Docker Compose v2 instalados com serviço habilitado | [ ] |
| 6 | Arquivo `.env` configurado com chaves e senhas criptográficas fortes | [ ] |
| 7 | Portas 3306 e 8000 isoladas no host / loopback | [ ] |
| 8 | Containers iniciados com sucesso (`cep_mysql`, `cep_backend`, `cep_frontend` com status `healthy`) | [ ] |
| 9 | Migrações do Alembic executadas automaticamente na inicialização | [ ] |
| 10 | Acesso web via navegador exibindo a interface Dark Mode do CEP | [ ] |
| 11 | Ingestão e streaming via WebSocket validados em tempo real via Simulador IoT | [ ] |
| 12 | Certificado SSL (Let's Encrypt) instalado para suporte a HTTPS e WSS | [ ] |
| 13 | Serviço `systemd` ativado para inicialização com o boot do servidor | [ ] |
| 14 | Script de backup do MySQL configurado no crontab | [ ] |
