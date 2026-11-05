import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Administration is deliberately limited to the game's existing server.
export const DISCORD_GUILD_ID = '1567690605864165508';
const API = 'https://discord.com/api/v10';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PERMISSION = {
  administrator: 1n << 3n,
  view: 1n << 10n,
  send: 1n << 11n,
  history: 1n << 16n,
  connect: 1n << 20n,
  speak: 1n << 21n,
  externalApps: 1n << 50n,
  pin: 1n << 51n,
};

export interface PermissionOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}
interface Channel {
  id: string;
  guild_id?: string;
  name?: string;
  type: number;
  topic?: string | null;
  position?: number;
  parent_id?: string | null;
  permission_overwrites?: PermissionOverwrite[];
}
interface Role {
  id: string;
  name: string;
  permissions: string;
}
interface Guild {
  id: string;
  name: string;
  icon?: string | null;
}
interface Invite {
  code: string;
  guild?: { id: string };
  channel?: { id: string };
  max_age?: number;
  max_uses?: number;
  temporary?: boolean;
  expires_at?: string | null;
  revoked?: boolean;
}
export interface DiscordAdminDependencies {
  token?: string;
  fetch?: typeof fetch;
  pause?: (milliseconds: number) => Promise<void>;
}

function permissionBits(value: string) {
  if (!/^\d+$/.test(value)) safeError('O Discord retornou uma permissão inválida.');
  return BigInt(value);
}

/** Estimate @everyone alone, without other roles or member-specific overrides. */
export function everyonePermissions(base: string, overwrites: PermissionOverwrite[] = []) {
  let bits = permissionBits(base);
  const administrator = (bits & PERMISSION.administrator) !== 0n;
  const overwrite = overwrites.find((item) => item.type === 0 && item.id === DISCORD_GUILD_ID);
  if (overwrite && !administrator)
    bits = (bits & ~permissionBits(overwrite.deny)) | permissionBits(overwrite.allow);
  const has = (permission: bigint) => administrator || (bits & permission) !== 0n;
  const view = has(PERMISSION.view);
  const connect = view && has(PERMISSION.connect);
  return {
    bits: bits.toString(),
    administrator,
    view,
    send: view && has(PERMISSION.send),
    history: view && has(PERMISSION.history),
    connect,
    speak: connect && has(PERMISSION.speak),
    externalApps: view && has(PERMISSION.externalApps),
    pin: view && has(PERMISSION.pin),
  };
}

function safeError(message: string): never {
  throw new Error(message);
}

export function createDiscordApi(dependencies: DiscordAdminDependencies) {
  const token = dependencies.token?.trim();
  if (!token || /\s/.test(token))
    safeError('Defina DISCORD_BOT_TOKEN no ambiente com o token do bot, sem o prefixo Bot.');
  const requestFetch = dependencies.fetch ?? fetch;
  const pause =
    dependencies.pause ?? ((milliseconds) => new Promise((r) => setTimeout(r, milliseconds)));

  return async function request<T>(
    method: 'GET' | 'PATCH' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    // Routes never come from arbitrary URLs, preventing credential forwarding.
    if (
      !/^\/(?:users\/@me|guilds\/\d+(?:\/(?:channels|roles))?|channels\/\d+(?:\/invites)?)$/.test(
        path,
      )
    )
      safeError('Rota de administração não permitida.');
    const attempts = method === 'GET' ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      let response: Response;
      try {
        response = await requestFetch(`${API}${path}`, {
          method,
          redirect: 'error',
          signal: AbortSignal.timeout(4000),
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'AFTERMARKET-Discord-Admin/1.0',
            ...(method !== 'GET'
              ? { 'X-Audit-Log-Reason': 'AFTERMARKET community administration' }
              : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch {
        if (method === 'GET' && attempt + 1 < attempts) {
          await pause(250);
          continue;
        }
        safeError(
          method === 'GET'
            ? 'Falha de conexão com o Discord. Tente a consulta novamente.'
            : 'O Discord não confirmou a alteração. Consulte o estado antes de tentar novamente; a escrita não foi repetida.',
        );
      }
      if (!response.ok) {
        if (
          method === 'GET' &&
          attempt + 1 < attempts &&
          (response.status === 429 || response.status >= 500)
        ) {
          const retryAfter =
            response.status === 429 ? Number(response.headers.get('Retry-After') ?? 'NaN') : 0.25;
          // Never shorten a longer rate limit: let the caller retry later instead.
          if (Number.isFinite(retryAfter) && retryAfter >= 0 && retryAfter <= 1) {
            await pause(Math.max(250, retryAfter * 1000));
            continue;
          }
        }
        safeError(
          `Discord respondeu HTTP ${response.status}. Confira acesso e permissões do bot; o corpo da resposta foi omitido.`,
        );
      }
      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch {
        safeError(
          'O Discord retornou uma resposta inválida. Consulte o estado antes de repetir uma alteração.',
        );
      }
    }
    return safeError('A consulta ao Discord não foi concluída.');
  };
}

const HELP = `Administração do Discord AFTERMARKET (${DISCORD_GUILD_ID})

Uso:
  node --env-file=.runtime/discord.env --import tsx scripts/discord-admin.ts status
  npx tsx scripts/discord-admin.ts icon <arquivo.png|jpg|webp> [--apply]
  npx tsx scripts/discord-admin.ts invite <canalId> [--apply]
  npx tsx scripts/discord-admin.ts channel <canalId> [--name=nome] [--topic=assunto] [--position=numero] [--apply]

As alterações mostram uma prévia por padrão. --apply executa a ação.
DISCORD_BOT_TOKEN é lido somente do ambiente. Não passe tokens nos argumentos.
Não há comandos de exclusão, alteração de permissões ou leitura de inscrições.
O comando status calcula @everyone sem outros cargos ou overrides individuais.
`;

function parseArguments(args: string[]) {
  const [command, ...remaining] = args;
  if (!command || command === '--help' || command === 'help') return { help: true } as const;
  if (!['status', 'icon', 'invite', 'channel'].includes(command))
    safeError('Comando desconhecido. Use --help.');
  const positional: string[] = [];
  const options: Record<string, string> = {};
  let apply = false;
  for (const argument of remaining) {
    if (argument === '--apply' && !apply) apply = true;
    else if (argument.startsWith('--')) {
      const separator = argument.indexOf('=');
      const name = argument.slice(2, separator);
      if (separator < 0 || !['name', 'topic', 'position'].includes(name) || name in options)
        safeError('Opção inválida ou repetida. Use --help.');
      options[name] = argument.slice(separator + 1);
    } else positional.push(argument);
  }
  if (
    (command === 'status' &&
      (positional.length !== 0 || apply || Object.keys(options).length !== 0)) ||
    (command !== 'status' && positional.length !== 1) ||
    (command !== 'channel' && Object.keys(options).length !== 0)
  )
    safeError('Argumentos inválidos. Use --help.');
  return { help: false, command, positional, options, apply } as const;
}

function channelId(value: string) {
  if (!/^\d{17,20}$/.test(value))
    safeError('ID de canal inválido. Copie o ID numérico do Discord.');
  return value;
}

async function loadImage(path: string) {
  const info = await stat(path).catch(() => safeError('Não foi possível abrir a imagem do ícone.'));
  if (!info.isFile() || info.size < 3 || info.size > MAX_IMAGE_BYTES)
    safeError('O ícone deve ser um arquivo de imagem de até 8 MiB.');
  const bytes = await readFile(path).catch(() =>
    safeError('Não foi possível ler a imagem do ícone.'),
  );
  if (bytes.length > MAX_IMAGE_BYTES) safeError('A imagem excede 8 MiB.');
  const extension = extname(path).toLowerCase();
  let mime: string | undefined;
  if (
    extension === '.png' &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = 'image/png';
  if (
    ['.jpg', '.jpeg'].includes(extension) &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    mime = 'image/jpeg';
  if (
    extension === '.webp' &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    mime = 'image/webp';
  if (!mime) safeError('Use um arquivo PNG, JPEG ou WebP cujo conteúdo corresponda à extensão.');
  return {
    file: basename(path),
    mime,
    bytes: bytes.length,
    data: `data:${mime};base64,${bytes.toString('base64')}`,
  };
}

function inviteSummary(invite: Invite, expectedChannel: string) {
  if (
    !/^[A-Za-z0-9_-]{2,100}$/.test(invite.code) ||
    invite.channel?.id !== expectedChannel ||
    (invite.guild && invite.guild.id !== DISCORD_GUILD_ID)
  )
    safeError('O Discord retornou um convite incompatível com o canal esperado.');
  return { url: `https://discord.gg/${invite.code}`, channelId: expectedChannel, permanent: true };
}

export async function runDiscordAdmin(args: string[], dependencies: DiscordAdminDependencies = {}) {
  const parsed = parseArguments(args);
  if (parsed.help) return HELP;
  const api = createDiscordApi({
    ...dependencies,
    token: dependencies.token ?? process.env.DISCORD_BOT_TOKEN,
  });
  const bot = await api<{ id: string; username: string; bot?: boolean }>('GET', '/users/@me');
  if (bot.bot !== true)
    safeError('A autenticação não pertence a um bot. Use o token do bot exclusivo do jogo.');
  const guild = await api<Guild>('GET', `/guilds/${DISCORD_GUILD_ID}`);
  if (guild.id !== DISCORD_GUILD_ID) safeError('A resposta não pertence ao servidor AFTERMARKET.');

  if (parsed.command === 'status') {
    const [channels, roles] = await Promise.all([
      api<Channel[]>('GET', `/guilds/${DISCORD_GUILD_ID}/channels`),
      api<Role[]>('GET', `/guilds/${DISCORD_GUILD_ID}/roles`),
    ]);
    const everyone = roles.find((role) => role.id === DISCORD_GUILD_ID);
    if (!everyone) safeError('O cargo @everyone não foi encontrado.');
    return {
      guild: { id: guild.id, name: guild.name, icon: guild.icon ?? null },
      bot: { id: bot.id, username: bot.username },
      roles: roles.map(({ id, name, permissions }) => ({ id, name, permissions })),
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name ?? null,
        type: channel.type,
        parentId: channel.parent_id ?? null,
        position: channel.position,
        topic: channel.topic ?? null,
        everyone: everyonePermissions(everyone.permissions, channel.permission_overwrites),
        overwrites: channel.permission_overwrites ?? [],
      })),
      note: '@everyone é calculado sem outros cargos ou overrides por membro. Nenhum conteúdo de mensagem foi lido.',
    };
  }

  if (parsed.command === 'icon') {
    const image = await loadImage(parsed.positional[0]);
    const summary = {
      action: 'icon',
      guildId: DISCORD_GUILD_ID,
      file: image.file,
      mime: image.mime,
      bytes: image.bytes,
    };
    if (!parsed.apply) return { applied: false, ...summary };
    const updated = await api<Guild>('PATCH', `/guilds/${DISCORD_GUILD_ID}`, { icon: image.data });
    return { applied: true, ...summary, icon: updated.icon ?? null };
  }

  const id = channelId(parsed.positional[0]);
  const channel = await api<Channel>('GET', `/channels/${id}`);
  if (channel.id !== id || channel.guild_id !== DISCORD_GUILD_ID)
    safeError('Canal fora do servidor AFTERMARKET. Nenhuma alteração foi enviada.');

  if (parsed.command === 'invite') {
    if (![0, 2, 5, 13, 15, 16].includes(channel.type))
      safeError('Este tipo de canal não aceita um convite de entrada.');
    const invites = await api<Invite[]>('GET', `/channels/${id}/invites`);
    const existing = invites.find(
      (invite) =>
        invite.channel?.id === id &&
        invite.max_age === 0 &&
        invite.max_uses === 0 &&
        invite.temporary === false &&
        !invite.expires_at &&
        !invite.revoked,
    );
    if (existing) return { applied: false, reused: true, ...inviteSummary(existing, id) };
    if (!parsed.apply)
      return {
        applied: false,
        action: 'invite',
        channelId: id,
        maxAge: 0,
        maxUses: 0,
        temporary: false,
      };
    const created = await api<Invite>('POST', `/channels/${id}/invites`, {
      max_age: 0,
      max_uses: 0,
      temporary: false,
      unique: false,
    });
    if (
      created.max_age !== 0 ||
      created.max_uses !== 0 ||
      created.temporary !== false ||
      created.expires_at
    )
      safeError(
        'O Discord criou um convite com configuração diferente da solicitada. Consulte os convites antes de repetir.',
      );
    return { applied: true, reused: false, ...inviteSummary(created, id) };
  }

  const changes: Record<string, string | number> = {};
  if ('name' in parsed.options) {
    const name = parsed.options.name.trim();
    if (!name || name.length > 100 || /[\r\n]/.test(name))
      safeError('Nome do canal deve ter entre 1 e 100 caracteres em uma linha.');
    changes.name = name;
  }
  if ('topic' in parsed.options) {
    if (![0, 5].includes(channel.type))
      safeError('A edição de assunto está disponível apenas para canais de texto ou anúncios.');
    if (parsed.options.topic.length > 1024) safeError('O assunto deve ter até 1024 caracteres.');
    changes.topic = parsed.options.topic;
  }
  if ('position' in parsed.options) {
    const position = Number(parsed.options.position);
    if (
      !/^\d+$/.test(parsed.options.position) ||
      !Number.isSafeInteger(position) ||
      position > 10000
    )
      safeError('A posição deve ser um número inteiro entre 0 e 10000.');
    changes.position = position;
  }
  if (Object.keys(changes).length === 0)
    safeError('Indique --name, --topic ou --position. Use --help.');
  const before = { name: channel.name, topic: channel.topic, position: channel.position };
  if (!parsed.apply) return { applied: false, action: 'channel', channelId: id, before, changes };
  const updated = await api<Channel>('PATCH', `/channels/${id}`, changes);
  return {
    applied: true,
    action: 'channel',
    channelId: updated.id,
    name: updated.name,
    topic: updated.topic,
    position: updated.position,
  };
}

export function formatDiscordOutput(result: unknown, token = process.env.DISCORD_BOT_TOKEN) {
  const secret = token?.trim();
  const redact = (value: string) => (secret ? value.replaceAll(secret, '[REDACTED]') : value);
  return typeof result === 'string'
    ? redact(result)
    : JSON.stringify(
        result,
        (_key, value: unknown) => (typeof value === 'string' ? redact(value) : value),
        2,
      );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDiscordAdmin(process.argv.slice(2)).then(
    (result) => console.log(formatDiscordOutput(result)),
    (error: unknown) => {
      // Network errors and Discord response bodies never reach this output.
      console.error(
        formatDiscordOutput(
          error instanceof Error ? error.message : 'A administração do Discord falhou.',
        ),
      );
      process.exitCode = 1;
    },
  );
}
