# Histórico de Features e Alterações do Backend (`feats/`)

Esta pasta armazena o registro descritivo e versionado de todas as implementações, módulos e alterações de arquitetura desenvolvidos no backend do **Sistema de Controle Estatístico de Processos (CEP)**.

---

## 1. Propósito e Diretrizes

O objetivo deste diretório é manter a rastreabilidade técnica do projeto, servindo como documentação viva de cada entrega descrita no [Roadmap.md](../Roadmap.md). Cada documento de alteração detalha:

1. **Contexto e Motivação:** A fase correspondente do roadmap e o problema de engenharia resolvido.
2. **Decisões Arquiteturais:** Padrões de projeto (GoF, Clean Architecture, SOLID) e trade-offs técnicos adotados.
3. **Arquivos Criados e Modificados:** Relação completa com a responsabilidade de cada artefato.
4. **Validação e Testes:** Comprovação de testes unitários, integração, linter e status de execução.
5. **Impacto e Próximos Passos:** Conexão com as fases subsequentes da aplicação.

---

## 2. Padrão de Nomenclatura dos Documentos

Os documentos de feature devem seguir o padrão sequencial:

```text
XX-descricao-da-feature.md
```

* Onde `XX` indica o identificador da fase ou ordem cronológica de entrega (`00`, `01`, `02`, etc.).

---

## 3. Índice de Features Implementadas

| Identificador | Título / Entrega | Fase no Roadmap | Status | Documento |
| :---: | :--- | :---: | :---: | :--- |
| **FEAT-00** | Setup de Ambiente, Infraestrutura Base & Docker | Fase 0 | ✅ Concluído | [00-setup-infraestrutura.md](./00-setup-infraestrutura.md) |
| **FEAT-01** | Domínio Puro & Motor de Cálculo Estatístico | Fase 1 | ✅ Concluído | [01-dominio-motor-cep.md](./01-dominio-motor-cep.md) |
| **FEAT-02** | Persistência Relacional & Repositórios (MySQL 8.0) | Fase 2 | ✅ Concluído | [02-persistencia-relacional-mysql.md](./02-persistencia-relacional-mysql.md) |
| **FEAT-03** | Camada de Aplicação & Orquestração de Subgrupos | Fase 3 | ✅ Concluído | [03-camada-aplicacao-servicos.md](./03-camada-aplicacao-servicos.md) |
| **FEAT-04** | WebSockets Nativos & Notificação Reativa | Fase 4 | ✅ Concluído | [04-tempo-real-websockets.md](./04-tempo-real-websockets.md) |
| **FEAT-05** | Camada de Apresentação & API REST (FastAPI) | Fase 5 | ✅ Concluído | [05-camada-apresentacao-api-rest.md](./05-camada-apresentacao-api-rest.md) |
| **FEAT-06** | Simulador IoT, Testes E2E & Containerização Final | Fase 6 | ✅ Concluído | [06-simulador-e2e-containerizacao.md](./06-simulador-e2e-containerizacao.md) |
| **FEAT-07** | Limites Dinâmicos, Avaliação Retroativa (Fase 1) & Regras Nelson | Fase 1 CEP | ✅ Concluído | [07-correcao-limites-dinamicos-avaliacao-retroativa-fase1.md](./07-correcao-limites-dinamicos-avaliacao-retroativa-fase1.md) |
| **FEAT-08** | Cartas de Controle por Atributos (Gráficos P e C) | Atributos CEP | ✅ Concluído | [cartas_atributos_p_c.md](./cartas_atributos_p_c.md) |

