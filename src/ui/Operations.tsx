import { useState } from 'react';
import { Check, Download, Target } from 'lucide-react';
import type { SaveData } from '../game/types';
import { contractsFor, operationsFor, SECTORS } from '../game/frontier';
import { todayKey } from '../game/dailyRun';
import { MODE_MAP } from '../game/modes';
import { resolveShip } from '../game/content';
import { CoinChip, fmtTime, ProgressBar, ScreenHeader } from './bits';

export function Operations({ save, onBack, onClaim }: { save: SaveData; onBack: () => void; onClaim: (id: string) => void }) {
  const [tab, setTab] = useState<'contracts' | 'flights'>('contracts');
  const [exported, setExported] = useState(false);
  const date = todayKey();
  const ops = operationsFor(save, date);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `novastrike-save-${date}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setExported(true);
  };
  return <div className="absolute inset-0 z-30 flex flex-col bg-[#080d16]/95 backdrop-blur-md">
    <div className="safe-top"><ScreenHeader title="ОПЕРАЦИИ" sub="ФРОНТИР / КОМАНДНЫЙ ЦЕНТР" onBack={onBack} right={<CoinChip value={save.coins} />} /></div>
    <div className="mx-4 mt-5 grid grid-cols-2 gap-2" role="tablist" aria-label="Операции">
      {([{ id: 'contracts', name: 'Контракты' }, { id: 'flights', name: 'Журнал вылетов' }] as const).map(t => <button type="button" role="tab" aria-selected={tab === t.id} key={t.id} onClick={() => setTab(t.id)} className={`operation-tab ${tab === t.id ? 'selected' : ''}`}>{t.name}</button>)}
    </div>
    <div className="flex-1 overflow-y-auto px-4 pt-5 pb-8" style={{ touchAction: 'pan-y' }}>
      {tab === 'contracts' ? <>
        <p className="mb-5 text-xs leading-relaxed text-slate-400">Контракты на {date}. Прогресс складывается из завершённых вылетов во всех режимах, кроме ежедневного события. Обновление в полночь по времени устройства.</p>
        <div className="flex flex-col gap-3">{contractsFor(date).map(c => {
          const progress = Math.min(c.goal, ops.progress[c.metric]);
          const claimed = ops.claimed.includes(c.id);
          return <article className="operation-card" key={c.id}>
            <div className="flex items-center justify-between gap-3"><Target size={18} className="text-orange-300" /><span className="num text-[10px] text-slate-500">ЗАДАНИЕ / 0{contractsFor(date).indexOf(c) + 1}</span></div>
            <h2 className="mt-3 text-lg font-bold">{c.title}</h2>
            <p className="mt-1 text-xs text-slate-400">{c.goal} {c.unit} · суммарно за день</p>
            <div className="my-4"><ProgressBar k={progress / c.goal} color="#fb923c" /><p className="num mt-2 text-xs text-slate-400">{progress} / {c.goal}</p></div>
            <button type="button" disabled={claimed || progress < c.goal} onClick={() => onClaim(c.id)} className="contract-claim">{claimed ? <><Check size={16} />Награда получена</> : progress >= c.goal ? `Забрать ${c.reward} монет` : `Награда: ${c.reward} монет`}</button>
          </article>;
        })}</div>
        <h2 className="mt-7 mb-3 text-xs font-bold tracking-widest text-slate-300">РАЗВЕДДАННЫЕ: СЕКТОРЫ</h2>
        <p className="mb-3 text-xs text-slate-400">Смена каждые 45 секунд. Очки сектора и серии перемножаются только за уничтожение обычных врагов.</p>
        {SECTORS.map((s, i) => <div key={s.name} className="flex gap-3 border-t border-white/10 py-3"><span className="num text-xs" style={{ color: s.color }}>0{i + 1}</span><div><strong className="text-sm" style={{ color: s.color }}>{s.name}</strong><p className="mt-1 text-xs text-slate-400">{s.detail}</p></div></div>)}
        <p className="mt-4 text-xs leading-relaxed text-slate-400">Серия: уничтожай цели с интервалом до 6 секунд. Каждые 5 целей дают +25% очков, максимум ×2. Получение урона обрывает серию.</p>
      </> : <>
        <div className="mb-5 flex items-center justify-between"><span className="text-xs text-slate-400">Последние 12 завершённых вылетов</span><span className="num text-xs text-orange-300">СЕРИЯ {ops.bestCombo}</span></div>
        {!ops.flights.length && <div className="operation-card text-sm leading-relaxed text-slate-400">Журнал пока пуст. Заверши первый вылет — здесь появятся корабль, счёт и боевая статистика.</div>}
        {ops.flights.map((f, i) => <article key={`${f.date}-${i}`} className="operation-card mb-3"><div className="flex justify-between gap-3"><strong className="text-sm">{MODE_MAP[f.mode].name}</strong><span className="num text-orange-300">{f.score.toLocaleString('ru-RU')}</span></div><p className="mt-1 text-xs text-slate-400">{resolveShip(save, f.ship as SaveData['ship']).name} · {new Date(f.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p><div className="num mt-3 text-[11px] text-slate-300">{fmtTime(f.time)} · {f.kills} целей · +{f.coins} монет · серия {f.combo}</div></article>)}
      </>}
      <button type="button" onClick={download} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-xs text-slate-300"><Download size={16} />Скачать сохранение</button>
      {exported && <p role="status" className="mt-2 text-center text-xs text-emerald-300">Файл сохранения подготовлен</p>}
    </div>
  </div>;
}
