# Roteiro até o primeiro playtest

Definido em **27/10/2026** com o Pedro. Objetivo: jogar no PC com 4–5 amigos e muitos bots, num mundo que dá a sensação de estar vivo. Celular fica para depois.

Cada etapa termina em algo que dá para ver ou jogar e tem um critério de "pronto". Uma etapa por vez.

| Etapa                              | Resultado                                                                  | Pronto quando                                                                                                 | Quem decide                                | Estado      |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------- |
| **A · Arrumar a casa**             | Projeto legível para o Pedro e para o Claude                               | Abrir o projeto e entender onde estamos em 2 minutos                                                          | Pedro aprova                               | Concluída   |
| **B · Redesenhar a economia**      | Duas cadeias (metal e alimentos) que fecham                                | Nenhuma cadeia dá prejuízo por construção, nada acumula sem fim e os preços se estabilizam em 90 dias de bots | Pedro: design · Claude: contas e simulação | Próxima     |
| **C · Motor que aguenta**          | Mundo salvo em partes, navegador recebe só o que mudou, histórico resumido | 5 humanos + 60 bots rodam 30 dias de jogo sem travar num PC comum                                             | Claude                                     | Planejada   |
| **D · Jogar junto**                | Login simples, uma empresa por amigo, servidor acessível de casa           | 5 pessoas jogam ao mesmo tempo de lugares diferentes                                                          | Pedro: onde hospedar                       | Planejada   |
| **E · Primeira hora e mundo vivo** | Tutorial jogando, telas enxutas, mural de notícias e ranking               | Amigo novo faz a primeira venda em 15 min sem ajuda                                                           | Pedro: direção de interface                | Planejada   |
| Arte                               | Ícones dos produtos e identidade visual                                    | Lista de produtos fechada na etapa B                                                                          | Pedro gera com prompts do Claude           | Depois da E |
| **F · Playtest 1**                 | Sessão com amigos e lista de ajustes                                       | Sessão feita, 10 maiores dores anotadas                                                                       | Pedro chama os amigos                      | Planejada   |

## Etapa A · Arrumar a casa

- [x] Salvar o trabalho pendente no Git (`266dd32`, `382a4da`).
- [x] Estado e roteiro em linguagem simples.
- [x] Um ponto de entrada para os relatórios de economia (`ECONOMIA-HOJE.md` e `npm run economy:report`).
- [x] Limpar bancos de teste antigos em `.runtime`, sem tocar no mundo principal nem nos backups.
- [x] Instruções curtas para o Claude (`CLAUDE.md`).

## Etapa B · Redesenhar a economia

1. [x] **No papel, com o Pedro.** Proposta 1 aprovada (D-028, D-029): [`docs/economia-proposta.html`](../docs/economia-proposta.html).
2. [x] **Números da proposta.** Calculadora `npm run economy:design` e resumo em [ECONOMIA-ALVO](../docs/product/ECONOMIA-ALVO.md); todas as verificações passam.
3. [x] **Corrigir as fórmulas** que enganam os bots (auditoria M02–M05 e M07), com provas de regressão.
4. [ ] **Levar ao motor** os nove itens, as receitas, o rebanho e o caminhão como mercadoria, num mundo novo, nunca na season salva. Dez fatias em [B-PLAN](phases/B-economia/B-PLAN.md).
5. [ ] **Provar no `/lab`:** 90 dias, várias sementes, margem por cadeia, estoque parado, empresas quebradas e concentração por produto.

## O que já foi feito antes deste roteiro

O trabalho anterior foi organizado em fases numeradas. Os planos e as evidências continuam em `phases/`.

| Fase antiga                                | Situação                                                      | Onde entra agora      |
| ------------------------------------------ | ------------------------------------------------------------- | --------------------- |
| 01 · Fundação e fatia jogável              | Entregue                                                      | Base de tudo          |
| 02 · Economia explicável                   | Entregue                                                      | Base da etapa B       |
| 03 · Mundo autenticado (login, PostgreSQL) | Não iniciada                                                  | Etapas C e D          |
| 04 · Rotas rodoviárias                     | Quase toda entregue; falta perfil de caminhão e retorno vazio | Depois do playtest    |
| 05 · Equilíbrio de recursos                | Parcial: catálogo e auditorias prontos, equilíbrio não        | Etapa B               |
| 06 · Operação empresarial                  | Grande parte entregue; faltam aluguel e contratos recorrentes | Avaliar depois da B   |
| 07 · Laboratório de simulação              | Entregue                                                      | Ferramenta da etapa B |

## Fora do escopo

Fusões, construção de cidade, renderização 3D obrigatória, celular antes do playtest. Autenticação forte e PostgreSQL são necessários antes de um mundo público, não antes do playtest entre amigos.
