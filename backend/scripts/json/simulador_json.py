#!/usr/bin/env python3
"""Script de Ingestão e Simulação de Dados via JSON para o Controle Estatístico de Processos (CEP).

Lê subgrupos amostrais pré-existentes a partir de um arquivo JSON estruturado conforme
a especificação do aplicador do teste (Unit, Measured_at, Created_by, Type, Goal, LSE, LIE, Data)
e os transmite para o endpoint de ingestão da API REST (POST /api/v1/cartas/{id}/amostras).

Permite validar o cálculo dos limites de controle, as 8 Regras de Nelson e a exibição
em tempo real no dashboard Frontend via WebSockets sem geração de dados aleatórios.
Suporta alternância de modo de limites (FIXO vs DINAMICO) via GerenciarCartaService.
"""

import argparse
import json
import math
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx

# Inclusão do diretório raiz do backend no sys.path para garantir importações dos serviços
_backend_root = Path(__file__).resolve().parents[2]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

try:
    from app.application.services.gerenciar_carta import GerenciarCartaService
except ImportError:
    GerenciarCartaService = Any  # type: ignore


def carregar_dados_json(caminho_arquivo: Path | str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Carrega e normaliza os subgrupos amostrais a partir de um arquivo JSON.

    Estrutura padrão oficial:
    {
      "Unit": "mm",
      "Measured_at": "2026-10-09 12:00:00",
      "Created_by": "Henrique",
      "Type": "X",
      "Goal": "Calibrar",
      "LSE": 5.0,
      "LIE": 4.0,
      "Data": [
        [4.96, 4.946, 4.95, 4.956, 4.958],
        ...
      ]
    }

    Retorna:
        Uma tupla contendo (lista_subgrupos_normalizados, metadados_do_arquivo).
    """
    path = Path(caminho_arquivo)
    if not path.is_file():
        raise FileNotFoundError(f"Arquivo JSON não encontrado no caminho: {path.resolve()}")

    with open(path, "r", encoding="utf-8") as f:
        dados_brutos = json.load(f)

    metadados: dict[str, Any] = {}
    subgrupos_raw: list[Any] = []

    if isinstance(dados_brutos, dict):
        raw_id = (
            dados_brutos.get("ID")
            or dados_brutos.get("id")
            or dados_brutos.get("Id")
            or dados_brutos.get("Carta_id")
            or dados_brutos.get("carta_id")
        )
        id_str = str(raw_id).strip() if raw_id is not None else None
        if id_str in ("", "null", "None"):
            id_str = None

        # Mapeia chaves oficiais (com fallback tolerante para minúsculas)
        metadados = {
            "id": id_str,
            "unit": dados_brutos.get("Unit") or dados_brutos.get("unit") or "mm",
            "measured_at": dados_brutos.get("Measured_at") or dados_brutos.get("measured_at"),
            "created_by": dados_brutos.get("Created_by") or dados_brutos.get("created_by") or "Operador",
            "type": dados_brutos.get("Type") or dados_brutos.get("type") or "X",
            "goal": dados_brutos.get("Goal") or dados_brutos.get("goal") or "Monitoramento",
            "lse": dados_brutos.get("LSE") if dados_brutos.get("LSE") is not None else dados_brutos.get("lse"),
            "lie": dados_brutos.get("LIE") if dados_brutos.get("LIE") is not None else dados_brutos.get("lie"),
            "codigo_linha": dados_brutos.get("codigo_linha") or dados_brutos.get("Codigo_Linha"),
            "intervalo": dados_brutos.get("intervalo") or dados_brutos.get("Intervalo"),
        }

        # Busca matriz de subgrupos prioritariamente na chave 'Data'
        for chave in ("Data", "data", "amostras", "subgrupos", "dados", "leituras"):
            if chave in dados_brutos and isinstance(dados_brutos[chave], list):
                subgrupos_raw = dados_brutos[chave]
                break

        # Suporte a objeto com especificações aninhadas (fallback de formato antigo)
        if (metadados["lse"] is None or metadados["lie"] is None) and isinstance(dados_brutos.get("especificacoes"), dict):
            specs = dados_brutos["especificacoes"]
            metadados["lse"] = specs.get("lse") or specs.get("LSE")
            metadados["lie"] = specs.get("lie") or specs.get("LIE")
            metadados["valor_nominal"] = specs.get("valor_nominal")

    elif isinstance(dados_brutos, list):
        subgrupos_raw = dados_brutos
    else:
        raise ValueError("Estrutura JSON inválida. Esperado um objeto {...} ou array [...].")

    if not subgrupos_raw:
        raise ValueError("O arquivo JSON não contém nenhum dado em 'Data' ou 'amostras' para processamento.")

    subgrupos_normalizados: list[dict[str, Any]] = []

    # Processa data base para timestamps incrementais
    data_base: datetime | None = None
    if metadados.get("measured_at"):
        try:
            # Tenta parsing de formato comum "YYYY-MM-DD HH:MM:SS" ou ISO
            texto_ts = str(metadados["measured_at"]).strip()
            if "T" in texto_ts:
                data_base = datetime.fromisoformat(texto_ts.replace("Z", "+00:00"))
            else:
                data_base = datetime.strptime(texto_ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            data_base = None

    for idx, item in enumerate(subgrupos_raw, start=1):
        ts_calculado = None
        if data_base:
            ts_calculado = (data_base + timedelta(minutes=(idx - 1) * 5)).isoformat()

        if isinstance(item, (int, float)):
            # Formato escalar para cartas com n=1 (ex: Carta C com contagens por lote)
            subgrupos_normalizados.append({
                "valores": [float(item)],
                "numero_subgrupo": None,
                "timestamp": ts_calculado,
                "comentario": None,
            })
        elif isinstance(item, list):
            # Formato padrão: matriz numérica [4.96, 4.946, ...]
            valores = [float(v) for v in item]
            subgrupos_normalizados.append({
                "valores": valores,
                "numero_subgrupo": None,
                "timestamp": ts_calculado,
                "comentario": None,
            })
        elif isinstance(item, dict):
            # Formato de objeto individual com chave 'valores'
            raw_vals = item.get("valores") or item.get("amostras") or item.get("Data") or item.get("data")
            if not raw_vals or not isinstance(raw_vals, list):
                raise ValueError(f"Subgrupo #{idx} no JSON não contém lista de valores válida.")
            valores = [float(v) for v in raw_vals]
            subgrupos_normalizados.append({
                "valores": valores,
                "numero_subgrupo": item.get("numero_subgrupo"),
                "timestamp": item.get("timestamp") or ts_calculado,
                "comentario": item.get("comentario") or item.get("descricao"),
            })
        else:
            raise ValueError(f"Formato inválido no subgrupo #{idx} do JSON: {item}")

    return subgrupos_normalizados, metadados


class SimuladorJsonCEP:
    """Orquestrador de envio de dados pré-definidos via JSON para a API de CEP."""

    def __init__(
        self,
        base_url: str,
        subgrupos: list[dict[str, Any]],
        intervalo: float = 1.0,
        metadados: dict[str, Any] | None = None,
        email: str = "admin@cep.com",
        senha: str = "Admin123!",
        especificacoes_override: dict[str, float] | None = None,
        alternar_modo_limites: bool = True,
        tipo_operacao_override: str | None = None,
        modo_limites_manual: str | None = None,
        gerenciar_carta_service: Any = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.subgrupos = subgrupos
        self.intervalo = intervalo
        self.metadados = metadados or {}
        self.email = email
        self.senha = senha
        self.especificacoes_override = especificacoes_override
        self.alternar_modo_limites_flag = alternar_modo_limites
        self.tipo_operacao_override = tipo_operacao_override
        self.modo_limites_manual = modo_limites_manual
        self.gerenciar_carta_service = gerenciar_carta_service
        self.modo_limites = "DINAMICO"

        # Define tamanho do subgrupo com base no primeiro item
        self.tamanho_subgrupo = (
            len(self.subgrupos[0]["valores"]) if self.subgrupos else 5
        )

        self.client = httpx.Client(base_url=self.base_url, timeout=15.0)
        self.token: str | None = None
        self.carta_id: str | None = None
        self.processo_id: str | None = None
        self.total_existentes = 0

        # Estatísticas acumuladas da sessão
        self.total_enviados = 0
        self.total_sob_controle = 0
        self.total_fora_controle = 0
        self.latencias_ms: list[float] = []
        self.violacoes_por_regra: dict[str, int] = {}

    def close(self) -> None:
        """Encerra a sessão HTTP."""
        self.client.close()

    def verificar_servidor(self) -> bool:
        """Verifica se o backend está online e respondendo ao endpoint de healthcheck."""
        try:
            res = self.client.get("/health")
            return res.status_code == 200
        except httpx.RequestError as exc:
            print(f"❌ Erro ao conectar ao servidor em {self.base_url}: {exc}")
            return False

    def autenticar_ou_registrar(self) -> str:
        """Realiza login ou registra operador para obter token de autorização Bearer."""
        res_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": self.email, "senha": self.senha},
        )
        if res_login.status_code == 200:
            token = res_login.json()["access_token"]
            self.token = token
            self.client.headers["Authorization"] = f"Bearer {token}"
            return token

        res_reg = self.client.post(
            "/api/v1/auth/register",
            json={
                "nome": self.metadados.get("created_by") or "Operador Ingestão JSON",
                "email": self.email,
                "senha": self.senha,
                "perfil": "ADMIN",
            },
        )
        if res_reg.status_code not in (201, 400):
            raise RuntimeError(f"Falha ao registrar usuário: {res_reg.text}")

        res_login2 = self.client.post(
            "/api/v1/auth/login",
            json={"email": self.email, "senha": self.senha},
        )
        if res_login2.status_code != 200:
            raise RuntimeError(f"Falha na autenticação após registro: {res_login2.text}")

        token = res_login2.json()["access_token"]
        self.token = token
        self.client.headers["Authorization"] = f"Bearer {token}"
        return token

    def _is_dados_calibracao(self) -> bool:
        """Determina se o conjunto de dados sendo processado é de Calibração ou Acompanhamento.

        Critérios de avaliação:
        1. Override direto via argumento CLI (--calibracao / --acompanhamento).
        2. Campo 'goal' (ou 'Goal') do JSON:
           - Se contiver 'calibr' -> True (Fase de Calibração/Estudo).
           - Se contiver 'acompanh' ou 'monitor' -> False (Fase de Acompanhamento/Monitoramento).
        3. Existência prévia de subgrupos na carta:
           - 0 subgrupos -> True (Calibração inicial).
           - > 0 subgrupos -> False (Acompanhamento contínuo).
        """
        if self.tipo_operacao_override:
            return self.tipo_operacao_override.upper() == "CALIBRACAO"

        goal = str(self.metadados.get("goal") or "").strip().lower()
        if "calibr" in goal:
            return True
        if "acompanh" in goal or "monitor" in goal:
            return False

        return self.total_existentes == 0

    def alternar_modo_limites(self, modo: str) -> bool:
        """Alterna o modo de cálculo de limites da carta ('FIXO' ou 'DINAMICO').

        Invoca o método `alternar_modo_limites` da classe `GerenciarCartaService`
        (localizada em `backend/app/application/services/gerenciar_carta.py`) através
        do endpoint PATCH /api/v1/cartas/{carta_id}/modo da API REST, ou diretamente
        em memória caso uma instância de GerenciarCartaService tenha sido fornecida.

        Em modo FIXO: os limites calculados na calibração são congelados para monitoramento.
        Em modo DINAMICO: os limites são recalculados a cada novo subgrupo amostral recebido.
        """
        if not self.carta_id:
            print("⚠️ ID da carta não definido. Não é possível alternar o modo de limites.")
            return False

        modo_normalizado = modo.strip().upper()
        if modo_normalizado not in ("DINAMICO", "FIXO"):
            raise ValueError(f"Modo de limites inválido: '{modo}'. Permitidos: 'DINAMICO' ou 'FIXO'.")

        print(f"🔄 Solicitando alternância de modo para '{modo_normalizado}' via GerenciarCartaService.alternar_modo_limites...")

        # 1. Injeção direta em memória da instância GerenciarCartaService (se fornecida)
        if self.gerenciar_carta_service is not None:
            import asyncio
            try:
                coro = self.gerenciar_carta_service.alternar_modo_limites(
                    carta_id=self.carta_id,
                    modo_limites=modo_normalizado,
                )
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = None

                if loop and loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        pool.submit(asyncio.run, coro).result()
                else:
                    asyncio.run(coro)

                self.modo_limites = modo_normalizado
                icone = "🔒" if modo_normalizado == "FIXO" else "📈"
                print(f"{icone} Modo de limites alterado para '{modo_normalizado}' diretamente via GerenciarCartaService!")
                return True
            except Exception as exc:
                print(f"❌ Falha ao invocar GerenciarCartaService diretamente: {exc}")
                return False

        # 2. Invocação padrão via API REST (PATCH /api/v1/cartas/{id}/modo)
        try:
            res = self.client.patch(
                f"/api/v1/cartas/{self.carta_id}/modo",
                json={"modo_limites": modo_normalizado},
            )
            if res.status_code == 200:
                dados = res.json()
                self.modo_limites = dados.get("modo_limites", modo_normalizado)
                icone = "🔒" if modo_normalizado == "FIXO" else "📈"
                desc = "limites congelados" if modo_normalizado == "FIXO" else "limites dinâmicos recalculados"
                print(f"{icone} Modo de limites alterado para '{self.modo_limites}' com sucesso via GerenciarCartaService ({desc})!")
                return True
            else:
                print(f"❌ Falha ao alternar modo de limites (Status {res.status_code}): {res.text}")
                return False
        except httpx.RequestError as exc:
            print(f"❌ Erro de conexão ao alternar modo de limites em {self.base_url}: {exc}")
            return False

    def _aplicar_gerenciamento_modo_limites(self) -> None:
        """Aplica a regra de alternância de modo de limites se a flag estiver ativa ou se houver override manual."""
        if self.modo_limites_manual:
            self.alternar_modo_limites(self.modo_limites_manual)
            return

        if not self.alternar_modo_limites_flag:
            return

        is_calibracao = self._is_dados_calibracao()
        if is_calibracao:
            # Caso sejam enviados novos dados de calibração, altera o modo para DINAMICO
            print("📈 Dados de CALIBRAÇÃO detectados para a carta existente.")
            self.alternar_modo_limites("DINAMICO")
        else:
            # Caso carta existente receba dados de acompanhamento, altera o modo para FIXO
            print("🔒 Dados de ACOMPANHAMENTO detectados para a carta existente.")
            self.alternar_modo_limites("FIXO")

    def _obter_tipo_carta_apropriado(self) -> str:
        """Mapeia o 'Type' informado no JSON para as estratégias do motor CEP conforme [RN01]."""
        tipo_json = str(self.metadados.get("type", "X")).strip().upper()

        if tipo_json in ("P", "C"):
            return tipo_json
        if tipo_json in ("X_S", "XS"):
            return "X_S"
        if tipo_json in ("I_MR", "IMR", "I"):
            return "I_MR"
        if tipo_json in ("X_R", "XR"):
            return "X_R"

        # Se for "X", aplica seleção por tamanho amostral n
        if self.tamanho_subgrupo == 1:
            return "I_MR"
        elif self.tamanho_subgrupo <= 10:
            return "X_R"
        else:
            return "X_S"

    def _obter_especificacoes_finais(self) -> dict[str, float] | None:
        """Obtém ou calcula limites de engenharia (LSE, LIE e valor nominal)."""
        if self.especificacoes_override:
            return self.especificacoes_override

        tipo_final = self._obter_tipo_carta_apropriado()

        lse_val = self.metadados.get("lse")
        lie_val = self.metadados.get("lie")

        if lse_val is not None and lie_val is not None:
            lse = float(lse_val)
            lie = float(lie_val)
            nominal = round((lse + lie) / 2.0, 4)
            return {"lse": lse, "lie": lie, "valor_nominal": nominal}

        # Cartas por atributos (P e C) não exigem limites de especificação
        if tipo_final in ("P", "C"):
            return None

        # Cálculo estatístico baseado na amostra se omitido no JSON
        todos_valores: list[float] = []
        for sg in self.subgrupos:
            todos_valores.extend(sg["valores"])

        if not todos_valores:
            return {"lse": 5.0, "lie": 4.0, "valor_nominal": 4.5}

        media = sum(todos_valores) / len(todos_valores)
        variancia = sum((x - media) ** 2 for x in todos_valores) / max(1, len(todos_valores) - 1)
        desvio = math.sqrt(variancia) if variancia > 0 else 0.05
        tolerancia = max(3.5 * desvio, 0.1)

        return {
            "lse": round(media + tolerancia, 4),
            "lie": round(media - tolerancia, 4),
            "valor_nominal": round(media, 4),
        }

    def obter_ou_criar_carta(
        self,
        carta_id: str | None = None,
        codigo_linha: str | None = None,
        nova_carta: bool = False,
    ) -> str:
        """Obtém carta existente ou cria novo processo e carta com tolerâncias industriais.

        Resolução inteligente do ID:
        1. Se carta_id for informado (via flag CLI --carta-id) ou existir o campo 'ID' no JSON:
           - Valida se o valor possui formato UUID válido.
           - Consulta a API em GET /api/v1/cartas/{id}.
           - Se a carta EXISTIR no banco (HTTP 200), utiliza a carta para envio de ACOMPANHAMENTO.
           - Se NÃO existir (HTTP 404) ou ID for inválido, emite aviso e cria uma nova carta.
        2. Se nenhum ID for informado, cria uma nova carta automaticamente para CALIBRAÇÃO.
        """
        # Prioridade: parâmetro explícito de linha de comando > campo 'id' extraído do JSON
        id_candidato = carta_id or self.metadados.get("id")

        if id_candidato and not nova_carta:
            id_limpo = str(id_candidato).strip()
            uuid_valido = False
            try:
                UUID(id_limpo)
                uuid_valido = True
            except ValueError:
                print(f"⚠️ O ID informado ('{id_limpo}') não é um UUID válido.")
                print("🆕 Criando uma nova carta de controle para os dados...")

            if uuid_valido:
                print(f"🔍 Verificando existência da carta '{id_limpo}' na base de dados...")
                res = self.client.get(f"/api/v1/cartas/{id_limpo}")
                if res.status_code == 200:
                    dados_carta = res.json()
                    self.carta_id = id_limpo
                    self.total_existentes = dados_carta.get("total_subgrupos", 0)
                    self.processo_id = dados_carta.get("processo_id")
                    self.modo_limites = dados_carta.get("modo_limites", "DINAMICO")

                    op_nome = "CALIBRAÇÃO" if self._is_dados_calibracao() else "ACOMPANHAMENTO"
                    print("\n" + "=" * 80)
                    print(f"🔗 CARTA EXISTENTE LOCALIZADA NA BASE DE DADOS!")
                    print(f"🆔 ID da Carta:         {self.carta_id}")
                    print(f"📊 Subgrupos Anteriores: {self.total_existentes} já registrados no motor CEP")
                    print(f"⚙️ Modo Limites Atual:   {self.modo_limites}")
                    print(f"📌 Operação Detectada:   {op_nome}")
                    print("=" * 80 + "\n")

                    self._aplicar_gerenciamento_modo_limites()

                    return self.carta_id
                elif res.status_code == 404:
                    print(f"⚠️ Carta com ID '{id_limpo}' NÃO foi encontrada na base de dados (404 Not Found).")
                else:
                    print(f"⚠️ Resposta inesperada ao consultar carta '{id_limpo}' (Status {res.status_code}): {res.text}")
                    print("🆕 Prosseguindo para criação de uma nova carta...")
        elif not id_candidato:
            print("ℹ️ Nenhum campo 'ID' de carta informado no JSON...")
        elif nova_carta:
            print("ℹ️ Flag --nova-carta informada. Forçando criação de nova carta isolada...")

        # Se for dados de acompanhamento e a carta não foi encontrada por ID ou não tinha ID,
        # busca automaticamente a carta de calibração existente compatível
        if not self._is_dados_calibracao() and not nova_carta:
            print("🔍 Buscando carta de calibração existente compatível para acompanhamento...")
            res_todas = self.client.get("/api/v1/cartas")
            if res_todas.status_code == 200:
                cartas_existentes = res_todas.json()
                cartas_compativeis = [
                    c for c in cartas_existentes
                    if c.get("tamanho_subgrupo") == self.tamanho_subgrupo
                ]
                if cartas_compativeis:
                    carta_compativel = sorted(
                        cartas_compativeis,
                        key=lambda x: (x.get("total_subgrupos", 0) > 0, str(x.get("criado_em") or "")),
                        reverse=True,
                    )[0]
                    self.carta_id = carta_compativel["id"]
                    self.total_existentes = carta_compativel.get("total_subgrupos", 0)
                    self.processo_id = carta_compativel.get("processo_id")
                    self.modo_limites = carta_compativel.get("modo_limites", "DINAMICO")

                    print("\n" + "=" * 80)
                    print("🎯 CARTA DE CALIBRAÇÃO LOCALIZADA AUTOMATICAMENTE PARA ACOMPANHAMENTO!")
                    print(f"🆔 ID da Carta:         {self.carta_id}")
                    print(f"📊 Subgrupos Anteriores: {self.total_existentes} já registrados no motor CEP")
                    print(f"⚙️ Modo Limites Atual:   {self.modo_limites}")
                    print("=" * 80 + "\n")

                    self._aplicar_gerenciamento_modo_limites()
                    return self.carta_id

        goal = self.metadados.get("goal") or "Calibrar"
        created_by = self.metadados.get("created_by") or "Operador"
        unit = self.metadados.get("unit") or "mm"
        measured_at = self.metadados.get("measured_at") or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        # Código identificador da linha fabril consistente
        codigo_final = (
            codigo_linha
            or self.metadados.get("codigo_linha")
            or f"LINHA-{created_by.upper()}"
        )

        if nova_carta:
            codigo_final = f"{codigo_final}-{int(time.time())}"

        # 1. Busca ou cria o processo industrial
        res_proc = self.client.get("/api/v1/processos")
        processos = res_proc.json() if res_proc.status_code == 200 else []
        proc_alvo = next((p for p in processos if p["codigo_linha"] == codigo_final), None)

        if not proc_alvo:
            res_novo_proc = self.client.post(
                "/api/v1/processos",
                json={
                    "nome": f"Processo [{goal}] ({codigo_final})",
                    "codigo_linha": codigo_final,
                    "descricao": (
                        f"Processo cadastrado via JSON - Operador: {created_by} | "
                        f"Unidade: {unit} | Meta: {goal} | Início: {measured_at}"
                    ),
                },
            )
            if res_novo_proc.status_code != 201:
                raise RuntimeError(f"Erro ao criar processo: {res_novo_proc.text}")
            proc_alvo = res_novo_proc.json()

        self.processo_id = proc_alvo["id"]

        # 2. Busca ou cria a carta de controle correspondente
        res_cartas = self.client.get(
            "/api/v1/cartas",
            params={"processo_id": self.processo_id},
        )
        cartas = res_cartas.json() if res_cartas.status_code == 200 else []
        carta_alvo = (
            None
            if nova_carta
            else next(
                (c for c in cartas if c.get("tamanho_subgrupo") == self.tamanho_subgrupo),
                None,
            )
        )

        if not carta_alvo:
            especificacoes = self._obter_especificacoes_finais()
            tipo_carta = self._obter_tipo_carta_apropriado()
            modo_inicial = self.modo_limites_manual or "DINAMICO"

            res_nova_carta = self.client.post(
                "/api/v1/cartas",
                json={
                    "processo_id": self.processo_id,
                    "tamanho_subgrupo": self.tamanho_subgrupo,
                    "tipo_carta": tipo_carta,
                    "especificacoes": especificacoes,
                    "modo_limites": modo_inicial,
                },
            )
            if res_nova_carta.status_code != 201:
                raise RuntimeError(f"Erro ao criar carta de controle: {res_nova_carta.text}")
            carta_alvo = res_nova_carta.json()

        self.carta_id = carta_alvo["id"]
        self.total_existentes = carta_alvo.get("total_subgrupos", 0)
        self.modo_limites = carta_alvo.get("modo_limites", "DINAMICO")

        if not nova_carta and self.total_existentes > 0:
            self._aplicar_gerenciamento_modo_limites()

        print("\n" + "=" * 80)
        print("🎉 NOVA CARTA DE CONTROLE CRIADA COM SUCESSO! (CALIBRAÇÃO)")
        print(f"🆔 ID DA CARTA: {self.carta_id}")
        print("💡 DICA: Para enviar dados de acompanhamento posteriores para esta mesma carta,")
        print(f'   adicione o campo "ID" no seu JSON:')
        print(f'   "ID": "{self.carta_id}"')
        print("=" * 80 + "\n")
        return self.carta_id

    def enviar_subgrupo(self, subgrupo_info: dict[str, Any], indice_sequencial: int) -> dict[str, Any]:
        """Envia subgrupo individual para a API REST e registra latência ponta a ponta."""
        valores = subgrupo_info["valores"]
        num_sub_custom = subgrupo_info.get("numero_subgrupo")
        if num_sub_custom is not None and num_sub_custom > self.total_existentes:
            num_sub = num_sub_custom
        else:
            num_sub = indice_sequencial

        ts = subgrupo_info.get("timestamp") or datetime.now(timezone.utc).isoformat()
        comentario = subgrupo_info.get("comentario")

        payload = {
            "valores": valores,
            "numero_subgrupo": num_sub,
            "timestamp": ts,
            "goal": self.metadados.get("goal"),
            "modo_limites": self.modo_limites,
        }

        t_inicio = time.perf_counter()
        response = self.client.post(
            f"/api/v1/cartas/{self.carta_id}/amostras",
            json=payload,
        )
        t_fim = time.perf_counter()

        latencia_ms = (t_fim - t_inicio) * 1000.0
        self.latencias_ms.append(latencia_ms)

        if response.status_code != 201:
            print(f"❌ Falha ao enviar subgrupo #{num_sub}: {response.text}")
            return {}

        self.total_enviados += 1

        resultado = response.json()
        fora_controle = resultado.get("fora_de_controle", False)
        violacoes = resultado.get("violacoes", [])

        if fora_controle:
            self.total_fora_controle += 1
            for v in violacoes:
                cod = v["codigo_regra"]
                self.violacoes_por_regra[cod] = self.violacoes_por_regra.get(cod, 0) + 1
        else:
            self.total_sob_controle += 1

        self._imprimir_linha_status(
            numero=num_sub,
            valores=valores,
            resultado=resultado,
            latencia_ms=latencia_ms,
            comentario=comentario,
        )
        return resultado

    def _imprimir_linha_status(
        self,
        numero: int,
        valores: list[float],
        resultado: dict[str, Any],
        latencia_ms: float,
        comentario: str | None = None,
    ) -> None:
        """Formata e imprime a saída no terminal com indicação visual de status e regras."""
        ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
        estat = resultado.get("estatisticas", {})
        media_x = estat.get("media_x", 0.0)
        amp_r = estat.get("amplitude_r", 0.0)
        desvio_s = estat.get("desvio_s", 0.0)
        fora_controle = resultado.get("fora_de_controle", False)
        violacoes = resultado.get("violacoes", [])

        if fora_controle:
            tag_status = "\033[91m🚨 FORA DE CONTROLE\033[0m"
            regras_str = ", ".join(f"[{v['codigo_regra']}]" for v in violacoes)
        else:
            tag_status = "\033[92m✅ SOB CONTROLE\033[0m"
            regras_str = "Nenhuma"

        disp_str = f"R: {amp_r:6.3f}" if self.tamanho_subgrupo <= 10 else f"s: {desvio_s:6.3f}"

        print(
            f"[{ts}] #{numero:03d} | X̄: {media_x:7.3f} | {disp_str} | "
            f"Status: {tag_status} | Regras: {regras_str:<18} | Latência: {latencia_ms:5.1f} ms"
        )
        if comentario:
            print(f"       └─ \033[96m💬 {comentario}\033[0m")

    def executar(self, limite_pontos: int = 0) -> None:
        """Executa a transmissão sequencial de subgrupos lidos do arquivo JSON."""
        total_disponivel = len(self.subgrupos)
        total_a_enviar = min(limite_pontos, total_disponivel) if limite_pontos > 0 else total_disponivel
        specs = self._obter_especificacoes_finais()
        unit = self.metadados.get("unit", "mm")

        is_calib = self._is_dados_calibracao()
        modo_op = "CALIBRAÇÃO (linha base)" if is_calib else "ACOMPANHAMENTO (continuação de histórico)"
        desc_limites = "Limites congelados" if self.modo_limites == "FIXO" else "Limites dinâmicos (recalculados)"

        print("=" * 80)
        print("📄 ENTRADA DE DADOS CEP VIA JSON - TRANSMISSÃO PARA BACKEND")
        print("=" * 80)
        print(f"• Servidor API:      {self.base_url}")
        print(f"• Carta de Controle: {self.carta_id}")
        print(f"• Modo de Operação:  {modo_op}")
        print(f"• Modo de Limites:   {self.modo_limites} ({desc_limites})")
        ws_url = self.base_url.replace("http://", "").replace("https://", "")
        print(f"• WebSocket Stream:  ws://{ws_url}/ws/cartas/{self.carta_id}")
        print(f"• Responsável:       {self.metadados.get('created_by', 'Henrique')}")
        print(f"• Objetivo (Goal):   {self.metadados.get('goal', 'Calibrar')}")
        print(f"• Unidade:           {unit}")

    # Em backend/scripts/json/simulador_json.py (por volta da linha 698):
        if specs and specs.get("lie") is not None and specs.get("lse") is not None:
            print(
                f"• Tolerâncias (Eng): LIE = {specs['lie']} {unit} | "
                f"LSE = {specs['lse']} {unit} (Alvo: {specs.get('valor_nominal', 'N/A')} {unit})"
            )
        else:
            print("• Tolerâncias (Eng): Não aplicável (Carta de Atributos sem LIE/LSE)")
        print(f"• Histórico Prévio:  {self.total_existentes} subgrupo(s) já existentes na carta")
        print(f"• Subgrupos no JSON: {total_disponivel} (Transmitindo: {total_a_enviar} subgrupos de n={self.tamanho_subgrupo})")
        print(f"• Intervalo Envio:   {self.intervalo:.1f} s")
        print("=" * 80)
        print("Pressione [Ctrl+C] a qualquer momento para interromper o envio.\n")

        indice_base = self.total_existentes
        try:
            for i, subgrupo_info in enumerate(self.subgrupos[:total_a_enviar], start=1):
                num_subgrupo = indice_base + i
                self.enviar_subgrupo(subgrupo_info, num_subgrupo)

                if i < total_a_enviar and self.intervalo > 0:
                    time.sleep(self.intervalo)

            print(f"\n🏁 Transmissão concluída com sucesso: {self.total_enviados} subgrupos processados.")

        except KeyboardInterrupt:
            print("\n🛑 Transmissão interrompida pelo operador.")
        finally:
            self.exibir_resumo()
            self.close()

    def enviar_em_lote(self) -> None:
        """Envia todas as amostras em uma única chamada usando o endpoint /importar."""
        specs = self._obter_especificacoes_finais()
        unit = self.metadados.get("unit", "mm")
        desc_limites = "Limites congelados" if self.modo_limites == "FIXO" else "Limites dinâmicos (recalculados)"

        print("=" * 80)
        print("📦 IMPORTAÇÃO EM LOTE MASSIVA VIA JSON")
        print("=" * 80)
        print(f"• Servidor API:      {self.base_url}")
        print(f"• Carta de Controle: {self.carta_id}")
        print(f"• Modo de Limites:   {self.modo_limites} ({desc_limites})")
        print(f"• Responsável:       {self.metadados.get('created_by', 'Henrique')}")
        print(f"• Tolerâncias (Eng): LIE = {specs['lie']} {unit} | LSE = {specs['lse']} {unit}")
        print(f"• Total Subgrupos:   {len(self.subgrupos)}")
        print("=" * 80)

        matriz = [sg["valores"] for sg in self.subgrupos]
        payload = {
            "amostras": matriz,
            "goal": self.metadados.get("goal"),
            "modo_limites": self.modo_limites,
        }

        t_inicio = time.perf_counter()
        response = self.client.post(
            f"/api/v1/cartas/{self.carta_id}/importar",
            json=payload,
        )
        t_fim = time.perf_counter()

        latencia_ms = (t_fim - t_inicio) * 1000.0

        if response.status_code != 201:
            print(f"❌ Falha na importação em lote: {response.text}")
            self.close()
            return

        resultado = response.json()
        subgrupos_resp = resultado.get("subgrupos", [])
        total_imp = resultado.get("total_importados", len(subgrupos_resp))

        print(f"✅ Importação finalizada em {latencia_ms:.1f} ms! Total importados: {total_imp}")
        for s in subgrupos_resp:
            self.total_enviados += 1
            if s.get("fora_de_controle"):
                self.total_fora_controle += 1
                for v in s.get("violacoes", []):
                    cod = v["codigo_regra"]
                    self.violacoes_por_regra[cod] = self.violacoes_por_regra.get(cod, 0) + 1
            else:
                self.total_sob_controle += 1

        self.latencias_ms.append(latencia_ms)
        self.exibir_resumo()
        self.close()

    def exibir_resumo(self) -> None:
        """Exibe relatório consolidado com estatísticas da transmissão."""
        if self.total_enviados == 0:
            return

        media_lat = sum(self.latencias_ms) / len(self.latencias_ms)
        min_lat = min(self.latencias_ms)
        max_lat = max(self.latencias_ms)

        print("\n" + "=" * 80)
        print("📊 RELATÓRIO CONSOLIDADO DA TRANSMISSÃO JSON")
        print("=" * 80)
        print(f"• Total de subgrupos transmitidos: {self.total_enviados}")
        print(f"• Subgrupos sob controle:          {self.total_sob_controle} ({self.total_sob_controle/self.total_enviados*100:.1f}%)")
        print(f"• Subgrupos fora de controle:       {self.total_fora_controle} ({self.total_fora_controle/self.total_enviados*100:.1f}%)")
        print("• Violações detectadas por regra de Nelson:")
        if self.violacoes_por_regra:
            for cod, qtd in sorted(self.violacoes_por_regra.items()):
                print(f"    - {cod}: {qtd} ocorrência(s)")
        else:
            print("    - Nenhuma violação registrada (processo estatisticamente estável)")

        print("• Desempenho e Latência de Rede (REST Ingestão):")
        print(f"    - Média: {media_lat:.1f} ms | Mínima: {min_lat:.1f} ms | Máxima: {max_lat:.1f} ms")
        print(f"• Requisito [RNF01] (< 500 ms):    {'✅ ATENDIDO' if max_lat < 500 else '⚠️ ATENÇÃO'}")
        print("=" * 80)


def main() -> None:
    """Ponto de entrada de linha de comando para o script de ingestão JSON."""
    parser = argparse.ArgumentParser(
        description="Ingestão de Dados CEP via Arquivo JSON (Estrutura Prova / Teste)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    script_dir = Path(__file__).resolve().parent

    # Prioriza o arquivo oficial da prova como default
    arquivo_prova = script_dir / "dados_simulado_prova_1_0226.json"
    default_json = arquivo_prova if arquivo_prova.is_file() else (script_dir / "dados_teste.json")

    parser.add_argument(
        "-f", "--arquivo",
        type=str,
        default=str(default_json),
        help="Caminho do arquivo JSON com os dados amostrais a serem calculados",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="URL base da API FastAPI",
    )
    parser.add_argument(
        "-i", "--intervalo",
        type=float,
        default=None,
        help="Intervalo entre o envio de subgrupos em segundos (padrão: 1.0 ou o valor no JSON)",
    )
    parser.add_argument(
        "-n", "--limite",
        type=int,
        default=0,
        help="Total máximo de subgrupos a transmitir (0 = todos do arquivo)",
    )
    parser.add_argument(
        "--carta-id",
        type=str,
        default=None,
        help="UUID de uma carta de controle já existente",
    )
    parser.add_argument(
        "--codigo-linha",
        default=None,
        help="Código da linha de produção (padrão: derivado do JSON ou 'LINHA-CALIBRAR')",
    )
    parser.add_argument(
        "--nova-carta",
        action="store_true",
        help="Força a criação de uma nova carta de controle exclusiva",
    )
    parser.add_argument(
        "--lote",
        action="store_true",
        help="Envia todas as amostras em uma única chamada em lote (/importar) sem streaming",
    )
    parser.add_argument(
        "--email",
        default="admin@cep.com",
        help="E-mail de autenticação no backend",
    )
    parser.add_argument(
        "--senha",
        default="Admin123!",
        help="Senha de autenticação no backend",
    )
    parser.add_argument(
        "--lse",
        type=float,
        default=None,
        help="Limite Superior de Especificação (LSE) manual (sobrescreve o JSON)",
    )
    parser.add_argument(
        "--lie",
        type=float,
        default=None,
        help="Limite Inferior de Especificação (LIE) manual (sobrescreve o JSON)",
    )
    parser.add_argument(
        "--nominal",
        type=float,
        default=None,
        help="Valor nominal de especificação manual",
    )
    parser.add_argument(
        "--alternar-modo-limites",
        action="store_true",
        default=True,
        help=(
            "Alterna o modo de limites via GerenciarCartaService.alternar_modo_limites: "
            "define limites FIXOS caso a carta existente receba dados de acompanhamento, "
            "ou DINÂMICOS caso receba novos dados de calibração (Padrão: True)"
        ),
    )
    parser.add_argument(
        "--fixar-limites",
        dest="alternar_modo_limites",
        action="store_true",
        help="Alias para --alternar-modo-limites",
    )
    parser.add_argument(
        "--alternar-modo",
        dest="alternar_modo_limites",
        action="store_true",
        help="Alias para --alternar-modo-limites",
    )
    parser.add_argument(
        "--manter-modo",
        dest="alternar_modo_limites",
        action="store_false",
        help="Desativa o chaveamento automático de modo de limites",
    )
    parser.add_argument(
        "--acompanhamento",
        action="store_true",
        help="Força a interpretação dos dados como lote de acompanhamento",
    )
    parser.add_argument(
        "--calibracao",
        action="store_true",
        help="Força a interpretação dos dados como lote de calibração",
    )
    parser.add_argument(
        "--modo-limites",
        type=str,
        choices=["DINAMICO", "FIXO"],
        default=None,
        help="Define explicitamente o modo de cálculo de limites da carta ('DINAMICO' ou 'FIXO')",
    )

    args = parser.parse_args()

    if args.carta_id:
        try:
            UUID(args.carta_id)
        except ValueError:
            print(f"⚠️ O valor informado para --carta-id ('{args.carta_id}') não é um UUID válido.")
            print("🆕 Uma nova carta será criada automaticamente.")
            args.carta_id = None

    caminho_json = Path(args.arquivo)
    print(f"📖 Lendo dados a partir de: {caminho_json.resolve()}")

    try:
        subgrupos, metadados = carregar_dados_json(caminho_json)
    except Exception as e:
        print(f"❌ Erro ao ler/parsear arquivo JSON: {e}")
        sys.exit(1)

    unit = metadados.get("unit", "mm")
    print(f"✅ {len(subgrupos)} subgrupos carregados com sucesso! (Meta: '{metadados.get('goal', 'N/A')}', Unidade: '{unit}')")

    # Define intervalo: prioridade CLI > JSON > default 1.0s
    intervalo_final = 1.0
    if args.intervalo is not None:
        intervalo_final = args.intervalo
    elif metadados.get("intervalo") is not None:
        try:
            intervalo_final = float(metadados["intervalo"])
        except (ValueError, TypeError):
            intervalo_final = 1.0

    # Sobrescrita manual de especificações
    specs_override: dict[str, float] | None = None
    if args.lse is not None and args.lie is not None:
        nominal = args.nominal if args.nominal is not None else (args.lse + args.lie) / 2
        specs_override = {"lse": args.lse, "lie": args.lie, "valor_nominal": nominal}

    codigo_linha_final = args.codigo_linha or metadados.get("codigo_linha")

    tipo_operacao = None
    if args.calibracao:
        tipo_operacao = "CALIBRACAO"
    elif args.acompanhamento:
        tipo_operacao = "ACOMPANHAMENTO"

    simulador = SimuladorJsonCEP(
        base_url=args.url,
        subgrupos=subgrupos,
        intervalo=intervalo_final,
        metadados=metadados,
        email=args.email,
        senha=args.senha,
        especificacoes_override=specs_override,
        alternar_modo_limites=args.alternar_modo_limites,
        tipo_operacao_override=tipo_operacao,
        modo_limites_manual=args.modo_limites,
    )

    if not simulador.verificar_servidor():
        print("\n💡 Verifique se o backend está em execução: uvicorn app.main:app --reload")
        sys.exit(1)

    print("🔐 Autenticando na API REST...")
    simulador.autenticar_ou_registrar()

    print("📋 Configurando carta de controle...")
    simulador.obter_ou_criar_carta(
        carta_id=args.carta_id,
        codigo_linha=codigo_linha_final,
        nova_carta=args.nova_carta,
    )

    if args.lote:
        simulador.enviar_em_lote()
    else:
        simulador.executar(limite_pontos=args.limite)


if __name__ == "__main__":
    main()
