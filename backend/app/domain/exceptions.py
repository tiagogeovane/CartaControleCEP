"""Exceções de Domínio e Aplicação para o Sistema de Controle Estatístico de Processos (CEP)."""


class DominioException(Exception):
    """Exceção base para todas as falhas de domínio e regras de negócio."""

    def __init__(self, mensagem: str) -> None:
        super().__init__(mensagem)
        self.mensagem = mensagem


class EntidadeNaoEncontradaError(DominioException):
    """Exceção lançada quando uma entidade requisitada não é localizada no repositório."""


class CartaNaoEncontradaError(EntidadeNaoEncontradaError):
    """Exceção específica quando uma Carta de Controle não é encontrada."""

    def __init__(self, carta_id: str | None = None, mensagem: str | None = None) -> None:
        msg = mensagem or f"Carta de controle '{carta_id}' não foi encontrada."
        super().__init__(msg)
        self.carta_id = carta_id


class ProcessoNaoEncontradoError(EntidadeNaoEncontradaError):
    """Exceção específica quando um Processo Industrial não é encontrado."""

    def __init__(self, processo_id: str | None = None, mensagem: str | None = None) -> None:
        msg = mensagem or f"Processo industrial '{processo_id}' não foi encontrado."
        super().__init__(msg)
        self.processo_id = processo_id


class UsuarioNaoEncontradoError(EntidadeNaoEncontradaError):
    """Exceção específica quando um Usuário não é encontrado."""

    def __init__(self, usuario_id: str | None = None, mensagem: str | None = None) -> None:
        msg = mensagem or f"Usuário '{usuario_id}' não foi encontrado."
        super().__init__(msg)
        self.usuario_id = usuario_id


class AmostraInvalidaError(DominioException, ValueError):
    """Exceção lançada quando as leituras amostrais violam o tamanho estipulado ou invariantes."""


class EspecificacoesNaoDefinidasError(DominioException, ValueError):
    """Exceção lançada quando uma operação (ex: capacidade) exige tolerâncias LSE/LIE não cadastradas."""


class DadosInsuficientesError(DominioException, ValueError):
    """Exceção lançada quando o histórico de subgrupos é insuficiente para executar o cálculo."""


class RegraNegocioVioladaError(DominioException):
    """Exceção para violações de regras operacionais ou de conformidade do CEP."""
