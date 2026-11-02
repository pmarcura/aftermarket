# Specs · estado

Como trabalhar: ler `CONSTITUTION.md`, depois a spec ativa. Cada pasta tem `spec.md` (o quê), `plan.md` (como) e `tasks.md` (checklist). Estados: **rascunho** → **aprovada** → **em execução** → **verificada** → **fechada**.

| Nº   | Spec                                                                                                                        | Estado                                                       | Semana | Depende de |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ | ---------- |
| 001  | [Economia única: fim do mundo v1](001-economia-unica-v2/spec.md)                                                            | verificada                                                   | 1      | —          |
| 001b | [Testes de navegador alinhados à interface atual](001b-e2e-interface-atual/spec.md)                                         | verificada (A1 na CI pendente do push)                       | 2      | 001        |
| 002  | [Dieta de ferramental: lab de interfaces fora do `check`, e2e em Chromium, versões travadas](002-dieta-ferramental/spec.md) | verificada (A3 pendente de execução no GitHub)               | 1      | —          |
| 003  | [Régua honesta da prova econômica e KPIs de balanceamento](003-regua-honesta/spec.md)                                       | verificada (escala 20 preliminar; régua completa no Actions) | 2      | 001        |
| 004  | Relógio por mundo (`timeScale` na temporada)                                                                                | rascunho                                                     | 3      | 001        |
| 005  | [Invariantes em runtime e desempenho do motor](005-invariantes-e-desempenho/spec.md)                                        | aprovada                                                     | 2      | 001        |
| 006  | Fechar exploits de preço e temporada versionada `balance/season-2026-01`                                                    | rascunho                                                     | 3–4    | 003, 004   |
| 007  | Servidor de jogo: login por convite, autorização por empresa, view pública/privada                                          | rascunho                                                     | 3–6    | 001        |

Ordem combinada em 30/10/2026 (D-042): 001 e 002 em paralelo, depois 003–005, depois 006 e 007 em paralelo. Em 01/11/2026 a 005 passou à frente da 004: a régua completa na escala 20 depende de o custo por dia parar de crescer com o tempo (decisão registrada na 003).
