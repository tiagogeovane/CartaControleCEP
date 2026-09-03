from collections.abc import Sequence

from app.domain.rules.base import IRegraNelson
from app.domain.value_objects.limites import LimitesControle
from app.domain.value_objects.violacao import ViolacaoRegra


class Regra1TresSigma(IRegraNelson):
    """Regra 1: 1 ponto fora dos limites de controle de 3 sigma (além de LSC ou LIC)."""

    @property
    def codigo(self) -> str:
        return "REGRA_1"

    @property
    def descricao(self) -> str:
        return "Um ponto fora dos limites estatísticos de 3 sigma (além de LSC ou LIC)."

    @property
    def pontos_minimos(self) -> int:
        return 1

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        ultimo_ponto = historico_medias[-1]
        idx_atual = len(historico_medias)

        if ultimo_ponto > limites.lsc or ultimo_ponto < limites.lic:
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=idx_atual,
                pontos_violadores=(idx_atual,),
            )
        return None


class Regra2NoveMesmoLado(IRegraNelson):
    """Regra 2: 9 pontos consecutivos no mesmo lado da Linha Central (indica mudança no nível médio)."""

    @property
    def codigo(self) -> str:
        return "REGRA_2"

    @property
    def descricao(self) -> str:
        return "Nove pontos consecutivos situados no mesmo lado da linha central."

    @property
    def pontos_minimos(self) -> int:
        return 9

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]
        lc = limites.lc

        todos_acima = all(p > lc for p in janela)
        todos_abaixo = all(p < lc for p in janela)

        if todos_acima or todos_abaixo:
            total = len(historico_medias)
            pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=total,
                pontos_violadores=pontos,
            )
        return None


class Regra3SeisTendencia(IRegraNelson):
    """Regra 3: 6 pontos consecutivos com tendência contínua (estritamente crescentes ou decrescentes)."""

    @property
    def codigo(self) -> str:
        return "REGRA_3"

    @property
    def descricao(self) -> str:
        return "Seis pontos consecutivos continuamente crescentes ou decrescentes (tendência)."

    @property
    def pontos_minimos(self) -> int:
        return 6

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]

        crescente = all(janela[i] < janela[i + 1] for i in range(len(janela) - 1))
        decrescente = all(janela[i] > janela[i + 1] for i in range(len(janela) - 1))

        if crescente or decrescente:
            total = len(historico_medias)
            pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=total,
                pontos_violadores=pontos,
            )
        return None


class Regra4QuatorzeAlternados(IRegraNelson):
    """Regra 4: 14 pontos consecutivos alternando sucessivamente para cima e para baixo."""

    @property
    def codigo(self) -> str:
        return "REGRA_4"

    @property
    def descricao(self) -> str:
        return "Quatorze pontos consecutivos alternando sucessivamente para cima e para baixo."

    @property
    def pontos_minimos(self) -> int:
        return 14

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]

        # Verifica alternância estrita entre subidas e descidas
        for i in range(len(janela) - 2):
            diff1 = janela[i + 1] - janela[i]
            diff2 = janela[i + 2] - janela[i + 1]
            if diff1 * diff2 >= 0:  # Não alternou (ambos subiram, desceram ou empataram)
                return None

        total = len(historico_medias)
        pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
        return ViolacaoRegra(
            codigo_regra=self.codigo,
            descricao=self.descricao,
            numero_subgrupo=total,
            pontos_violadores=pontos,
        )


class Regra5DoisDeTresZonaA(IRegraNelson):
    """Regra 5: 2 de 3 pontos consecutivos na Zona A ou além (> 2 sigma) do mesmo lado da linha central."""

    @property
    def codigo(self) -> str:
        return "REGRA_5"

    @property
    def descricao(self) -> str:
        return "Dois de três pontos consecutivos situados além de 2 sigma no mesmo lado da linha central."

    @property
    def pontos_minimos(self) -> int:
        return 3

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]
        lc = limites.lc
        sigma_m = limites.sigma_media

        dois_sigma_sup = lc + (2.0 * sigma_m)
        dois_sigma_inf = lc - (2.0 * sigma_m)

        count_sup = sum(1 for p in janela if p > dois_sigma_sup)
        count_inf = sum(1 for p in janela if p < dois_sigma_inf)

        if count_sup >= 2 or count_inf >= 2:
            total = len(historico_medias)
            pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=total,
                pontos_violadores=pontos,
            )
        return None


class Regra6QuatroDeCincoZonaB(IRegraNelson):
    """Regra 6: 4 de 5 pontos consecutivos na Zona B ou além (> 1 sigma) do mesmo lado da linha central."""

    @property
    def codigo(self) -> str:
        return "REGRA_6"

    @property
    def descricao(self) -> str:
        return "Quatro de cinco pontos consecutivos situados além de 1 sigma no mesmo lado da linha central."

    @property
    def pontos_minimos(self) -> int:
        return 5

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]
        lc = limites.lc
        sigma_m = limites.sigma_media

        um_sigma_sup = lc + (1.0 * sigma_m)
        um_sigma_inf = lc - (1.0 * sigma_m)

        count_sup = sum(1 for p in janela if p > um_sigma_sup)
        count_inf = sum(1 for p in janela if p < um_sigma_inf)

        if count_sup >= 4 or count_inf >= 4:
            total = len(historico_medias)
            pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=total,
                pontos_violadores=pontos,
            )
        return None


class Regra7QuinzeZonaC(IRegraNelson):
    """Regra 7: 15 pontos consecutivos dentro da Zona C (a menos de 1 sigma da linha central de qualquer lado)."""

    @property
    def codigo(self) -> str:
        return "REGRA_7"

    @property
    def descricao(self) -> str:
        return "Quinze pontos consecutivos na Zona C (a menos de 1 sigma do centro), indicando estratificação."

    @property
    def pontos_minimos(self) -> int:
        return 15

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]
        lc = limites.lc
        sigma_m = limites.sigma_media

        um_sigma_sup = lc + (1.0 * sigma_m)
        um_sigma_inf = lc - (1.0 * sigma_m)

        todos_na_zona_c = all(um_sigma_inf <= p <= um_sigma_sup for p in janela)

        if todos_na_zona_c:
            total = len(historico_medias)
            pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=total,
                pontos_violadores=pontos,
            )
        return None


class Regra8OitoForaZonaC(IRegraNelson):
    """Regra 8: 8 pontos consecutivos além de 1 sigma da linha central (fora da Zona C em qualquer direção)."""

    @property
    def codigo(self) -> str:
        return "REGRA_8"

    @property
    def descricao(self) -> str:
        return "Oito pontos consecutivos além de 1 sigma da média (sem nenhum ponto na Zona C), indicando mistura."

    @property
    def pontos_minimos(self) -> int:
        return 8

    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        if len(historico_medias) < self.pontos_minimos:
            return None

        janela = historico_medias[-self.pontos_minimos :]
        lc = limites.lc
        sigma_m = limites.sigma_media

        um_sigma_sup = lc + (1.0 * sigma_m)
        um_sigma_inf = lc - (1.0 * sigma_m)

        todos_fora_zona_c = all((p > um_sigma_sup or p < um_sigma_inf) for p in janela)

        if todos_fora_zona_c:
            total = len(historico_medias)
            pontos = tuple(range(total - self.pontos_minimos + 1, total + 1))
            return ViolacaoRegra(
                codigo_regra=self.codigo,
                descricao=self.descricao,
                numero_subgrupo=total,
                pontos_violadores=pontos,
            )
        return None
