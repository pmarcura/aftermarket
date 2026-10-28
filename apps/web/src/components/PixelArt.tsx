import { sprites, type Sprite } from '../design/arte';

/** Ilustração em pixel art, sempre ampliada em múltiplo inteiro para manter os pixels nítidos. */
export function PixelArt({
  name,
  scale = 2,
  className = '',
}: {
  name: Sprite;
  scale?: number;
  className?: string;
}) {
  const { w, h } = sprites[name];
  return (
    <img
      className={`pixel-art ${className}`}
      src={`/arte/${name}.png`}
      width={w * scale}
      height={h * scale}
      alt=""
      draggable={false}
    />
  );
}

/** Fumaça em passos de pixel, para chaminés. Fica parada com movimento reduzido. */
export function Fumaca({ pontos }: { pontos: [number, number][] }) {
  return (
    <span className="pixel-fumaca" aria-hidden="true">
      {pontos.map(([x, y], i) => (
        <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * -1.1}s` }} />
      ))}
    </span>
  );
}
