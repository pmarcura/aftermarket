import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { regions } from '../packages/world/src/regions';

const directory = new URL('../packages/world/data/', import.meta.url);
await mkdir(directory, { recursive: true });
const url = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome';
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok)
  throw new Error(`IBGE retornou ${response.status}. Nenhum arquivo foi substituído.`);
const rows = (await response.json()) as {
  id: number;
  nome: string;
  microrregiao: { mesorregiao: { UF: { sigla: string } } } | null;
  'regiao-imediata'?: { 'regiao-intermediaria': { UF: { sigla: string } } };
}[];
if (!Array.isArray(rows) || rows.length < 5000)
  throw new Error('Catálogo incompleto. Nenhum arquivo foi substituído.');
const municipalities = rows.map((r) => ({
  id: String(r.id),
  name: r.nome,
  state:
    r.microrregiao?.mesorregiao.UF.sigla ??
    r['regiao-imediata']?.['regiao-intermediaria'].UF.sigla ??
    '',
}));
const content = JSON.stringify(municipalities, null, 2) + '\n';
await writeFile(new URL('ibge-municipalities.json', directory), content);
const boundaryUrl =
  'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/3509502?formato=application/vnd.geo+json&qualidade=minima';
let boundaries = 'não importadas';
try {
  const border = await fetch(boundaryUrl, { signal: AbortSignal.timeout(30000) });
  if (border.ok) {
    const geojson = (await border.json()) as { type: string };
    if (geojson.type === 'FeatureCollection' || geojson.type === 'Feature') {
      await writeFile(new URL('campinas-boundary.geojson', directory), JSON.stringify(geojson));
      boundaries = 'Campinas · GeoJSON';
    }
  }
} catch {
  /* O catálogo de municípios é útil mesmo sem a malha. */
}
await writeFile(
  new URL('provenance.json', directory),
  JSON.stringify(
    {
      source: 'IBGE · API de localidades',
      url,
      retrievedAt: new Date().toISOString(),
      count: municipalities.length,
      sha256: createHash('sha256').update(content).digest('hex'),
      coordinateSystem:
        'Coordenadas geográficas conforme os metadados do produto IBGE; não houve reprojeção nesta importação.',
      boundaries,
      boundaryUrl,
      pilotIdsVerified: regions.map((r) => ({
        id: r.id,
        name: r.name,
        present: municipalities.some((m) => m.id === r.id),
      })),
      use: 'Referência geográfica. Demanda, empresas, propriedades e preços não são dados do IBGE.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Catálogo IBGE: ${municipalities.length} municípios. Malhas: ${boundaries}. Proveniência e hash salvos.`,
);
