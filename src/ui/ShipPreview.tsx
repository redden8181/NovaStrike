import { useEffect, useRef } from 'react';
import { drawShip } from '../game/sprites';
import type { ShipId } from '../game/types';

export function ShipPreview({ ship }: { ship: ShipId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (time: number) => {
      ctx.clearRect(0, 0, 480, 300);
      ctx.save();
      ctx.translate(240, 144 + (reduced ? 0 : Math.sin(time / 1200) * 7));
      ctx.scale(3.1, 3.1);
      drawShip(ctx, ship, time / 1000, 0.65);
      ctx.restore();
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw(0);
    return () => cancelAnimationFrame(raf);
  }, [ship]);
  return <canvas ref={ref} width={480} height={300} className="hangar-ship" role="img" aria-label="Выбранный корабль" />;
}
