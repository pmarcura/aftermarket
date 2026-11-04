import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { World } from '../../../packages/simulation/src/model';
import { worldView } from './view';

const compress = promisify(gzip);
export interface WorldPacket {
  json: Buffer;
  gzip: Promise<Buffer>;
}

/** Two current company snapshots; strings/buffers are immutable even as the
 * authoritative world mutates. Oversize snapshots are sent without retention. */
export function createWorldPacketCache(project = worldView) {
  let current: World | undefined;
  let revision = -1;
  const packets = new Map<string, WorldPacket>();
  let bytes = 0;
  return (world: World, actor: string): WorldPacket => {
    if (current !== world || revision !== world.revision) {
      current = world;
      revision = world.revision;
      packets.clear();
      bytes = 0;
    }
    const cached = packets.get(actor);
    if (cached) return cached;
    const json = Buffer.from(JSON.stringify(project(world, actor)));
    const packet: WorldPacket = { json, gzip: compress(json, { level: 6 }) };
    // Keep rejected compression observable only by consumers, never unhandled.
    void packet.gzip.catch(() => undefined);
    if (packets.size < 2 && bytes + json.length * 2 <= 16 * 1024 * 1024) {
      packets.set(actor, packet);
      bytes += json.length * 2;
    }
    return packet;
  };
}
