// Grava docs/video/aftermarket-marketing-01.html quadro a quadro e gera um MP4 (H.264) sem ffmpeg:
// o Chrome instalado codifica cada quadro com WebCodecs e este script monta o arquivo MP4.
// Uso: npx tsx scripts/video/render.mts --saida=video.mp4
//      npx tsx scripts/video/render.mts --amostras=1.5,6,11 --pasta=amostras
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const RAIZ = 'D:/Novidade';
// --pagina=docs/video/... (sem barra inicial: o Git Bash trocaria "/docs" por um caminho do sistema)
const PAGINA =
  '/' + (arg('pagina') ?? 'docs/video/aftermarket-marketing-01.html').replace(/^\/+/, '');
const W = 1080,
  H = 1920;

// Servidor local: o WebCodecs só existe em página "segura" (localhost serve).
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.css': 'text/css',
};
const servidor = createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
  if (caminho === '/__enc') return res.end('<!doctype html><title>enc</title>');
  try {
    const arquivo = normalize(join(RAIZ, caminho));
    if (!arquivo.startsWith(normalize(RAIZ))) throw new Error('fora');
    const corpo = await readFile(arquivo);
    res.setHeader('Content-Type', TIPOS[extname(arquivo)] ?? 'application/octet-stream');
    res.end(corpo);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${(servidor.address() as { port: number }).port}`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const video = await ctx.newPage();
await video.goto(`${base}${PAGINA}?render=1`);
await video.evaluate('window.__pronto');
const dur: number = await video.evaluate('window.__duracao');
const fps: number = await video.evaluate('window.__fps');
const quadro = async (t: number) => {
  await video.evaluate('window.__seek(' + t + ')');
  return video.screenshot({ type: 'jpeg', quality: 93, clip: { x: 0, y: 0, width: W, height: H } });
};

const amostras = arg('amostras');
if (amostras) {
  const pasta = arg('pasta') ?? 'amostras';
  await mkdir(pasta, { recursive: true });
  for (const s of amostras.split(',')) {
    await writeFile(`${pasta}/t${String(s).padStart(5, '0')}.jpg`, await quadro(Number(s)));
  }
  console.log(`amostras em ${pasta} (duração ${dur.toFixed(1)} s)`);
  await browser.close();
  servidor.close();
  process.exit(0);
}

// Codificador H.264 numa segunda página do mesmo endereço.
const enc = await ctx.newPage();
await enc.goto(`${base}/__enc`);
// Código do codificador como texto puro: o tsx não pode injetar auxiliares (__name) nele.
await enc.addScriptTag({
  content: `
window.saida=[];window.erro=null;window.config=null;
window.encoder=new VideoEncoder({
  output:function(chunk,meta){var d=new Uint8Array(chunk.byteLength);chunk.copyTo(d);window.saida.push({ts:chunk.timestamp,key:chunk.type==="key",dados:d});
    if(meta&&meta.decoderConfig&&meta.decoderConfig.description)window.config=new Uint8Array(meta.decoderConfig.description);},
  error:function(e){window.erro=String(e);}
});
window.encoder.configure({codec:"avc1.640028",width:${W},height:${H},bitrate:${Number(arg('bitrate') ?? 12000000)},framerate:${fps},avc:{format:"avc"}});
window.adiciona=async function(b64,i){
  var bytes=Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0)});
  var bmp=await createImageBitmap(new Blob([bytes],{type:"image/jpeg"}));
  var frame=new VideoFrame(bmp,{timestamp:Math.round(i*1e6/${fps}),duration:Math.round(1e6/${fps})});
  while(window.encoder.encodeQueueSize>8)await new Promise(function(r){setTimeout(r,5)});
  window.encoder.encode(frame,{keyFrame:i%${fps * 2}===0});frame.close();bmp.close();
  if(window.erro)throw new Error(window.erro);
};
window.retira=function(){
  return window.saida.splice(0).map(function(c){var s="";for(var k=0;k<c.dados.length;k+=32768)s+=String.fromCharCode.apply(null,c.dados.subarray(k,k+32768));return{ts:c.ts,key:c.key,b64:btoa(s)}});
};
`,
});

const ate = Number(arg('ate') ?? dur);
const total = Math.round(Math.min(ate, dur) * fps);
const amostrasCod: { ts: number; key: boolean; dados: Buffer }[] = [];
const inicio = performance.now();
for (let i = 0; i < total; i++) {
  const jpg = await quadro(i / fps);
  await enc.evaluate('window.adiciona(' + JSON.stringify(jpg.toString('base64')) + ',' + i + ')');
  if (i % 60 === 59 || i === total - 1) {
    if (i === total - 1) await enc.evaluate('window.encoder.flush()');
    const lote: { ts: number; key: boolean; b64: string }[] = await enc.evaluate('window.retira()');
    for (const c of lote)
      amostrasCod.push({ ts: c.ts, key: c.key, dados: Buffer.from(c.b64, 'base64') });
    const seg = (performance.now() - inicio) / 1000;
    process.stdout.write(`\r${i + 1}/${total} quadros · ${seg.toFixed(0)} s`);
  }
}
const avcC = Buffer.from((await enc.evaluate('Array.from(window.config || [])')) as number[]);

// Trilha de efeitos: a página sintetiza (Web Audio) e o Chrome codifica em AAC; também sai um WAV.
const comAudio = arg('sem-audio') === undefined;
type Audio = {
  sr: number;
  desc: string;
  chunks: { ts: number; dur: number; b64: string }[];
  pcm: string;
  pico: number;
};
const audio: Audio | null = comAudio
  ? await video.evaluate(`(async () => {
  const buf = await window.__trilha();
  const sr = buf.sampleRate, total = Math.min(buf.length, Math.round(${total / fps} * sr));
  const L = buf.getChannelData(0).subarray(0, total), R = buf.getChannelData(1).subarray(0, total);
  const out = []; let desc = null, erro = null;
  const enc = new AudioEncoder({
    output: (c, meta) => { const d = new Uint8Array(c.byteLength); c.copyTo(d); out.push({ ts: c.timestamp, dur: c.duration, d });
      if (meta && meta.decoderConfig && meta.decoderConfig.description) desc = new Uint8Array(meta.decoderConfig.description); },
    error: (e) => { erro = String(e); },
  });
  enc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192000 });
  const BL = 4800;
  for (let i = 0; i < total; i += BL) {
    const n = Math.min(BL, total - i), plano = new Float32Array(n * 2);
    plano.set(L.subarray(i, i + n), 0); plano.set(R.subarray(i, i + n), n);
    enc.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / sr * 1e6), data: plano }));
  }
  await enc.flush(); if (erro) throw new Error(erro);
  const b64 = (u8) => { let s = ''; for (let k = 0; k < u8.length; k += 32768) s += String.fromCharCode.apply(null, u8.subarray(k, k + 32768)); return btoa(s); };
  const pcm = new Int16Array(total * 2); let pico = 0;
  for (let i = 0; i < total; i++) { const l = Math.max(-1, Math.min(1, L[i])), r = Math.max(-1, Math.min(1, R[i])); pcm[2 * i] = l * 32767; pcm[2 * i + 1] = r * 32767; pico = Math.max(pico, Math.abs(l), Math.abs(r)); }
  return { sr, desc: desc ? b64(desc) : '', chunks: out.map((c) => ({ ts: c.ts, dur: c.dur, b64: b64(c.d) })), pcm: b64(new Uint8Array(pcm.buffer)), pico };
})()`)
  : null;
await browser.close();
servidor.close();
if (!avcC.length) throw new Error('O codificador não devolveu a configuração H.264.');
for (let k = 1; k < amostrasCod.length; k++)
  if (amostrasCod[k].ts <= amostrasCod[k - 1].ts)
    throw new Error('Quadros fora de ordem (B-frames).');
if (audio && !audio.desc)
  throw new Error('O codificador de áudio não devolveu a configuração AAC.');

// MP4 mínimo (moov antes de mdat): faixa 1 = vídeo H.264, faixa 2 = áudio AAC.
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};
const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n & 0xffff);
  return b;
};
const caixa = (tipo: string, ...partes: Buffer[]) => {
  const corpo = Buffer.concat(partes);
  return Buffer.concat([u32(corpo.length + 8), Buffer.from(tipo, 'ascii'), corpo]);
};
const cheia = (tipo: string, versao: number, flags: number, ...partes: Buffer[]) =>
  caixa(
    tipo,
    Buffer.from([versao, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]),
    ...partes,
  );
const descritor = (tag: number, ...partes: Buffer[]) => {
  const corpo = Buffer.concat(partes);
  return Buffer.concat([Buffer.from([tag, corpo.length]), corpo]);
};
const MATRIZ = Buffer.concat([
  u32(0x10000),
  u32(0),
  u32(0),
  u32(0),
  u32(0x10000),
  u32(0),
  u32(0),
  u32(0),
  u32(0x40000000),
]);
const nV = amostrasCod.length,
  escalaV = fps * 1000;
const durMs = Math.round((nV * 1000) / fps);
const amostrasA = audio ? audio.chunks.map((c) => Buffer.from(c.b64, 'base64')) : [];
const deltasA = audio ? audio.chunks.map((c) => Math.round((c.dur * audio.sr) / 1e6) || 1024) : [];
const dinf = () => caixa('dinf', cheia('dref', 0, 0, u32(1), cheia('url ', 0, 1)));
const sttsDe = (deltas: number[]) => {
  const grupos: [number, number][] = [];
  for (const d of deltas) {
    const ult = grupos[grupos.length - 1];
    if (ult && ult[1] === d) ult[0]++;
    else grupos.push([1, d]);
  }
  return cheia('stts', 0, 0, u32(grupos.length), ...grupos.flatMap(([n, d]) => [u32(n), u32(d)]));
};
const trakVideo = (offset: number) => {
  const tkhd = cheia(
    'tkhd',
    0,
    3,
    u32(0),
    u32(0),
    u32(1),
    u32(0),
    u32(durMs),
    Buffer.alloc(8),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    MATRIZ,
    u32(W * 65536),
    u32(H * 65536),
  );
  const mdhd = cheia(
    'mdhd',
    0,
    0,
    u32(0),
    u32(0),
    u32(escalaV),
    u32(nV * 1000),
    u16(0x55c4),
    u16(0),
  );
  const hdlr = cheia(
    'hdlr',
    0,
    0,
    u32(0),
    Buffer.from('vide'),
    Buffer.alloc(12),
    Buffer.from('VideoHandler\0'),
  );
  const avc1 = caixa(
    'avc1',
    Buffer.alloc(6),
    u16(1),
    u16(0),
    u16(0),
    Buffer.alloc(12),
    u16(W),
    u16(H),
    u32(0x480000),
    u32(0x480000),
    u32(0),
    u16(1),
    Buffer.alloc(32),
    u16(0x18),
    u16(0xffff),
    caixa('avcC', avcC),
  );
  const chaves = amostrasCod.map((a, i) => (a.key ? i + 1 : 0)).filter(Boolean);
  const stbl = caixa(
    'stbl',
    cheia('stsd', 0, 0, u32(1), avc1),
    sttsDe(amostrasCod.map(() => 1000)),
    cheia('stss', 0, 0, u32(chaves.length), ...chaves.map(u32)),
    cheia('stsc', 0, 0, u32(1), u32(1), u32(nV), u32(1)),
    cheia('stsz', 0, 0, u32(0), u32(nV), ...amostrasCod.map((a) => u32(a.dados.length))),
    cheia('stco', 0, 0, u32(1), u32(offset)),
  );
  const minf = caixa('minf', cheia('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)), dinf(), stbl);
  return caixa('trak', tkhd, caixa('mdia', mdhd, hdlr, minf));
};
const trakAudio = (offset: number) => {
  const sr = audio!.sr,
    total = deltasA.reduce((a, b) => a + b, 0);
  const tkhd = cheia(
    'tkhd',
    0,
    3,
    u32(0),
    u32(0),
    u32(2),
    u32(0),
    u32(Math.round((total * 1000) / sr)),
    Buffer.alloc(8),
    u16(0),
    u16(1),
    u16(0x100),
    u16(0),
    MATRIZ,
    u32(0),
    u32(0),
  );
  const mdhd = cheia('mdhd', 0, 0, u32(0), u32(0), u32(sr), u32(total), u16(0x55c4), u16(0));
  const hdlr = cheia(
    'hdlr',
    0,
    0,
    u32(0),
    Buffer.from('soun'),
    Buffer.alloc(12),
    Buffer.from('SoundHandler\0'),
  );
  const asc = Buffer.from(audio!.desc, 'base64');
  const esds = cheia(
    'esds',
    0,
    0,
    descritor(
      0x03,
      u16(2),
      Buffer.from([0]),
      descritor(
        0x04,
        Buffer.from([0x40, 0x15, 0, 0, 0]),
        u32(192000),
        u32(192000),
        descritor(0x05, asc),
      ),
      descritor(0x06, Buffer.from([0x02])),
    ),
  );
  const mp4a = caixa(
    'mp4a',
    Buffer.alloc(6),
    u16(1),
    Buffer.alloc(8),
    u16(2),
    u16(16),
    u16(0),
    u16(0),
    u32(sr * 65536),
    esds,
  );
  const n = amostrasA.length;
  const stbl = caixa(
    'stbl',
    cheia('stsd', 0, 0, u32(1), mp4a),
    sttsDe(deltasA),
    cheia('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
    cheia('stsz', 0, 0, u32(0), u32(n), ...amostrasA.map((a) => u32(a.length))),
    cheia('stco', 0, 0, u32(1), u32(offset)),
  );
  const minf = caixa('minf', cheia('smhd', 0, 0, u16(0), u16(0)), dinf(), stbl);
  return caixa('trak', tkhd, caixa('mdia', mdhd, hdlr, minf));
};
const montaMoov = (inicioDados: number) => {
  const mvhd = cheia(
    'mvhd',
    0,
    0,
    u32(0),
    u32(0),
    u32(1000),
    u32(durMs),
    u32(0x10000),
    u16(0x100),
    Buffer.alloc(10),
    MATRIZ,
    Buffer.alloc(24),
    u32(audio ? 3 : 2),
  );
  const bytesV = amostrasCod.reduce((s, a) => s + a.dados.length, 0);
  return caixa(
    'moov',
    mvhd,
    trakVideo(inicioDados),
    ...(audio ? [trakAudio(inicioDados + bytesV)] : []),
  );
};
const ftyp = caixa('ftyp', Buffer.from('isom'), u32(0x200), Buffer.from('isomiso2avc1mp41'));
const dados = Buffer.concat([...amostrasCod.map((a) => a.dados), ...amostrasA]);
const inicioDados = ftyp.length + montaMoov(0).length + 8;
const mp4 = Buffer.concat([
  ftyp,
  montaMoov(inicioDados),
  u32(dados.length + 8),
  Buffer.from('mdat'),
  dados,
]);
const saida = arg('saida') ?? 'video.mp4';
await writeFile(saida, mp4);
console.log(
  `\n${saida}: ${nV} quadros, ${(nV / fps).toFixed(2)} s, ${(mp4.length / 1e6).toFixed(1)} MB` +
    (audio
      ? `, áudio AAC ${amostrasA.length} blocos, pico ${(20 * Math.log10(audio.pico || 1e-9)).toFixed(1)} dBFS`
      : ''),
);
if (audio) {
  // WAV 16 bits da trilha de efeitos, para mixar com a narração
  const pcm = Buffer.from(audio.pcm, 'base64');
  const cab = Buffer.concat([
    Buffer.from('RIFF'),
    u32le(36 + pcm.length),
    Buffer.from('WAVEfmt '),
    u32le(16),
    u16le(1),
    u16le(2),
    u32le(audio.sr),
    u32le(audio.sr * 4),
    u16le(4),
    u16le(16),
    Buffer.from('data'),
    u32le(pcm.length),
  ]);
  const wav = saida.replace(/\.mp4$/, '') + '-efeitos.wav';
  await writeFile(wav, Buffer.concat([cab, pcm]));
  console.log(`${wav}: trilha de efeitos em WAV`);
}
function u32le(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}
function u16le(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
