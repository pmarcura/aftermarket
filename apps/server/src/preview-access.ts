import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

const COOKIE_NAME = '__Host-aftermarket-preview';
const SESSION_AGE_MS = 24 * 60 * 60 * 1000;
const mutations = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface PreviewConfig {
  publicOrigin: string;
  tokenDigest: Buffer;
  cookieValue: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Opt-in: an incomplete preview configuration must never start a public world. */
export function readPreviewConfig(
  env: Record<string, string | undefined> = process.env,
): PreviewConfig | null {
  const token = env.AFTERMARKET_PREVIEW_TOKEN;
  const publicOrigin = env.AFTERMARKET_PUBLIC_ORIGIN;
  if (token === undefined && publicOrigin === undefined) return null;
  if (!token || token.length < 32 || /\s/.test(token))
    throw new Error(
      'AFTERMARKET_PREVIEW_TOKEN precisa de uma chave sem espaços com pelo menos 32 caracteres.',
    );
  if (!publicOrigin)
    throw new Error('AFTERMARKET_PUBLIC_ORIGIN é obrigatória para o teste online.');
  let url: URL;
  try {
    url = new URL(publicOrigin);
  } catch {
    throw new Error('AFTERMARKET_PUBLIC_ORIGIN precisa ser uma origem HTTPS exata.');
  }
  if (url.protocol !== 'https:' || url.origin !== publicOrigin)
    throw new Error(
      'AFTERMARKET_PUBLIC_ORIGIN precisa ser uma origem HTTPS exata, sem caminho, credenciais ou parâmetros.',
    );
  return {
    publicOrigin,
    tokenDigest: digest(token),
    cookieValue: digest(`aftermarket-preview-session-v1:${token}`).toString('hex'),
  };
}

/** Access to a disposable preview; it does not replace player authentication. */
export function previewAccess(config: PreviewConfig | null): RequestHandler {
  if (!config) return (_req, _res, next) => next();
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (/^\/(?:lab|__lab)(?:\/|$)/.test(req.path)) return res.status(404).end();

    const origin = req.get('origin');
    if (
      (origin !== undefined && origin !== config.publicOrigin) ||
      (mutations.has(req.method) && origin !== config.publicOrigin)
    )
      return res.status(403).json({ error: 'Origem não autorizada para este teste.' });

    const cookie = (req.get('cookie') ?? '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1);
    const hasSession =
      cookie !== undefined && timingSafeEqual(digest(cookie), digest(config.cookieValue));
    if (req.path === '/preview' && req.method === 'GET') {
      const key = req.query.key;
      const validKey = typeof key === 'string' && timingSafeEqual(digest(key), config.tokenDigest);
      if (validKey) {
        res.cookie(COOKIE_NAME, config.cookieValue, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_AGE_MS,
        });
        return res.redirect(303, '/jogar');
      }
      if (hasSession) return res.redirect(303, '/jogar');
    }
    if (hasSession) return next();
    const error = 'Abra o link completo de convite para entrar neste teste online.';
    if (/^\/api(?:\/|$)/.test(req.path)) return res.status(401).json({ error });
    return res
      .status(401)
      .type('html')
      .send(
        `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AFTERMARKET · Acesso ao teste</title><main><h1>Acesso ao teste</h1><p>${error}</p></main></html>`,
      );
  };
}
