import { Flag, Play, Rocket, Trophy, Volume2, VolumeX, Wrench } from 'lucide-react';
import type { SaveData } from '../game/types';
import { CHECKPOINTS } from '../game/content';
import { CoinChip } from './bits';
import { cn } from '../utils/cn';

export function Menu({
  save,
  startCp,
  setStartCp,
  onPlay,
  onOpen,
  onToggleMute,
}: {
  save: SaveData;
  startCp: number;
  setStartCp: (v: number) => void;
  onPlay: (cp: number) => void;
  onOpen: (s: 'upgrades' | 'ships' | 'achievements') => void;
  onToggleMute: () => void;
}) {
  const unlocked = CHECKPOINTS.filter((c) => save.checkpoints.includes(c));
  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      {/* top bar */}
      <div className="safe-top flex items-center justify-between px-4 pt-3">
        <div className="text-[10px] font-extrabold tracking-[0.3em] text-cyan-300/70">NS-77 // VOID PROTOCOL</div>
        <div className="flex items-center gap-2">
          <CoinChip value={save.coins} />
          <button
            type="button"
            onClick={onToggleMute}
            className="btn glass flex h-11 w-11 items-center justify-center rounded-full text-cyan-100"
            aria-label="Toggle sound"
          >
            {save.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* title */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="pop-in text-center">
          <div className="mb-2 text-[11px] font-bold tracking-[0.5em] text-cyan-300">ENDLESS ARCADE</div>
          <h1 className="title-gradient animate-flicker text-[52px] leading-[0.95] font-black tracking-[0.08em]">
            NOVA
            <br />
            STRIKE
          </h1>
        </div>
        <div className="pop-in-1 mt-6 grid w-full max-w-[300px] grid-cols-3 gap-2">
          <div className="glass rounded-2xl px-2 py-2.5 text-center">
            <div className="num text-lg leading-none font-extrabold text-cyan-100">{save.best}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.22em] text-slate-400">BEST</div>
          </div>
          <div className="glass rounded-2xl px-2 py-2.5 text-center">
            <div className="num text-lg leading-none font-extrabold text-cyan-100">{save.stats.runs}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.22em] text-slate-400">RUNS</div>
          </div>
          <div className="glass rounded-2xl px-2 py-2.5 text-center">
            <div className="num text-lg leading-none font-extrabold text-cyan-100">{save.stats.kills}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.22em] text-slate-400">KILLS</div>
          </div>
        </div>
      </div>

      {/* bottom controls */}
      <div className="safe-bottom px-6 pb-5">
        {unlocked.length > 0 && (
          <div className="pop-in-1 mb-3">
            <div className="mb-1.5 text-center text-[9px] font-bold tracking-[0.3em] text-slate-400">LAUNCH FROM</div>
            <div className="flex justify-center gap-2 overflow-x-auto">
              {[0, ...unlocked].map((cp) => (
                <button
                  key={cp}
                  type="button"
                  onClick={() => setStartCp(cp)}
                  className={cn(
                    'btn flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[11px] font-extrabold tracking-wider',
                    startCp === cp ? 'btn-primary' : 'btn-ghost text-slate-300',
                  )}
                >
                  <Flag size={11} strokeWidth={2.8} />
                  {cp === 0 ? 'BASE' : cp}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => onPlay(startCp)}
          className="btn btn-primary pop-in-2 flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-black tracking-[0.3em]"
        >
          <Play size={24} strokeWidth={3} className="fill-current" />
          LAUNCH
        </button>
        <div className="pop-in-3 mt-3 grid grid-cols-3 gap-2">
          {(
            [
              { id: 'upgrades', label: 'HANGAR', Icon: Wrench },
              { id: 'ships', label: 'SHIPS', Icon: Rocket },
              { id: 'achievements', label: 'MEDALS', Icon: Trophy },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              className="btn btn-ghost flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-slate-200"
            >
              <Icon size={18} strokeWidth={2.2} />
              <span className="text-[9px] font-extrabold tracking-[0.2em]">{label}</span>
            </button>
          ))}
        </div>
        <div className="animate-pulse-soft mt-4 text-center text-[10px] font-semibold tracking-[0.2em] text-slate-500">
          TOUCH + DRAG TO FLY — CANNONS FIRE THEMSELVES
        </div>
      </div>
    </div>
  );
}
