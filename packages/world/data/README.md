# Dados geográficos de referência

- `ibge-municipalities.json`: catálogo oficial de localidades, normalizado para ID, nome e UF.
- `campinas-boundary.geojson`: malha mínima de Campinas importada pela API do IBGE.
- `provenance.json`: URLs, horário da importação, contagem, hash e verificação dos IDs piloto.
- `lugares-reais.json`: lugares dos negócios em cada cidade, escolhidos por `npm run lugares:sync` (scripts/lugares-reais.ts) a partir dos tiles do OpenFreeMap (dados © colaboradores do OpenStreetMap). Comércio fica em zona comercial, indústria/armazém/transportadora em zona industrial, fazenda em lavoura e mina em área de mineração; quando a cidade não tem a zona marcada no mapa, entra uma zona substituta (bairro, área livre da cidade ou campo aberto), identificada pelo quinto número de cada lugar (1 = zona real, 0 = substituta). Cada lugar guarda o maior terreno que cabe sem cruzar rua e a direção da rua mais próxima.

Atualizar com `npm run data:sync`. A revisão do diff deve conferir novas localidades, metadados e validade da malha. Não tratar mudança de catálogo como migração automática da economia.

A demanda, a oferta, a infraestrutura e os valores econômicos em `src/regions.ts` são parâmetros de jogo. As coordenadas piloto são referências aproximadas. As propriedades virtuais não são lotes oficiais nem autorizações de atividade econômica.

Ainda não foram importados PBF de rodovias, geologia, zoneamento agrícola ou cobertura MapBiomas. O catálogo de fontes e o plano estão em `docs/research/ECOSYSTEM.md`.
