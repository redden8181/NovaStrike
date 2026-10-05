import { Award, Check, Coins, Crown, Flag, Lock } from 'lucide-react';
import type { SaveData } from '../game/types';
import { ACHIEVEMENTS, MILESTONES, RANKS, TRACKS, trackReached, trackValue } from '../game/content';
import { ProgressBar, ScreenHeader, fmtTime } from './bits';
import { cn } from '../utils/cn';

function progressOf(id: string, save: SaveData): number {
  switch (id) {
    case 'kills100':
      return save.stats.kills / 100;
    case 'coins500':
      return save.stats.totalCoins / 500;
    case 'survive300':
      return save.stats.bestTime / 300;
    case 'score10k':
      return save.best / 10000;
    case 'boss1':
      return save.stats.bossKills >= 1 ? 1 : 0;
    case 'synergy':
      return save.stats.synergiesTriggered >= 1 ? 1 : 0;
    case 'bossrush5':
      return save.stats.bossRushBest / 5;
    case 'hardcore10k':
      return save.stats.hardcoreBest / 10000;
    case 'daily':
      return save.daily.runs >= 1 ? 1 : 0;
    default:
      return 0;
  }
}

const fmt = (v: number, kind: 'num' | 'time') => (kind === 'time' ? fmtTime(v) : Math.floor(v).toLocaleString('ru-RU'));

export function Achievements({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const done = save.achievements.length;
  const totalRanks = TRACKS.reduce((acc, t) => acc + trackReached(t, trackValue(t, save)), 0);
  const maxRanks = TRACKS.length * RANKS.length;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/85 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader
          title="ПРОГРЕСС"
          sub={`РАНГОВ ${totalRanks}/${maxRanks} · МЕДАЛЕЙ ${done}/${ACHIEVEMENTS.length}`}
          onBack={onBack}
          right={
            <div className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <Crown size={14} className="text-amber-300" strokeWidth={2.4} />
              <span className="num text-sm font-bold text-amber-200">{totalRanks}</span>
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        {/* ── ранговые награды: одна ячейка на тип, растёт по рангам ── */}
        <div className="mb-2 px-1 text-[9px] font-black tracking-[0.3em] text-cyan-300/80">РАНГОВЫЕ НАГРАДЫ</div>
        <div className="flex flex-col gap-2">
          {TRACKS.map((t, idx) => {
            const value = trackValue(t, save);
            const reached = trackReached(t, value);
            const maxed = reached >= t.steps.length;
            const rank = reached > 0 ? RANKS[Math.min(RANKS.length - 1, reached - 1)] : null;
            const color = rank?.color ?? '#475569';
            const nextStep = maxed ? t.steps[t.steps.length - 1] : t.steps[reached];
            const prevStep = reached > 0 ? t.steps[reached - 1] : 0;
            const k = maxed ? 1 : Math.max(0, (value - prevStep) / Math.max(1, nextStep - prevStep));
            const nextCoins = maxed ? 0 : (t.coins[reached] ?? 0);

            return (
              <div
                key={t.id}
                className="glass pop-in rounded-2xl p-3"
                style={{
                  animationDelay: `${idx * 0.04}s`,
                  borderColor: reached ? `${color}66` : undefined,
                  boxShadow: reached ? `0 0 18px ${color}22` : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* сама «ячейка» — цвет = текущий ранг */}
                  <div
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      background: reached
                        ? `linear-gradient(145deg, ${color}44, ${color}11)`
                        : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${reached ? color : 'rgba(148,180,255,0.18)'}`,
                      boxShadow: reached ? `0 0 16px ${color}55` : undefined,
                    }}
                  >
                    {reached ? (
                      <>
                        <Crown size={17} style={{ color }} strokeWidth={2.6} />
                        <span
                          className="num absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black"
                          style={{ background: color, color: '#05070f' }}
                        >
                          {reached}
                        </span>
                      </>
                    ) : (
                      <Lock size={16} className="text-slate-600" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11.5px] font-extrabold tracking-[0.1em] text-slate-100">{t.name}</span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-px text-[8px] font-black tracking-[0.12em]"
                        style={{ background: `${color}26`, color: reached ? color : '#64748b' }}
                      >
                        {maxed ? 'МАКСИМУМ' : (rank?.name ?? 'НЕТ РАНГА')}
                      </span>
                    </div>
                    <div className="text-[9.5px] font-medium text-slate-400">{t.sub}</div>

                    {/* шкала рангов — 8 пунктов */}
                    <div className="mt-1.5 flex gap-1">
                      {t.steps.map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-all"
                          style={{
                            background: i < reached ? RANKS[i].color : 'rgba(255,255,255,0.1)',
                            boxShadow: i < reached ? `0 0 6px ${RANKS[i].color}` : undefined,
                          }}
                        />
                      ))}
                    </div>

                    <div className="num mt-1 flex items-center justify-between text-[9px] font-bold text-slate-500">
                      <span style={{ color: reached ? color : undefined }}>{fmt(value, t.format)}</span>
                      {maxed ? (
                        <span className="text-emerald-300">ВСЁ СОБРАНО</span>
                      ) : (
                        <span>
                          ДО {RANKS[reached].name}: {fmt(nextStep, t.format)}
                          {nextCoins > 0 && <span className="text-amber-300/80"> · +{nextCoins}</span>}
                        </span>
                      )}
                    </div>
                    {!maxed && <ProgressBar k={k} color={color === '#475569' ? '#22d3ee' : color} className="mt-1" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── что открывает трек очков ── */}
        <div className="mt-5 mb-2 px-1 text-[9px] font-black tracking-[0.3em] text-violet-300/80">ЧТО ОТКРЫВАЮТ ОЧКИ</div>
        <div className="flex flex-col gap-1.5">
          {MILESTONES.map((m) => {
            const reached = save.checkpoints.includes(m.score);
            return (
              <div
                key={m.score}
                className={cn('glass flex items-center gap-2.5 rounded-xl px-3 py-2', !reached && 'opacity-60')}
                style={{ borderColor: reached ? `${m.color}44` : undefined }}
              >
                <Flag size={13} style={{ color: reached ? m.color : '#64748b' }} strokeWidth={2.6} />
                <span className="num w-16 shrink-0 text-[10px] font-bold" style={{ color: reached ? m.color : '#94a3b8' }}>
                  {m.score.toLocaleString('ru-RU')}
                </span>
                <span className="flex-1 truncate text-[10px] font-semibold text-slate-400">{m.detail}</span>
                <span className="num shrink-0 text-[9px] font-bold text-amber-300/80">+{m.coins}</span>
              </div>
            );
          })}
        </div>

        {/* ── медали ── */}
        <div className="mt-5 mb-2 px-1 text-[9px] font-black tracking-[0.3em] text-amber-300/80">МЕДАЛИ</div>
        <div className="flex flex-col gap-2.5">
          {ACHIEVEMENTS.map((a, idx) => {
            const unlocked = save.achievements.includes(a.id);
            const k = progressOf(a.id, save);
            return (
              <div
                key={a.id}
                className={cn('glass pop-in flex items-center gap-3 rounded-2xl p-3.5', !unlocked && 'opacity-70')}
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                    unlocked ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-slate-500',
                  )}
                  style={unlocked ? { boxShadow: '0 0 16px rgba(251,191,36,0.35)' } : undefined}
                >
                  {unlocked ? <Check size={20} strokeWidth={2.8} /> : <Award size={20} strokeWidth={2.2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className={cn('text-[12px] font-extrabold tracking-[0.1em]', unlocked ? 'text-amber-200' : 'text-slate-200')}>
                      {a.name}
                    </div>
                    <div className="num flex items-center gap-1 text-[10px] font-bold text-amber-300/80">
                      <Coins size={11} strokeWidth={2.6} />+{a.reward}
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">{a.desc}</div>
                  {!unlocked && k > 0 && <ProgressBar k={k} color="#fbbf24" className="mt-1.5" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── карьера ── */}
        <div className="mt-5 mb-2 px-1 text-[9px] font-black tracking-[0.3em] text-slate-400">КАРЬЕРА</div>
        <div className="glass grid grid-cols-3 gap-y-3 rounded-2xl p-3.5">
          {[
            ['ЗАБЕГИ', save.stats.runs],
            ['УБИТО', save.stats.kills],
            ['БОССЫ', save.stats.bossKills],
            ['СИНЕРГИИ', save.stats.synergiesTriggered],
            ['СПОСОБНОСТИ', save.stats.abilitiesUsed],
            ['РУШ-РЕКОРД', save.stats.bossRushBest],
          ].map(([label, value]) => (
            <div key={label as string} className="text-center">
              <div className="num text-base leading-none font-extrabold text-cyan-100">{value as number}</div>
              <div className="mt-1 text-[8px] font-bold tracking-[0.14em] text-slate-500">{label as string}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
