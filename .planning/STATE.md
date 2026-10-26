# Estado da continuidade

Atualizado em **26/10/2026**, America/Sao_Paulo.

## Onde estamos

Fase 01 entregue como laboratório local. Projeto canônico em `D:\Novidade`, branch `main`. Não havia código anterior na pasta. GDD e 13 imagens preservados. React/TypeScript/MapLibre, API Node/Express e SQLite em `.runtime/world.sqlite`.

## Funciona

Dez telas, mapa com camadas e seleção, compra exclusiva de propriedade, ofertas finitas, confirmação de compra com frete, veículo ocupado por massa/volume, entrega real ao inventário, produção com entradas e custos, vendas de varejo, extração finita, dois perfis locais, preços/ofertas editáveis, aquisição de veículos e exportação financeira.

O custo médio incorpora frete e custos industriais. Eventos são processados em ordem e retomados após reinício. Contas locais compartilham estado e o navegador não é a autoridade financeira.

## Validação

Ver `.planning/phases/01-foundation/01-VALIDATION.md`. Não considerar a fase seguinte pronta apenas porque as telas existem.

## Próxima ação concreta

Preparar o plano da fase 02 a partir de `REQUIREMENTS.md`: identidade autenticada, permissões de leitura/escrita e persistência relacional com migração do mundo existente. Fazer backup antes de alterar o banco. Manter os comandos econômicos como contrato de domínio.

## Limites conhecidos

- Perfis sem senha, acesso apenas ao loopback; nenhuma publicação pública foi feita.
- Snapshot JSON transacional em SQLite é adequado ao laboratório e não à escala MMO.
- Oportunidades e alguns índices regionais são parâmetros simulados iniciais.
- Bots ainda não têm planejamento comercial completo.
- OSRM usa perfil de automóvel, sem garantias para caminhões/pedágios. Alternativa estimada é identificada.
- Catálogo nacional importado; pesquisa econômica e atividade limitadas ao piloto.
- Não existem aluguel, contratos recorrentes, aceitação humana de frete ou automações de estoque.
- Reservas, propriedades, nomes de empresas e infraestrutura comercial são fictícios.
- Custos de manutenção da frota e depreciação serão detalhados nas fases seguintes.

## Regras para não perder trabalho

Um código ativo por função. Histórico no Git. Temporários, banco e backups em `.runtime`. Referências imutáveis em `docs/references`. Dados importados têm proveniência. Ao terminar cada fase, atualizar plano, validação e este estado.
