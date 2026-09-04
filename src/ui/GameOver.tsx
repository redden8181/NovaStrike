import { Award, Flag, Home, Layers, RotateCcw, Sparkles, Swords, Wrench } from 'lucide-react';
import type { RunResult, SaveData } from '../game/types';
import { ACHIEVEMENT_MAP, MILESTONES } from '../game/content';
import { MODE_MAP } from '../game/modes';
import { fmtTime, StatCell } from './bits';

export function GameOver({
  result,
  save,
  onRetry,
  onMenu,
  onModes,
  onUpgrades,
}: {
  result: RunResult;
  save: SaveData;
  onRetry: () => void;
  onMenu: () => void;
  onModes: () => void;
  onUpgrades: () => void;
}) {
  const mode = MODE_MAP[result.mode];
  const unlockNames = result.newUnlocks.map((u) => MILESTONES.find((m) => m.unlock === u)?.name ?? u);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/78 backdrop-blur-md">
      <div className="safe-top flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4" style={{ touchAction: 'pan-y' }}>
        <div className="pop-in text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] font-extrabold tracking-[0.34em] text-rose-300/80">СВЯЗЬ ПОТЕРЯНА</span>
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.14em]"
              style={{ background: `${mode.color}22`, color: mode.color }}
            >
              {result.modeLabel}
            </span>
          </div>
          <h2
            className="animate-flicker mt-2 text-5xl leading-none font-black tracking-[0.06em] text-rose-400"
            style={{ textShadow: '0 0 30px rgba(244,63,94,0.5), 0 0 90px rgba(244,63,94,0.25)' }}
          >
            КОНЕЦ
            <br />
            ИГРЫ
          </h2>
          {result.newBest && (
            <div className="animate-pulse-soft mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/15 px-4 py-1.5 text-[11px] font-black tracking-[0.2em] text-amber-300">
              <Sparkles size={13} strokeWidth={2.6} />
              НОВЫЙ РЕКОРД
            </div>
          )}
        </div>

        <div className="pop-in-1 mt-5 grid w-full max-w-[320px] grid-cols-2 gap-2">
          <StatCell label="СЧЁТ" value={`${result.score}`} accent="#a5f3fc" />
          <StatCell label="РЕКОРД" value={`${result.best}`} accent={result.newBest ? '#fbbf24' : '#e6f1ff'} />
          <StatCell label="МОНЕТЫ" value={`+${result.coins}`} accent="#fbbf24" />
          <StatCell
            label={result.mode === 'bossrush' ? 'ЛИНКОРЫ' : 'УГРОЗА'}
            value={result.mode === 'bossrush' ? `${result.bossKills}` : `${result.level}`}
            accent={mode.color}
          />
        </div>
        <div className="pop-in-1 num mt-2 text-center text-[11px] font-semibold tracking-wider text-slate-400">
          {result.kills} УБИТО · {fmtTime(result.time)} В ВОЗДУХЕ
          {result.bossKills > 0 && result.mode !== 'bossrush' ? ` · ${result.bossKills} БОСС` : ''}
          {result.startCheckpoint > 0 ? ` · С ТОЧКИ ${result.startCheckpoint}` : ''}
        </div>
        {result.mode === 'daily' && result.dailyBest !== undefined && (
          <div className="pop-in-1 num mt-1 text-[11px] font-bold tracking-wider text-amber-300">
            РЕКОРД ДНЯ {result.dailyBest}
          </div>
        )}

        {(result.newCheckpoints.length > 0 || unlockNames.length > 0 || result.newAchievements.length > 0) && (
          <div className="pop-in-2 mt-4 flex w-full max-w-[320px] flex-col gap-1.5">
            {unlockNames.map((name) => (
              <div key={name} className="flex items-center gap-2 rounded-xl border border-violet-300/40 bg-violet-400/10 px-3.5 py-2.5">
                <Swords size={14} className="shrink-0 text-violet-300" strokeWidth={2.6} />
                <span className="text-[11px] font-extrabold tracking-[0.12em] text-violet-200">ОТКРЫТО: {name}</span>
              </div>
            ))}
            {result.newCheckpoints
              .filter((cp) => !MILESTONES.find((m) => m.score === cp)?.unlock)
              .map((cp) => (
                <div key={cp} className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3.5 py-2.5">
                  <Flag size={14} className="shrink-0 text-emerald-300" strokeWidth={2.6} />
                  <span className="text-[11px] font-extrabold tracking-[0.12em] text-emerald-200">ЧЕКПОИНТ {cp} ОТКРЫТ</span>
                </div>
              ))}
            {result.newAchievements.map((id) => {
              const a = ACHIEVEMENT_MAP[id];
              if (!a) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3.5 py-2.5">
                  <Award size={14} className="shrink-0 text-amber-300" strokeWidth={2.6} />
                  <span className="text-[11px] font-extrabold tracking-[0.12em] text-amber-200">
                    {a.name} <span className="num font-bold text-amber-300/90">+{a.reward}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="safe-bottom pop-in-2 px-6 pb-6">
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-primary flex h-15 w-full items-center justify-center gap-2.5 rounded-2xl text-lg font-black tracking-[0.3em]"
          style={
            result.mode !== 'classic'
              ? { background: `linear-gradient(135deg, ${mode.color}, ${mode.color}aa)`, boxShadow: `0 10px 30px -8px ${mode.color}` }
              : undefined
          }
        >
          <RotateCcw size={20} strokeWidth={3} />
          ЕЩЁ РАЗ
        </button>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onUpgrades}
            className="btn btn-ghost flex h-13 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black tracking-[0.12em] text-amber-200"
          >
            <Wrench size={15} strokeWidth={2.4} />
            УЛУЧШЕНИЯ
          </button>
          <button
            type="button"
            onClick={onModes}
            className="btn btn-ghost flex h-13 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black tracking-[0.12em] text-slate-200"
          >
            <Layers size={15} strokeWidth={2.4} />
            РЕЖИМЫ
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="btn btn-ghost flex h-13 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black tracking-[0.12em] text-slate-200"
          >
            <Home size={15} strokeWidth={2.4} />
            МЕНЮ
          </button>
        </div>
        <div className="num mt-2.5 text-center text-[9px] font-bold tracking-[0.16em] text-slate-500">
          ВСЕГО МОНЕТ {save.coins}
        </div>
      </div>
    </div>
  );
}
