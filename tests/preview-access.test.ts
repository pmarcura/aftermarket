import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { previewAccess, readPreviewConfig } from '../apps/server/src/preview-access';

const token = 'preview-test-token-with-at-least-32-characters';
const publicOrigin = 'https://preview.example.com';
const config = () =>
  readPreviewConfig({
    AFTERMARKET_PREVIEW_TOKEN: token,
    AFTERMARKET_PUBLIC_ORIGIN: publicOrigin,
  });
const servers: Server[] = [];

async function start(preview = config()) {
  const app = express();
  app.use(previewAccess(preview));
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/commands', (_req, res) => res.json({ executed: true }));
  app.all('/{*path}', (_req, res) => res.send('jogo'));
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  servers.push(server);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    request: (path: string, options: RequestInit = {}) =>
      fetch(url + path, {
        ...options,
        redirect: 'manual',
      }),
    async enter() {
      const response = await fetch(`${url}/preview?key=${token}`, { redirect: 'manual' });
      return response.headers.get('set-cookie')!.split(';')[0];
    },
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
});

describe('configuração do teste online', () => {
  it('mantém a execução local sem gate quando nenhum parâmetro foi informado', () => {
    expect(readPreviewConfig({})).toBeNull();
  });

  it.each([
    { AFTERMARKET_PREVIEW_TOKEN: token },
    { AFTERMARKET_PUBLIC_ORIGIN: publicOrigin },
    { AFTERMARKET_PREVIEW_TOKEN: '' },
    { AFTERMARKET_PREVIEW_TOKEN: 'short', AFTERMARKET_PUBLIC_ORIGIN: publicOrigin },
    { AFTERMARKET_PREVIEW_TOKEN: `${token} `, AFTERMARKET_PUBLIC_ORIGIN: publicOrigin },
    ...[
      'http://preview.example.com',
      'https://preview.example.com/',
      'https://preview.example.com/path',
      'https://user:secret@preview.example.com',
      'https://preview.example.com?key=secret',
      'https://preview.example.com#fragment',
      'invalid',
    ].map((origin) => ({ AFTERMARKET_PREVIEW_TOKEN: token, AFTERMARKET_PUBLIC_ORIGIN: origin })),
  ])('recusa configuração parcial ou inválida %#', (env) => {
    expect(() => readPreviewConfig(env)).toThrow();
  });
});

describe('acesso HTTP ao teste online', () => {
  it('converte chave em cookie protegido e remove a chave da URL', async () => {
    const { request } = await start();
    const response = await request(`/preview?key=${token}`);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/jogar');
    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain('__Host-aftermarket-preview=');
    expect(cookie).not.toContain(token);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=86400');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    const page = await request('/jogar', { headers: { cookie: cookie.split(';')[0] } });
    expect(page.status).toBe(200);
  });

  it('recusa acesso anônimo, chaves inválidas e cookies forjados sem refletir a chave', async () => {
    const { request } = await start();
    for (const path of [
      '/jogar',
      '/assets/game.js',
      '/preview',
      '/preview?key=secret-invalid',
      '/preview?key=a&key=b',
    ]) {
      const response = await request(path);
      expect(response.status).toBe(401);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(await response.text()).not.toContain('secret-invalid');
    }
    const forged = await request('/api/health', {
      headers: { cookie: '__Host-aftermarket-preview=forged' },
    });
    expect(forged.status).toBe(401);
    expect(forged.headers.get('content-type')).toContain('application/json');
    expect(await forged.json()).toEqual({ error: expect.stringContaining('link completo') });
  });

  it('bloqueia o laboratório inclusive com sessão válida', async () => {
    const { request, enter } = await start();
    const cookie = await enter();
    for (const path of ['/lab', '/lab/anything', '/__lab', '/__lab/ui/index.json']) {
      const response = await request(`${path}?key=${token}`, { headers: { cookie } });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('');
    }
  });

  it('valida origem exata em leituras e exige origem em todas as mutações', async () => {
    const { request, enter } = await start();
    const cookie = await enter();
    for (const origin of ['https://evil.example.com', `${publicOrigin}.evil.test`, 'null']) {
      const response = await request('/api/health', { headers: { cookie, origin } });
      expect(response.status).toBe(403);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const missingOrigin = await request('/api/commands', { method, headers: { cookie } });
      expect(missingOrigin.status).toBe(403);
      const wrongOrigin = await request('/api/commands', {
        method,
        headers: { cookie, origin: 'https://evil.example.com' },
      });
      expect(wrongOrigin.status).toBe(403);
      const validOrigin = await request('/api/commands', {
        method,
        headers: { cookie, origin: publicOrigin },
      });
      expect(validOrigin.status).toBe(200);
    }
    const result = await request('/api/commands', {
      method: 'POST',
      headers: { cookie, origin: publicOrigin },
    });
    expect(await result.json()).toEqual({ executed: true });
    expect((await request('/api/health', { headers: { cookie } })).status).toBe(200);
  });

  it('verifica origem antes de conceder cookie e antes de processar JSON', async () => {
    const { request, enter } = await start();
    const crossed = await request(`/preview?key=${token}`, {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(crossed.status).toBe(403);
    expect(crossed.headers.get('set-cookie')).toBeNull();
    const response = await request('/api/commands', {
      method: 'POST',
      headers: { cookie: await enter(), 'content-type': 'application/json' },
      body: '{invalid',
    });
    expect(response.status).toBe(403);
  });

  it('não altera autenticação, rotas ou origens do modo local', async () => {
    const { request } = await start(null);
    expect((await request('/api/health')).status).toBe(200);
    expect((await request('/lab')).status).toBe(200);
    const result = await request('/api/commands', { method: 'POST' });
    expect(result.status).toBe(200);
    expect(result.headers.get('set-cookie')).toBeNull();
    expect(result.headers.get('x-robots-tag')).toBeNull();
  });
});
