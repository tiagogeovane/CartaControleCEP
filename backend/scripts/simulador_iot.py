#!/usr/bin/env python3
"""Simulador de Linha de Produção IoT para Controle Estatístico de Processos (CEP).

Emite telemetria contínua de subgrupos amostrais para o endpoint de ingestão da API REST
(POST /api/v1/cartas/{id}/amostras). Em intervalos programados, injeta perturbações e anomalias
estatísticas controladas para validar o disparo em tempo real das 8 Regras de Nelson.
"""

import argparse
import random
import sys
import time
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import httpx


class SimuladorIoTCEP:
    """Orquestrador de simulação de telemetria industrial para o motor CEP."""

    def __init__(
        self,
        base_url: str,
        media: float = 25.0,
        desvio: float = 0.5,
        tamanho_subgrupo: int = 5,
        intervalo: float = 2.0,
        injetar_anomalias: bool = True,
        email: str = "admin@cep.com",
        senha: str = "Admin123!",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.media = media
        self.desvio = desvio
        self.tamanho_subgrupo = tamanho_subgrupo
        self.intervalo = intervalo
        self.injetar_anomalias = injetar_anomalias
        self.email = email
        self.senha = senha

        self.client = httpx.Client(base_url=self.base_url, timeout=10.0)
        self.token: str | None = None
        self.carta_id: str | None = None
        self.processo_id: str | None = None

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
        """Realiza login ou registra um operador padrão para interagir com a API."""
        # 1. Tenta login
        res_login = self.client.post(
            "/api/v1/auth/login",
            json={"email": self.email, "senha": self.senha},
        )
        if res_login.status_code == 200:
            token = res_login.json()["access_token"]
            self.token = token
            return token

        # 2. Se falhar, registra o usuário e faz login novamente
        res_reg = self.client.post(
            "/api/v1/auth/register",
            json={
                "nome": "Operador Simulador IoT",
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
        return token

    def obter_ou_criar_carta(
        self,
        carta_id: str | None = None,
        codigo_linha: str = "CNC-SIM-01",
    ) -> str:
        """Obtém carta existente ou cria novo processo e carta de teste com tolerâncias industriais."""
        headers = {"Authorization": f"Bearer {self.token}"}

        if carta_id:
            res = self.client.get(f"/api/v1/cartas/{carta_id}")
            if res.status_code == 200:
                self.carta_id = carta_id
                return carta_id
            print(f"⚠️ Carta {carta_id} não encontrada. Criando uma nova...")

        # Busca ou cria processo industrial
        res_proc = self.client.get("/api/v1/processos")
        processos = res_proc.json() if res_proc.status_code == 200 else []
        proc_alvo = next((p for p in processos if p["codigo_linha"] == codigo_linha), None)

        if not proc_alvo:
            res_novo_proc = self.client.post(
                "/api/v1/processos",
                headers=headers,
                json={
                    "nome": f"Linha de Usinagem CNC ({codigo_linha})",
                    "codigo_linha": codigo_linha,
                    "descricao": "Processo monitorado continuamente pelo Simulador IoT",
                },
            )
            if res_novo_proc.status_code != 201:
                raise RuntimeError(f"Erro ao criar processo: {res_novo_proc.text}")
            proc_alvo = res_novo_proc.json()

        self.processo_id = proc_alvo["id"]

        # Busca ou cria carta de controle para o processo
        res_cartas = self.client.get(
            "/api/v1/cartas",
            params={"processo_id": self.processo_id},
        )
        cartas = res_cartas.json() if res_cartas.status_code == 200 else []
        carta_alvo = next(
            (c for c in cartas if c.get("tamanho_subgrupo") == self.tamanho_subgrupo),
            None,
        )

        if not carta_alvo:
            # Tolerâncias de especificação (± 3.5 sigma de tolerância com valor nominal)
            tolerancia = 3.5 * self.desvio
            res_nova_carta = self.client.post(
                "/api/v1/cartas",
                headers=headers,
                json={
                    "processo_id": self.processo_id,
                    "tamanho_subgrupo": self.tamanho_subgrupo,
                    "tipo_carta": "X_R" if self.tamanho_subgrupo <= 10 else "X_S",
                    "especificacoes": {
                        "lse": round(self.media + tolerancia, 2),
                        "lie": round(self.media - tolerancia, 2),
                        "valor_nominal": round(self.media, 2),
                    },
                    "modo_limites": "DINAMICO",
                },
            )
            if res_nova_carta.status_code != 201:
                raise RuntimeError(f"Erro ao criar carta: {res_nova_carta.text}")
            carta_alvo = res_nova_carta.json()

        self.carta_id = carta_alvo["id"]
        return self.carta_id

    def gerar_amostras_subgrupo(self, numero_subgrupo: int) -> tuple[list[float], str]:
        """Gera o vetor de amostras do subgrupo, injetando anomalias caso programado."""
        descricao_cenario = "Operação Normal (In-Control)"

        if not self.injetar_anomalias:
            valores = [
                random.gauss(self.media, self.desvio)
                for _ in range(self.tamanho_subgrupo)
            ]
            return valores, descricao_cenario

        # Ciclo de injeção de perturbações estatísticas a cada 40 subgrupos
        fase = (numero_subgrupo - 1) % 40 + 1

        if fase == 12:
            # Regra 1: Outlier pontual além de 3.5 sigma
            descricao_cenario = "🚨 Perturbação: Regra 1 (Outlier além de 3σ)"
            mu_anomalo = self.media + 4.2 * self.desvio
            valores = [
                random.gauss(mu_anomalo, self.desvio * 0.5)
                for _ in range(self.tamanho_subgrupo)
            ]
        elif 18 <= fase <= 26:
            # Regra 2: 9 pontos consecutivos no mesmo lado da linha central
            passo = fase - 17
            descricao_cenario = f"⚠️ Perturbação: Regra 2 (Shift de Média - ponto {passo}/9)"
            mu_deslocado = self.media + 1.8 * self.desvio
            valores = [
                random.gauss(mu_deslocado, self.desvio * 0.6)
                for _ in range(self.tamanho_subgrupo)
            ]
        elif 30 <= fase <= 35:
            # Regra 3: 6 pontos em tendência ascendente contínua
            passo = fase - 29
            descricao_cenario = f"⚠️ Perturbação: Regra 3 (Tendência Crescente - ponto {passo}/6)"
            mu_tendencia = self.media + (passo * 0.45 * self.desvio)
            valores = [
                random.gauss(mu_tendencia, self.desvio * 0.3)
                for _ in range(self.tamanho_subgrupo)
            ]
        else:
            # Processo padrão estável sob distribuição gaussiana
            valores = [
                random.gauss(self.media, self.desvio)
                for _ in range(self.tamanho_subgrupo)
            ]

        # Arredonda para 3 casas decimais
        return [round(v, 3) for v in valores], descricao_cenario

    def enviar_subgrupo(self, numero_subgrupo: int) -> dict[str, Any]:
        """Envia subgrupo para a API REST e calcula latência de processamento ponta a ponta."""
        valores, cenario = self.gerar_amostras_subgrupo(numero_subgrupo)
        payload = {
            "valores": valores,
            "numero_subgrupo": numero_subgrupo,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        t_inicio = time.perf_counter()
        response = self.client.post(
            f"/api/v1/cartas/{self.carta_id}/amostras",
            json=payload,
        )
        t_fim = time.perf_counter()

        latencia_ms = (t_fim - t_inicio) * 1000.0
        self.latencias_ms.append(latencia_ms)
        self.total_enviados += 1

        if response.status_code != 201:
            print(f"❌ Falha ao enviar subgrupo #{numero_subgrupo}: {response.text}")
            return {}

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
            numero=numero_subgrupo,
            valores=valores,
            resultado=resultado,
            latencia_ms=latencia_ms,
            cenario=cenario,
        )
        return resultado

    def _imprimir_linha_status(
        self,
        numero: int,
        valores: list[float],
        resultado: dict[str, Any],
        latencia_ms: float,
        cenario: str,
    ) -> None:
        """Formata e imprime a saída no terminal com indicação visual de status."""
        ts = datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")
        estat = resultado.get("estatisticas", {})
        media_x = estat.get("media_x", 0.0)
        amp_r = estat.get("amplitude_r", 0.0)
        fora_controle = resultado.get("fora_de_controle", False)
        violacoes = resultado.get("violacoes", [])

        if fora_controle:
            tag_status = "\033[91m🚨 FORA DE CONTROLE\033[0m"
            regras_str = ", ".join(f"[{v['codigo_regra']}]" for v in violacoes)
        else:
            tag_status = "\033[92m✅ SOB CONTROLE\033[0m"
            regras_str = "Nenhuma"

        print(
            f"[{ts}] #{numero:03d} | X̄: {media_x:6.2f} | R: {amp_r:5.2f} | "
            f"Status: {tag_status} | Regras: {regras_str:<18} | Latência: {latencia_ms:5.1f} ms"
        )
        if "Perturbação" in cenario:
            print(f"       └─ \033[93m{cenario}\033[0m")

    def executar(self, limite_pontos: int = 0) -> None:
        """Loop principal de emissão contínua com captura de interrupção graciosa."""
        print("=" * 80)
        print("🚀 SIMULADOR DE LINHA DE PRODUÇÃO IoT - CONTROLE ESTATÍSTICO DE PROCESSOS")
        print("=" * 80)
        print(f"• Servidor API:      {self.base_url}")
        print(f"• Carta de Controle: {self.carta_id}")
        print(f"• WebSocket Stream:  ws://{self.base_url.replace('http://', '')}/ws/cartas/{self.carta_id}")
        print(f"• Média Nominal (μ): {self.media} | Desvio Padrão (σ): {self.desvio}")
        print(f"• Tamanho Subgrupo:  n = {self.tamanho_subgrupo} amostras")
        print(f"• Intervalo de Envio:{self.intervalo:.1f} s")
        print(f"• Injeção Anomalias: {'Ativada (Regras 1, 2, 3 de Nelson)' if self.injetar_anomalias else 'Desativada'}")
        print("=" * 80)
        print("Pressione [Ctrl+C] a qualquer momento para interromper a simulação.\n")

        subgrupo_num = 1
        try:
            while True:
                self.enviar_subgrupo(subgrupo_num)

                if limite_pontos > 0 and subgrupo_num >= limite_pontos:
                    print(f"\n🏁 Limite de {limite_pontos} subgrupos atingido.")
                    break

                subgrupo_num += 1
                time.sleep(self.intervalo)

        except KeyboardInterrupt:
            print("\n🛑 Simulação interrompida pelo operador.")
        finally:
            self.exibir_resumo()
            self.close()

    def exibir_resumo(self) -> None:
        """Exibe o relatório consolidado da rodada de telemetria."""
        if self.total_enviados == 0:
            return

        media_lat = sum(self.latencias_ms) / len(self.latencias_ms)
        min_lat = min(self.latencias_ms)
        max_lat = max(self.latencias_ms)

        print("\n" + "=" * 80)
        print("📊 RELATÓRIO CONSOLIDADO DA SIMULAÇÃO")
        print("=" * 80)
        print(f"• Total de subgrupos transmitidos: {self.total_enviados}")
        print(f"• Subgrupos sob controle:          {self.total_sob_controle} ({self.total_sob_controle/self.total_enviados*100:.1f}%)")
        print(f"• Subgrupos fora de controle:       {self.total_fora_controle} ({self.total_fora_controle/self.total_enviados*100:.1f}%)")
        print("• Violações detectadas por regra:")
        if self.violacoes_por_regra:
            for cod, qtd in sorted(self.violacoes_por_regra.items()):
                print(f"    - {cod}: {qtd} ocorrência(s)")
        else:
            print("    - Nenhuma violação registrada")

        print("• Desempenho e Latência de Rede (REST Ingestão):")
        print(f"    - Média: {media_lat:.1f} ms | Mínima: {min_lat:.1f} ms | Máxima: {max_lat:.1f} ms")
        print(f"• Requisito [RNF01] (< 500 ms):    {'✅ ATENDIDO' if max_lat < 500 else '⚠️ ATENÇÃO'}")
        print("=" * 80)


def main() -> None:
    """Ponto de entrada de linha de comando para execução do simulador."""
    parser = argparse.ArgumentParser(
        description="Simulador IoT de Telemetria Industrial para CEP",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--url", default="http://localhost:8000", help="URL base da API FastAPI")
    parser.add_argument("-i", "--intervalo", type=float, default=2.0, help="Intervalo entre subgrupos (segundos)")
    parser.add_argument("-n", "--limite", type=int, default=0, help="Total de subgrupos a emitir (0 = infinito)")
    parser.add_argument("-k", "--tamanho", type=int, default=5, help="Tamanho do subgrupo amostral (n)")
    parser.add_argument("-m", "--media", type=float, default=25.0, help="Média nominal do processo (μ)")
    parser.add_argument("-s", "--desvio", type=float, default=0.5, help="Desvio padrão do processo (σ)")
    parser.add_argument("--sem-anomalias", action="store_true", help="Desativa a injeção periódica de anomalias")
    parser.add_argument("--carta-id", type=str, default=None, help="UUID de uma carta de controle existente")
    parser.add_argument("--email", default="admin@cep.com", help="E-mail de autenticação")
    parser.add_argument("--senha", default="Admin123!", help="Senha de autenticação")
    parser.add_argument("--codigo-linha", default="CNC-SIM-01", help="Código identificador da linha de produção")

    args = parser.parse_args()

    if args.carta_id:
        try:
            UUID(args.carta_id)
        except ValueError:
            print(f"❌ Formato inválido para --carta-id: '{args.carta_id}' não é um UUID válido.")
            sys.exit(1)

    simulador = SimuladorIoTCEP(
        base_url=args.url,
        media=args.media,
        desvio=args.desvio,
        tamanho_subgrupo=args.tamanho,
        intervalo=args.intervalo,
        injetar_anomalias=not args.sem_anomalias,
        email=args.email,
        senha=args.senha,
    )

    if not simulador.verificar_servidor():
        print("\n💡 Verifique se o backend está em execução: uvicorn app.main:app --reload")
        sys.exit(1)

    print("🔐 Autenticando na API REST...")
    simulador.autenticar_ou_registrar()

    print("📋 Configurando carta de controle...")
    simulador.obter_ou_criar_carta(
        carta_id=args.carta_id,
        codigo_linha=args.codigo_linha,
    )

    simulador.executar(limite_pontos=args.limite)


if __name__ == "__main__":
    main()
