import { deflateSync, inflateSync } from 'node:zlib';

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
interface Pixels {
  width: number;
  height: number;
  data: Buffer;
}
const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c,
    da = Math.abs(p - a),
    db = Math.abs(p - b),
    dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
};

/** PNG subset emitted by browser screenshots: 8-bit RGB/RGBA, non-interlaced. */
export function decodeScreenshotPng(buffer: Buffer): Pixels {
  if (!buffer.subarray(0, 8).equals(signature)) throw Error('Assinatura PNG inválida.');
  let width = 0,
    height = 0,
    channels = 0;
  const parts: Buffer[] = [];
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset),
      type = buffer.toString('ascii', offset + 4, offset + 8);
    if (offset + length + 12 > buffer.length) throw Error('PNG truncado.');
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      if (
        length !== 13 ||
        chunk[8] !== 8 ||
        ![2, 6].includes(chunk[9]) ||
        chunk[10] ||
        chunk[11] ||
        chunk[12]
      )
        throw Error('Comparação disponível para PNG RGB/RGBA 8-bit sem entrelaçamento.');
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      channels = chunk[9] === 6 ? 4 : 3;
    }
    if (type === 'IDAT') parts.push(chunk);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  if (!width || !height || !channels || width * height > 100_000_000)
    throw Error('Dimensões PNG inválidas.');
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(parts), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw Error('Dados PNG incompletos.');
  const decoded = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw Error('Filtro PNG inválido.');
    for (let x = 0; x < stride; x++) {
      const target = y * stride + x,
        a = x >= channels ? decoded[target - channels] : 0;
      const b = y ? decoded[target - stride] : 0;
      const c = y && x >= channels ? decoded[target - stride - channels] : 0;
      const prediction =
        filter === 1
          ? a
          : filter === 2
            ? b
            : filter === 3
              ? Math.floor((a + b) / 2)
              : filter === 4
                ? paeth(a, b, c)
                : 0;
      decoded[target] = (raw[y * (stride + 1) + 1 + x] + prediction) & 255;
    }
  }
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = decoded[i * channels];
    data[i * 4 + 1] = decoded[i * channels + 1];
    data[i * 4 + 2] = decoded[i * channels + 2];
    data[i * 4 + 3] = channels === 4 ? decoded[i * channels + 3] : 255;
  }
  return { width, height, data };
}
function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}
export function encodeScreenshotPng({ width, height, data }: Pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function compareScreenshotPng(before: Buffer, after: Buffer, threshold = 16) {
  const a = decodeScreenshotPng(before),
    b = decodeScreenshotPng(after);
  if (a.width !== b.width || a.height !== b.height) return { status: 'size-mismatch' as const };
  const diff = Buffer.alloc(a.data.length);
  let changedPixels = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const changed = [0, 1, 2, 3].some(
      (channel) => Math.abs(a.data[i + channel] - b.data[i + channel]) > threshold,
    );
    if (changed) changedPixels++;
    const gray = Math.round((b.data[i] + b.data[i + 1] + b.data[i + 2]) / 3);
    diff[i] = changed ? 240 : gray;
    diff[i + 1] = changed ? 35 : gray;
    diff[i + 2] = changed ? 80 : gray;
    diff[i + 3] = changed ? 255 : 90;
  }
  return {
    status: changedPixels ? ('changed' as const) : ('unchanged' as const),
    changedPixels,
    changedRatio: changedPixels / (a.width * a.height),
    diff: changedPixels ? encodeScreenshotPng({ ...a, data: diff }) : undefined,
  };
}
