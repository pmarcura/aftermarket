# AFTERMARKET

**Produto:** MMO econômico geográfico no Brasil, desktop web inicialmente.

**Visão:** o jogador constrói uma empresa dentro de uma economia existente. O ciclo central é localizar → investigar → comparar → adquirir → operar. Geografia, custos, concorrência e transporte determinam viabilidade.

**Princípios:** mundo compartilhado, bots com regras iguais, estoque físico, recursos finitos, transporte com capacidade e prazo, consequências financeiras e interface sem controles fictícios. Não é um city builder.

**Fonte original:** `docs/product/GDD-v3.0.md`. Referências primárias: dez telas numeradas e mapa principal em `docs/references`.

**Entrega inicial implementada:** laboratório local com dez telas, mapa real, persistência SQLite e fluxo de comércio/logística/produção. Uma instância compartilha o estado entre duas empresas de teste.

**Público-alvo da validação:** pessoas interessadas em jogos de gestão, cadeias produtivas, arbitragem espacial e decisões empresariais. O primeiro teste precisa mostrar que comparar fornecedores e transportar de fato muda a rentabilidade.

**Evolução 0.2 entregue:** temporada congelada, economia explicável, BRL, utilidades, animação temporal, filtro de titularidade e inteligência de mercado simples/avançada. A auditoria e a simulação de 30 dias identificam cadeias incompletas. Próxima etapa: fechar duas cadeias e recuperar insolvência no laboratório, em paralelo ao planejamento da identidade autenticada; autenticação e persistência relacional são pré-condições de uma season pública.
