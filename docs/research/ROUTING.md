# Contrato de roteamento · 0.4.0

Consulta técnica em 27/10/2026. Geografia externa é permitida; nenhum endpoint fornece preços, salários ou demanda à economia durante a season.

## Escolha e limite

OSRM fornece malha roteável e geometria completa em GeoJSON. A API permite `overview=full`, `steps=true` e distância/duração; o perfil depende dos dados preparados no servidor. Referências: [documentação oficial](https://project-osrm.org/docs/v5.24.0/api/), [repositório](https://github.com/Project-OSRM/osrm-backend), [política do demonstrador](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy).

O padrão `https://router.project-osrm.org` serve ao laboratório, sem SLA. A política remete às condições do operador atual; não assumir serviço comercial ilimitado. Produção deve provisionar roteador próprio, capacidade medida e atribuição OSM/OSRM. Configuração: `AFTERMARKET_ROUTER_URL`. Não é uma integração com Google Maps.

`driving` é perfil automotivo. A implementação não verifica altura, peso, carga perigosa, restrições municipais ou tarifa real de pedágio. Isso exige dados/perfil de caminhão e verificação territorial em etapa própria. O custo de pedágio continua estimativa congelada da season, sem trânsito em tempo real.

## Fluxo autoritativo

1. A fila reúne necessidade de humanos, remessas antigas, pedidos/propostas, editais e abastecimento. Prioriza ação do jogador e deduplica origem/destino.
2. Uma requisição por vez, intervalo de 1,2 s, timeout de 12 s, fila máxima de 64 pares. Falha tem espera mínima de 60 s; ausência de rota nunca gera substituto em linha reta no servidor.
3. Valida código, coordenadas finitas/limites, distância/duração e tamanho. Persiste cache transacional relendo o mundo mais recente, sem sobrescrever pagamentos concorrentes.
4. Novos despachos só passam com rota rodoviária salva. A referência de geometria contratada é imutável e compartilhada entre caminhões do mesmo trajeto; atualização futura do cache não muda viagens existentes.
5. Marcador interpola a distância acumulada pelo tempo contratado. Mantém orientação e ponto sobre a linha. Veículos coincidentes são destacados por Localizar, sem deslocamento lateral fictício.

Remessas antigas estimadas podem receber `mapRouteKey`, somente para desenho. Quantidade, preço, custo e horários são preservados. O deslocamento vazio até a coleta ainda é estimado, e retorno vazio planejado não foi implementado. Antes da saída carregada, o marcador aguarda na origem. Não apresentar este fluxo como ciclo completo de um navegador de caminhões.

## Evidência

Rota real FerroVale → Indústria de Aço: 31,4277 km, 630 pontos, 18 trechos, ruas identificadas. Inspeção de uma entrega já existente, sem compra adicional: `.runtime/review/road-real.json` e `road-real-desktop.png`, sem erros JavaScript.

Testes de navegador usam roteador local determinístico na porta 3014; sua curva artificial testa interpolação e persistência, não comprova ruas brasileiras. Testes de domínio e simulações de balanceamento sem rede aceitam estimativa explicitamente. O servidor normal exige rotas reais. Manter essa distinção ao publicar resultados.
