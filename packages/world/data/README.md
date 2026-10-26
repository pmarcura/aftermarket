# Dados geográficos de referência

- `ibge-municipalities.json`: catálogo oficial de localidades, normalizado para ID, nome e UF.
- `campinas-boundary.geojson`: malha mínima de Campinas importada pela API do IBGE.
- `provenance.json`: URLs, horário da importação, contagem, hash e verificação dos IDs piloto.

Atualizar com `npm run data:sync`. A revisão do diff deve conferir novas localidades, metadados e validade da malha. Não tratar mudança de catálogo como migração automática da economia.

A demanda, a oferta, a infraestrutura e os valores econômicos em `src/regions.ts` são parâmetros de jogo. As coordenadas piloto são referências aproximadas. As propriedades virtuais não são lotes oficiais nem autorizações de atividade econômica.

Ainda não foram importados PBF de rodovias, geologia, zoneamento agrícola ou cobertura MapBiomas. O catálogo de fontes e o plano estão em `docs/research/ECOSYSTEM.md`.
