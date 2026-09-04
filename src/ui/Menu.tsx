import { Layers, Play, Rocket, Trophy, Volume2, VolumeX, Wrench } from 'lucide-react';
import type { GameMode, SaveData } from '../game/types';
import { MODE_MAP } from '../game/modes';
import { CoinChip } from './bits';
import { cn } from '../utils/cn';

export function Menu({
  save,
  lastMode,
  startCp,
  onPlay,
  onOpen,
  onToggleMute,
}: {
  save: SaveData;
  lastMode: GameMode;
  startCp: number;
  onPlay: (mode: GameMode, cp: number) => void;
  onOpen: (s: 'upgrades' | 'ships' | 'achievements' | 'modes') => void;
  onToggleMute: () => void;
}) {
  const mode = MODE_MAP[lastMode];
  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <div className="safe-top flex items-center justify-between px-4 pt-3">
        <div className="text-[10px] font-extrabold tracking-[0.3em] text-cyan-300/70">NS-77 // ПРОТОКОЛ «БЕЗДНА»</div>
        <div className="flex items-center gap-2">
          <CoinChip value={save.coins} />
          <button
            type="button"
            onClick={onToggleMute}
            className="btn glass flex h-11 w-11 items-center justify-center rounded-full text-cyan-100"
            aria-label="Звук"
          >
            {save.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="pop-in text-center">
          <div className="mb-2 text-[11px] font-bold tracking-[0.42em] text-cyan-300">БЕСКОНЕЧНАЯ АРКАДА</div>
          <h1 className="title-gradient animate-flicker text-[52px] leading-[0.95] font-black tracking-[0.08em]">
            NOVA
            <br />
            STRIKE
          </h1>
        </div>
        <div className="pop-in-1 mt-6 grid w-full max-w-[300px] grid-cols-3 gap-2">
          <div className="glass rounded-2xl px-2 py-2.5 text-center">
            <div className="num text-lg leading-none font-extrabold text-cyan-100">{save.best}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.2em] text-slate-400">РЕКОРД</div>
          </div>
          <div className="glass rounded-2xl px-2 py-2.5 text-center">
            <div className="num text-lg leading-none font-extrabold text-cyan-100">{save.stats.runs}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.2em] text-slate-400">ЗАБЕГИ</div>
          </div>
          <div className="glass rounded-2xl px-2 py-2.5 text-center">
            <div className="num text-lg leading-none font-extrabold text-cyan-100">{save.stats.kills}</div>
            <div className="mt-1 text-[8px] font-bold tracking-[0.2em] text-slate-400">УБИТО</div>
          </div>
        </div>
      </div>

      <div className="safe-bottom px-6 pb-5">
        <button
          type="button"
          onClick={() => onPlay(lastMode, startCp)}
          className="btn btn-primary pop-in-2 flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-black tracking-[0.34em]"
          style={
            lastMode !== 'classic'
              ? { background: `linear-gradient(135deg, ${mode.color}, ${mode.color}aa)`, boxShadow: `0 10px 34px -8px ${mode.color}` }
              : undefined
          }
        >
          <Play size={24} strokeWidth={3} className="fill-current" />В БОЙ
        </button>
        <button
          type="button"
          onClick={() => onOpen('modes')}
          className="btn btn-ghost pop-in-2 mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[11px] font-black tracking-[0.22em]"
          style={{ color: mode.color, borderColor: `${mode.color}55` }}
        >
          <Layers size={16} strokeWidth={2.6} />
          {mode.name}
          {lastMode === 'classic' && startCp > 0 && <span className="num text-slate-300">· ТОЧКА {startCp}</span>}
        </button>

        <div className="pop-in-3 mt-2.5 grid grid-cols-3 gap-2">
          {(
            [
              { id: 'upgrades', label: 'АНГАР', Icon: Wrench },
              { id: 'ships', label: 'КОРАБЛИ', Icon: Rocket },
              { id: 'achievements', label: 'ПРОГРЕСС', Icon: Trophy },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onOpen(id)}
              className={cn('btn btn-ghost flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-slate-200')}
            >
              <Icon size={18} strokeWidth={2.2} />
              <span className="text-[9px] font-extrabold tracking-[0.2em]">{label}</span>
            </button>
          ))}
        </div>
        <div className="animate-pulse-soft mt-4 text-center text-[10px] font-semibold tracking-[0.16em] text-slate-500">
          ТЯНИ ПАЛЬЦЕМ · ЖМИ СПОСОБНОСТЬ · ВЫЖИВИ
        </div>
      </div>
    </div>
  );
}
