from datetime import timezone
from uuid import UUID, uuid4

from app.domain.entities.carta import CartaControle
from app.domain.entities.processo import Processo
from app.domain.entities.subgrupo import Subgrupo
from app.domain.entities.usuario import Usuario
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.domain.value_objects.violacao import ViolacaoRegra
from app.infrastructure.persistence.models.amostra import AmostraItemModel
from app.infrastructure.persistence.models.carta import CartaControleModel
from app.infrastructure.persistence.models.processo import ProcessoModel
from app.infrastructure.persistence.models.subgrupo import SubgrupoModel
from app.infrastructure.persistence.models.usuario import UsuarioModel


def subgrupo_model_to_entity(model: SubgrupoModel) -> Subgrupo:
    """Converte SubgrupoModel (com amostras) em entidade Subgrupo do domínio."""
    valores_brutos = [
        item.valor_medido
        for item in sorted(model.amostras, key=lambda a: a.ordem_coleta)
    ]
    if not valores_brutos:
        valores_brutos = [model.media_x]

    estatisticas = EstatisticasSubgrupo(
        media_x=model.media_x,
        amplitude_r=model.amplitude_r,
        desvio_s=model.desvio_s,
        valores_brutos=tuple(valores_brutos),
    )

    violacoes = [
        ViolacaoRegra(
            codigo_regra=v["codigo_regra"],
            descricao=v["descricao"],
            numero_subgrupo=v["numero_subgrupo"],
            pontos_violadores=tuple(v.get("pontos_violadores", ())),
        )
        for v in (model.regras_violadas or [])
    ]

    timestamp = model.timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    return Subgrupo(
        id=UUID(model.id),
        carta_id=UUID(model.carta_id),
        numero_subgrupo=model.numero_subgrupo,
        timestamp=timestamp,
        valores_brutos=valores_brutos,
        estatisticas=estatisticas,
        fora_de_controle=model.fora_de_controle,
        violacoes=violacoes,
    )


def subgrupo_entity_to_model(
    entity: Subgrupo,
) -> tuple[SubgrupoModel, list[AmostraItemModel]]:
    """Converte entidade Subgrupo em SubgrupoModel e sua lista de AmostraItemModel."""
    subgrupo_model = SubgrupoModel(
        id=str(entity.id),
        carta_id=str(entity.carta_id),
        numero_subgrupo=entity.numero_subgrupo,
        timestamp=entity.timestamp,
        media_x=entity.estatisticas.media_x,
        amplitude_r=entity.estatisticas.amplitude_r,
        desvio_s=entity.estatisticas.desvio_s,
        fora_de_controle=entity.fora_de_controle,
        regras_violadas=[v.to_dict() for v in entity.violacoes],
    )
    amostras = [
        AmostraItemModel(
            id=str(uuid4()),
            subgrupo_id=str(entity.id),
            valor_medido=float(val),
            ordem_coleta=idx,
        )
        for idx, val in enumerate(entity.valores_brutos, start=1)
    ]
    return subgrupo_model, amostras


def carta_model_to_entity(model: CartaControleModel) -> CartaControle:
    """Converte CartaControleModel em entidade CartaControle do domínio."""
    especificacoes = None
    if (
        model.limite_superior_esp is not None
        or model.limite_inferior_esp is not None
        or model.valor_nominal is not None
    ):
        especificacoes = LimitesEspecificacao(
            lse=model.limite_superior_esp,
            lie=model.limite_inferior_esp,
            valor_nominal=model.valor_nominal,
        )

    limites_atuais = None
    if (
        model.lc_calculado is not None
        and model.lsc_calculado is not None
        and model.lic_calculado is not None
    ):
        sigma = model.sigma_estimado if model.sigma_estimado is not None else 0.0
        limites_atuais = LimitesControle(
            lc=model.lc_calculado,
            lsc=model.lsc_calculado,
            lic=model.lic_calculado,
            sigma_estimado=sigma,
        )

    subgrupos = []
    if model.subgrupos:
        subgrupos = [
            subgrupo_model_to_entity(s)
            for s in sorted(model.subgrupos, key=lambda x: x.numero_subgrupo)
        ]

    return CartaControle(
        id=UUID(model.id),
        processo_id=UUID(model.processo_id),
        tipo_carta=model.tipo_carta,
        tamanho_subgrupo=model.tamanho_subgrupo,
        especificacoes=especificacoes,
        limites_atuais=limites_atuais,
        modo_limites=model.modo_limites,
        subgrupos=subgrupos,
    )


def carta_entity_to_model(entity: CartaControle) -> CartaControleModel:
    """Converte entidade CartaControle em CartaControleModel do SQLAlchemy."""
    lse = entity.especificacoes.lse if entity.especificacoes else None
    lie = entity.especificacoes.lie if entity.especificacoes else None
    nominal = entity.especificacoes.valor_nominal if entity.especificacoes else None

    lc = entity.limites_atuais.lc if entity.limites_atuais else None
    lsc = entity.limites_atuais.lsc if entity.limites_atuais else None
    lic = entity.limites_atuais.lic if entity.limites_atuais else None
    sigma = entity.limites_atuais.sigma_estimado if entity.limites_atuais else None

    return CartaControleModel(
        id=str(entity.id),
        processo_id=str(entity.processo_id),
        tipo_carta=entity.tipo_carta,
        tamanho_subgrupo=entity.tamanho_subgrupo,
        limite_superior_esp=lse,
        limite_inferior_esp=lie,
        valor_nominal=nominal,
        lsc_calculado=lsc,
        lic_calculado=lic,
        lc_calculado=lc,
        sigma_estimado=sigma,
        modo_limites=entity.modo_limites,
    )


def processo_model_to_entity(model: ProcessoModel) -> Processo:
    """Converte ProcessoModel em entidade Processo do domínio."""
    return Processo(
        id=UUID(model.id),
        nome=model.nome,
        codigo_linha=model.codigo_linha,
        descricao=model.descricao,
    )


def processo_entity_to_model(entity: Processo) -> ProcessoModel:
    """Converte entidade Processo em ProcessoModel do SQLAlchemy."""
    return ProcessoModel(
        id=str(entity.id),
        nome=entity.nome,
        codigo_linha=entity.codigo_linha,
        descricao=entity.descricao,
    )


def usuario_model_to_entity(model: UsuarioModel) -> Usuario:
    """Converte UsuarioModel em entidade Usuario do domínio."""
    return Usuario(
        id=UUID(model.id),
        nome=model.nome,
        email=model.email,
        senha_hash=model.senha_hash,
        perfil=model.perfil,
    )


def usuario_entity_to_model(entity: Usuario) -> UsuarioModel:
    """Converte entidade Usuario em UsuarioModel do SQLAlchemy."""
    return UsuarioModel(
        id=str(entity.id),
        nome=entity.nome,
        email=entity.email,
        senha_hash=entity.senha_hash,
        perfil=entity.perfil,
    )
