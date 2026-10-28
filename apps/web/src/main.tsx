import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import './economy.css';
import './competition.css';
import './analysis.css';
import './design/identidade.css';
const Root =
  location.pathname.replace(/\/$/, '') === '/lab'
    ? lazy(() => import('./devlab/LabPage').then((m) => ({ default: m.LabPage })))
    : lazy(() => import('./App').then((m) => ({ default: m.App })));

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="connection-screen">Abrindo ambiente…</div>}>
      <Root />
    </Suspense>
  </React.StrictMode>,
);
