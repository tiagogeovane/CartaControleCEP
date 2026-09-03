#!/usr/bin/env python3
"""Script de demonstração e visualização do Motor Estatístico de CEP (Controle Estatístico de Processos).

Instancia as entidades, estratégias (X-barra e R), detector das 8 Regras de Nelson
e calculador de capacidade (Cp/Cpk), gerando um gráfico de alta qualidade com Matplotlib.
"""

import argparse
import sys
from pathlib import Path
from uuid import uuid4

import matplotlib.pyplot as plt
import numpy as np

# Garante a resolução dos módulos do backend
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.rules.detector import DetectorRegrasNelson
from app.domain.services.capacidade import CalculadorCapacidade
from app.domain.strategies.factory import CartaStrategyFactory
from app.domain.value_objects.limites import LimitesEspecificacao


def gerar_dados_ficticios(
    k_subgrupos: int = 30,
    tamanho_subgrupo: int = 5,
    media_nominal: float = 50.00,
    desvio_base: float = 0.05,
) -> list[list[float]]:
    """Simula dados de um processo industrial de usinagem com desvios induzidos para demonstração do CEP.

    - Subgrupos 1 a 18: Processo sob controle estatístico (in-control).
    - Subgrupos 19 a 25: Tendência de aquecimento/desgaste (shift gradual de média).
    - Subgrupo 26: Choque/Causa especial (ponto fora dos limites de 3 sigma).
    - Subgrupos 27 a 30: Deslocamento sustentado no nível médio (disparando Nelson Regra 2).
    """
    np.random.seed(42)
    dados = []

    for i in range(1, k_subgrupos):
        if i <= 18:
            # Estado estável
            mu = media_nominal
            sigma = desvio_base
        elif 19 <= i <= 25:
            # Desgaste gradual / tendência de subida
            mu = media_nominal + (i - 18) * 0.012
            sigma = desvio_base
        elif i == 26:
            # Causa especial pontual (outlier além de 3 sigma)
            mu = media_nominal + 0.120
            sigma = desvio_base * 1.5
        else:
            # Média permanentemente deslocada acima da LC
            mu = media_nominal + 0.045
            sigma = desvio_base

        amostra = list(np.random.normal(loc=mu, scale=sigma, size=tamanho_subgrupo))
        dados.append([round(v, 4) for v in amostra])

    return dados


def main() -> None:
    parser = argparse.ArgumentParser(description="Demonstração do Motor Estatístico de CEP")
    parser.add_argument("--n", type=int, default=5, help="Tamanho do subgrupo amostral n (padrão: 5)")
    parser.add_argument("--k", type=int, default=25, help="Total de subgrupos a simular (padrão: 25)")
    parser.add_argument("--salvar", type=str, default=None, help="Caminho opcional para salvar a figura gerada")
    parser.add_argument("--no-show", action="store_true", help="Não abre janela do matplotlib (modo headless)")
    args = parser.parse_args()

    tamanho_n = args.n
    k_total = args.k

    print("=" * 70)
    print("🚀 INICIANDO DEMONSTRAÇÃO DO MOTOR ESTATÍSTICO DE CEP")
    print("=" * 70)

    # 1. Parâmetros do Processo Industrial
    especificacoes = LimitesEspecificacao(lie=49.80, lse=50.20, valor_nominal=50.00)
    dados_brutos = gerar_dados_ficticios(k_subgrupos=k_total, tamanho_subgrupo=tamanho_n)

    # 2. Instanciação Dinâmica dos Componentes de Domínio do Motor CEP (RN01)
    strategy = CartaStrategyFactory.fabricar(tamanho_subgrupo=tamanho_n)
    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta=strategy.tipo_carta,
        tamanho_subgrupo=tamanho_n,
        especificacoes=especificacoes,
    )
    detector_nelson = DetectorRegrasNelson()

    print(f"• Tipo de Carta Selecionado: {strategy.tipo_carta} ({strategy.nome_carta})")
    print(f"• Tamanho do subgrupo (n): {tamanho_n}")
    print(f"• Total de subgrupos simulados (k): {len(dados_brutos)}")
    print(f"• Tolerâncias de Engenharia: LIE={especificacoes.lie:.2f} mm | LSE={especificacoes.lse:.2f} mm\n")

    # 3. Processamento Individual e Sequencial dos Subgrupos
    print(f"📥 Processando subgrupos através do Strategy Pattern ({strategy.nome_carta})...")
    for idx, amostra in enumerate(dados_brutos, start=1):
        carta.validar_amostra(amostra)
        stats = strategy.calcular_estatisticas(amostra)
        subgrupo = Subgrupo(
            carta_id=carta.id,
            numero_subgrupo=idx,
            valores_brutos=amostra,
            estatisticas=stats,
        )
        carta.adicionar_subgrupo(subgrupo)

    # 4. Cálculo dos Limites de Controle Estatístico (Baseado na Amostra de Referência)
    historico_medias = carta.obter_historico_medias()
    historico_dispersoes = carta.obter_historico_dispersoes()

    limites_x = strategy.calcular_limites(historico_medias, historico_dispersoes, n=tamanho_n)
    lic_disp, lc_disp, lsc_disp = strategy.calcular_limites_dispersao(historico_dispersoes, n=tamanho_n)
    carta.atualizar_limites(limites_x)

    print("\n📊 LIMITES DE CONTROLE CALCULADOS PELO MOTOR:")
    print(f"  [{strategy.nome_posicao}] LIC = {limites_x.lic:.4f} | LC = {limites_x.lc:.4f} | LSC = {limites_x.lsc:.4f}")
    print(f"  [{strategy.nome_dispersao}] LIC = {lic_disp:.4f} | LC = {lc_disp:.4f} | LSC = {lsc_disp:.4f}")
    print(f"  [Variabilidade] Desvio Padrão Estimado (sigma_hat) = {limites_x.sigma_estimado:.4f}")

    # 5. Avaliação Contínua das 8 Regras de Nelson
    print("\n🔍 AVALIAÇÃO DAS REGRAS DE NELSON:")
    subgrupos_violadores: dict[int, list[str]] = {}

    for i in range(1, len(historico_medias) + 1):
        janela_medias = historico_medias[:i]
        violacoes = detector_nelson.avaliar(janela_medias, limites_x)
        if violacoes:
            sub = carta.subgrupos[i - 1]
            sub.adicionar_violacoes(violacoes)
            subgrupos_violadores[i] = [v.codigo_regra for v in violacoes]
            for v in violacoes:
                print(f"  ⚠️ Ponto #{i:02d}: {v.codigo_regra} -> {v.descricao}")

    if not subgrupos_violadores:
        print("  ✅ Nenhuma violação detectada. Processo em controle.")

    # 6. Cálculo dos Índices de Capacidade do Processo (Cp e Cpk)
    capacidade = CalculadorCapacidade.calcular(
        media_processo=limites_x.lc,
        sigma_estimado=limites_x.sigma_estimado,
        especificacoes=especificacoes,
    )
    print("\n🎯 CAPACIDADE DO PROCESSO:")
    print(f"  • Cp:  {capacidade.cp:.3f}")
    print(f"  • Cpk: {capacidade.cpk:.3f}")
    print(f"  • Status: {capacidade.classificacao}")
    print(f"  • Aprovado (Cpk >= 1.33): {'SIM' if capacidade.esta_aprovado(1.33) else 'NÃO'}")

    # 7. Construção do Gráfico com Matplotlib
    print("\n🎨 Gerando visualização gráfica com Matplotlib...")
    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

    fig, (ax1, ax2) = plt.subplots(
        nrows=2,
        ncols=1,
        figsize=(14, 9),
        sharex=True,
        gridspec_kw={"height_ratios": [2.2, 1.2]},
    )
    fig.patch.set_facecolor("#fdfdfd")

    x_eixo = list(range(1, len(historico_medias) + 1))
    medias = np.array(historico_medias)

    # --- SUBPLOT 1: Carta de Posição (Médias ou Leituras Individuais) ---
    sigma_media = limites_x.sigma_media
    lc = limites_x.lc
    lsc = limites_x.lsc
    lic = limites_x.lic

    # Faixas das Zonas de Nelson
    ax1.axhspan(lc - sigma_media, lc + sigma_media, color="#2ecc71", alpha=0.12, label="Zona C (±1σ)")
    ax1.axhspan(lc + sigma_media, lc + 2 * sigma_media, color="#f39c12", alpha=0.10, label="Zona B (+2σ)")
    ax1.axhspan(lc - 2 * sigma_media, lc - sigma_media, color="#f39c12", alpha=0.10)
    ax1.axhspan(lc + 2 * sigma_media, lsc, color="#e74c3c", alpha=0.08, label="Zona A (+3σ)")
    ax1.axhspan(lic, lc - 2 * sigma_media, color="#e74c3c", alpha=0.08)

    # Linhas de Controle
    ax1.axhline(lsc, color="#c0392b", linestyle="--", linewidth=1.8, label=f"LSC = {lsc:.3f}")
    ax1.axhline(lc, color="#27ae60", linestyle="-", linewidth=2.0, label=f"LC = {lc:.3f}")
    ax1.axhline(lic, color="#c0392b", linestyle="--", linewidth=1.8, label=f"LIC = {lic:.3f}")

    # Série de Posição
    ax1.plot(x_eixo, medias, color="#2980b9", marker="o", markersize=6, linewidth=1.8, label=strategy.rotulo_posicao)

    # Realce de Violações
    if subgrupos_violadores:
        x_viol = list(subgrupos_violadores.keys())
        y_viol = [medias[k - 1] for k in x_viol]
        ax1.scatter(
            x_viol,
            y_viol,
            color="#e74c3c",
            s=120,
            zorder=5,
            edgecolors="black",
            linewidth=1.2,
            marker="X",
            label="Violação de Nelson",
        )

        for sub_id, codigos in subgrupos_violadores.items():
            ax1.annotate(
                ", ".join(codigos),
                (sub_id, medias[sub_id - 1]),
                xytext=(0, 14),
                textcoords="offset points",
                ha="center",
                fontsize=8,
                fontweight="bold",
                color="#962d22",
                bbox={"boxstyle": "round,pad=0.2", "fc": "#fadbd8", "ec": "#e74c3c", "alpha": 0.9},
            )

    ax1.set_title(f"{strategy.nome_posicao} com Zonas de Nelson & Anomalias", fontsize=13, fontweight="bold")
    ax1.set_ylabel("Dimensão Medida (mm)", fontsize=11)
    ax1.legend(loc="upper left", bbox_to_anchor=(1.01, 1), borderaxespad=0, frameon=True, facecolor="white")
    ax1.grid(True, linestyle=":", alpha=0.6)

    # --- SUBPLOT 2: Carta de Dispersão (R, s ou MR) ---
    sigla = strategy.sigla_dispersao
    ax2.axhline(lsc_disp, color="#c0392b", linestyle="--", linewidth=1.6, label=f"LSC_{sigla} = {lsc_disp:.3f}")
    ax2.axhline(lc_disp, color="#27ae60", linestyle="-", linewidth=1.8, label=f"LC_{sigla} = {lc_disp:.3f}")
    ax2.axhline(lic_disp, color="#c0392b", linestyle="--", linewidth=1.6, label=f"LIC_{sigla} = {lic_disp:.3f}")

    # Para I-MR, a amplitude móvel inicia a partir da 2ª observação
    if tamanho_n == 1:
        x_disp = list(range(2, len(historico_medias) + 1))
    else:
        x_disp = x_eixo

    ax2.plot(x_disp, historico_dispersoes, color="#8e44ad", marker="s", markersize=5, linewidth=1.6, label=strategy.rotulo_dispersao)
    ax2.set_title(f"Carta de Controle de {strategy.nome_dispersao}", fontsize=12, fontweight="bold")
    label_x = "Número do Subgrupo Amostral (k)" if tamanho_n > 1 else "Número da Observação Individual (k)"
    ax2.set_xlabel(label_x, fontsize=11)
    ax2.set_ylabel(f"{strategy.rotulo_dispersao} (mm)", fontsize=11)
    ax2.set_xticks(x_eixo)
    ax2.set_xticklabels([str(k) for k in x_eixo], rotation=45 if len(x_eixo) > 20 else 0)
    ax2.legend(loc="upper left", bbox_to_anchor=(1.01, 1), borderaxespad=0, frameon=True, facecolor="white")
    ax2.grid(True, linestyle=":", alpha=0.6)

    # Texto com Resumo Informativo no Rodapé da Figura
    resumo_text = (
        f"Tipo: {strategy.tipo_carta} ({strategy.nome_carta})  |  "
        f"Diagnóstico: Cp = {capacidade.cp:.2f} | Cpk = {capacidade.cpk:.2f} ({capacidade.classificacao})  |  "
        f"Total de Pontos: {len(historico_medias)}  |  "
        f"Pontos Instáveis: {len(subgrupos_violadores)}"
    )
    plt.figtext(
        0.5,
        0.015,
        resumo_text,
        ha="center",
        fontsize=10,
        fontweight="bold",
        bbox={"boxstyle": "square,pad=0.5", "fc": "#eaeded", "ec": "#bdc3c7"},
    )

    plt.tight_layout(rect=[0, 0.04, 0.86, 1])

    # 8. Salvamento opcional e exibição interativa
    if args.salvar:
        plt.savefig(args.salvar, dpi=150)
        print(f"💾 Imagem do gráfico salva em: {args.salvar}")

    if not args.no_show:
        if fig.canvas.manager is not None:
            fig.canvas.manager.set_window_title(f"Sistema CEP - {strategy.nome_carta}")
        print("\n🖥️  Abrindo janela de visualização interativa do Matplotlib...")
        plt.show()

    print("=" * 70)
    print("✅ DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!")
    print("=" * 70)


if __name__ == "__main__":
    main()

