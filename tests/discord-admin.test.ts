import { describe, expect, it, vi } from 'vitest';
import {
  createDiscordApi,
  DISCORD_GUILD_ID,
  everyonePermissions,
  formatDiscordOutput,
  runDiscordAdmin,
} from '../scripts/discord-admin';

const CHANNEL_ID = '1567691094043525171';
const TOKEN = 'test-bot-secret-not-for-output';
const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });
const channel = {
  id: CHANNEL_ID,
  guild_id: DISCORD_GUILD_ID,
  name: 'comece-aqui',
  type: 0,
  topic: 'Regras',
  position: 0,
};

function fixture(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    '/users/@me': { id: '1567777777777777777', username: 'AFTERMARKET', bot: true },
    [`/guilds/${DISCORD_GUILD_ID}`]: { id: DISCORD_GUILD_ID, name: 'AFTERMARKET' },
    [`/channels/${CHANNEL_ID}`]: channel,
    [`/channels/${CHANNEL_ID}/invites`]: [],
    ...overrides,
  };
  const requestFetch = vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname.replace('/api/v10', '');
    if (!(path in responses)) throw new Error('Unexpected request');
    return json(responses[path]);
  });
  return { token: TOKEN, fetch: requestFetch, pause: vi.fn(async () => {}) };
}

describe('Discord administration boundaries', () => {
  it('shows help without a token or network access', async () => {
    const requestFetch = vi.fn<typeof fetch>();
    expect(await runDiscordAdmin(['--help'], { fetch: requestFetch })).toContain('--apply');
    expect(requestFetch).not.toHaveBeenCalled();
  });

  it('rejects a personal account before consulting or changing a server', async () => {
    const dependencies = fixture({ '/users/@me': { bot: false } });
    await expect(runDiscordAdmin(['invite', CHANNEL_ID, '--apply'], dependencies)).rejects.toThrow(
      'não pertence a um bot',
    );
    expect(dependencies.fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['channel', 'invite'])(
    'rejects a channel from another guild before %s writes',
    async (command) => {
      const dependencies = fixture({
        [`/channels/${CHANNEL_ID}`]: { ...channel, guild_id: '1567888888888888888' },
      });
      const args =
        command === 'channel'
          ? ['channel', CHANNEL_ID, '--name=entrada', '--apply']
          : ['invite', CHANNEL_ID, '--apply'];
      await expect(runDiscordAdmin(args, dependencies)).rejects.toThrow(
        'fora do servidor AFTERMARKET',
      );
      expect(dependencies.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
    },
  );

  it('previews a channel change without sending a write', async () => {
    const dependencies = fixture();
    const result = await runDiscordAdmin(
      ['channel', CHANNEL_ID, '--name=entrada', '--topic=Como começar', '--position=2'],
      dependencies,
    );
    expect(result).toMatchObject({
      applied: false,
      changes: { name: 'entrada', topic: 'Como começar', position: 2 },
    });
    expect(dependencies.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('writes only explicitly selected channel fields, preserving its permission overwrites', async () => {
    const dependencies = fixture();
    await runDiscordAdmin(['channel', CHANNEL_ID, '--topic=Como começar', '--apply'], dependencies);
    const writes = dependencies.fetch.mock.calls.filter(([, init]) => init?.method !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0][1]?.method).toBe('PATCH');
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ topic: 'Como começar' });
  });

  it('reuses an existing unlimited permanent invite instead of creating another', async () => {
    const dependencies = fixture({
      [`/channels/${CHANNEL_ID}/invites`]: [
        {
          code: 'Aftermarket123',
          channel: { id: CHANNEL_ID },
          guild: { id: DISCORD_GUILD_ID },
          max_age: 0,
          max_uses: 0,
          temporary: false,
          expires_at: null,
        },
      ],
    });
    expect(await runDiscordAdmin(['invite', CHANNEL_ID, '--apply'], dependencies)).toMatchObject({
      applied: false,
      reused: true,
      url: 'https://discord.gg/Aftermarket123',
    });
    expect(dependencies.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('previews a new invite without creating it', async () => {
    const dependencies = fixture();
    expect(await runDiscordAdmin(['invite', CHANNEL_ID], dependencies)).toMatchObject({
      applied: false,
      action: 'invite',
      maxAge: 0,
      maxUses: 0,
      temporary: false,
    });
    expect(dependencies.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('creates an unlimited invite only after --apply and leaves unique disabled', async () => {
    const dependencies = fixture();
    const baseFetch = dependencies.fetch.getMockImplementation()!;
    dependencies.fetch.mockImplementation(async (input, init) =>
      init?.method === 'POST'
        ? json({
            code: 'Aftermarket123',
            channel: { id: CHANNEL_ID },
            guild: { id: DISCORD_GUILD_ID },
            max_age: 0,
            max_uses: 0,
            temporary: false,
            expires_at: null,
          })
        : baseFetch(input, init),
    );
    expect(await runDiscordAdmin(['invite', CHANNEL_ID, '--apply'], dependencies)).toMatchObject({
      applied: true,
      reused: false,
      permanent: true,
    });
    const writes = dependencies.fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({
      max_age: 0,
      max_uses: 0,
      temporary: false,
      unique: false,
    });
  });

  it('previews the actual game icon without uploading or printing its base64 payload', async () => {
    const dependencies = fixture();
    const result = await runDiscordAdmin(['icon', 'apps/web/public/favicon.png'], dependencies);
    expect(result).toMatchObject({
      applied: false,
      action: 'icon',
      mime: 'image/png',
      file: 'favicon.png',
    });
    expect(JSON.stringify(result)).not.toContain('base64');
    expect(dependencies.fetch.mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });

  it('does not read message content while reporting server permissions', async () => {
    const dependencies = fixture({
      [`/guilds/${DISCORD_GUILD_ID}/channels`]: [
        {
          ...channel,
          permission_overwrites: [
            { id: DISCORD_GUILD_ID, type: 0, allow: '0', deny: String(1n << 11n) },
          ],
        },
      ],
      [`/guilds/${DISCORD_GUILD_ID}/roles`]: [
        { id: DISCORD_GUILD_ID, name: '@everyone', permissions: String((1n << 10n) | (1n << 11n)) },
      ],
    });
    const result = await runDiscordAdmin(['status'], dependencies);
    expect(result).toMatchObject({ channels: [{ everyone: { view: true, send: false } }] });
    expect(dependencies.fetch.mock.calls.some(([url]) => String(url).includes('/messages'))).toBe(
      false,
    );
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});

describe('Discord permission calculation', () => {
  it('applies @everyone allow and deny without losing high permission bits', () => {
    const base = (1n << 10n) | (1n << 11n) | (1n << 50n);
    const result = everyonePermissions(String(base), [
      {
        id: DISCORD_GUILD_ID,
        type: 0,
        allow: String(1n << 51n),
        deny: String((1n << 11n) | (1n << 50n)),
      },
    ]);
    expect(result).toMatchObject({ view: true, send: false, pin: true, externalApps: false });
    expect(BigInt(result.bits) & (1n << 51n)).toBe(1n << 51n);
  });

  it('masks visible activities when view is denied and ignores other roles or members', () => {
    const base = (1n << 10n) | (1n << 11n) | (1n << 20n) | (1n << 21n);
    const result = everyonePermissions(String(base), [
      { id: DISCORD_GUILD_ID, type: 0, allow: '0', deny: String(1n << 10n) },
      { id: '1567888888888888888', type: 0, allow: String(1n << 10n), deny: '0' },
      { id: DISCORD_GUILD_ID, type: 1, allow: String(1n << 10n), deny: '0' },
    ]);
    expect(result).toMatchObject({ view: false, send: false, connect: false, speak: false });
  });

  it('preserves the administrator bypass of channel denies', () => {
    expect(
      everyonePermissions(String(1n << 3n), [
        { id: DISCORD_GUILD_ID, type: 0, allow: '0', deny: String(1n << 10n) },
      ]),
    ).toMatchObject({ administrator: true, view: true, send: true });
  });
});

describe('Discord request failures', () => {
  it('redacts a credential even if it accidentally appears in a returned channel field or error', () => {
    expect(formatDiscordOutput({ topic: `Unexpected ${TOKEN}` }, TOKEN)).toContain('[REDACTED]');
    expect(formatDiscordOutput({ topic: TOKEN }, TOKEN)).not.toContain(TOKEN);
    expect(formatDiscordOutput(`Unexpected ${TOKEN}`, TOKEN)).not.toContain(TOKEN);
  });
  it('retries a failed GET once without revealing the upstream error or credential', async () => {
    const requestFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error(`network detail ${TOKEN}`))
      .mockResolvedValueOnce(json({ ok: true }));
    const pause = vi.fn(async () => {});
    expect(
      await createDiscordApi({ token: TOKEN, fetch: requestFetch, pause })('GET', '/users/@me'),
    ).toEqual({ ok: true });
    expect(requestFetch).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(250);
  });

  it('does not retry an uncertain write or expose its exception', async () => {
    const requestFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error(`network detail ${TOKEN}`));
    const request = createDiscordApi({ token: TOKEN, fetch: requestFetch });
    await expect(request('PATCH', `/channels/${CHANNEL_ID}`, { topic: 'Teste' })).rejects.toThrow(
      'a escrita não foi repetida',
    );
    expect(requestFetch).toHaveBeenCalledTimes(1);
    try {
      await request('PATCH', `/channels/${CHANNEL_ID}`, {});
    } catch (error) {
      expect(String(error)).not.toContain(TOKEN);
    }
  });

  it.each([undefined, '60'])(
    'omits the response body and does not guess a rate limit (%s)',
    async (retryAfter) => {
      const requestFetch = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          json({ message: TOKEN }, 429, retryAfter ? { 'Retry-After': retryAfter } : undefined),
        );
      const request = createDiscordApi({ token: TOKEN, fetch: requestFetch });
      await expect(request('GET', '/users/@me')).rejects.toThrow('HTTP 429');
      expect(requestFetch).toHaveBeenCalledTimes(1);
      await expect(request('GET', '/users/@me')).rejects.not.toThrow(TOKEN);
    },
  );

  it('rejects an arbitrary route before forwarding credentials', async () => {
    const requestFetch = vi.fn<typeof fetch>();
    await expect(
      createDiscordApi({ token: TOKEN, fetch: requestFetch })('GET', 'https://example.com'),
    ).rejects.toThrow('Rota de administração não permitida');
    expect(requestFetch).not.toHaveBeenCalled();
  });
});
