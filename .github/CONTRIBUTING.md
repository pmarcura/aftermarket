# Contribuindo com o AFTERMARKET

Valeu pelo interesse em contribuir! 🚛 O AFTERMARKET é um simulador empresarial geográfico ambientado no Brasil, e toda ajuda é bem-vinda — seja código, balanceamento, documentação ou ideias.

## Configurando o ambiente

### Pré-requisitos

- **Node.js** 18+ (recomendado: 20 LTS)
- **npm** 9+
- **Git**

### Setup

```bash
git clone https://github.com/TODO/aftermarket.git
cd aftermarket
npm install
npm run dev
```

O servidor de desenvolvimento sobe em `http://localhost:5173` (Vite) com a API Express rodando junto.

### Estrutura do projeto

| Diretório | Responsabilidade |
|---|---|
| `apps/web` | Interface React + Vite (páginas, componentes, integrações) |
| `apps/server` | API Express + SQLite (persistência, operações financeiras em transação) |
| `packages/simulation` | Regras puras de simulação (tempo injetável, sem dependência de UI) |
| `packages/world` | Dados geográficos e proveniência |
| `.planning/` | Estado do projeto, roadmap, requisitos por fase |

## Workflow de branches

1. Crie uma branch a partir de `main`:
   ```bash
   git checkout -b feat/minha-feature
   # ou: fix/descricao-do-bug, balance/ajuste-item, docs/o-que-mudou
   ```
2. Faça commits pequenos e coerentes (veja convenção abaixo).
3. Abra um Pull Request para `main`.
4. Aguarde review — ao menos uma aprovação é necessária.

## Convenção de commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```
tipo(escopo): descrição curta

corpo opcional com mais detalhes

Refs #123
```

### Tipos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `balance` | Ajuste de balanceamento econômico |
| `docs` | Documentação |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adição ou correção de testes |
| `chore` | Tarefas de manutenção, CI, dependências |
| `perf` | Melhoria de performance |

### Exemplos

```
feat(transport): adicionar cálculo de pedágio por eixo
fix(market): corrigir preço negativo ao vender lote vazio
balance(recipes): ajustar custo de milho na ração de frango
```

## Rodando testes

```bash
# Todos os testes
npm test

# Verificar formatação
npm run format

# Validar recursos econômicos (itens, receitas)
npm run resources:check
```

## Regras de balanceamento

Mexer na economia do jogo exige cuidado. Antes de alterar qualquer item ou receita:

1. **Leia** `docs/product/RESOURCE-STANDARD.md` — é a bíblia.
2. **Preencha** `RESOURCE-TEMPLATE.md` com todos os campos.
3. **Explique**: origem/semente, destino de cada coproduto, unidades, custo completo e efeito na season.
4. **Rode** `npm run resources:check` — estrutura válida ≠ economia balanceada.
5. **Teste** com o lab: `npm run lab:query -- --item=<id> --day=30`.

> **Regra de ouro**: dinheiro sempre em centavos inteiros. Lotes reservados antes de transporte ou produção. Informação real, parâmetro simulado e estimativa devem ser identificados.

## Princípios gerais

- **Interface nunca altera saldo, estoque ou titularidade diretamente** — sempre via comandos da simulação.
- **Humanos e bots usam os mesmos comandos e verificações** — sem atalhos.
- **Não crie arquivos** `old`, `legacy`, `v2` ou `backup` — use o Git.
- **Não introduza dependências** sem justificar o problema que resolvem.
- **Uma implementação ativa por funcionalidade** — sem branches divergentes.

## Código de conduta

Resumindo: seja respeitoso, construtivo e colaborativo.

- Critique ideias, não pessoas.
- Aceite feedback com maturidade — review existe pra melhorar o código, não pra atacar ninguém.
- Sem spam, auto-promoção ou conteúdo ofensivo.
- Dúvidas são bem-vindas — ninguém nasceu sabendo.

Comportamento tóxico, assédio ou discriminação resultam em ban permanente, sem aviso.

---

Bora construir o melhor simulador empresarial do Brasil? 🇧🇷
