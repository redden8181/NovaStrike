import { useState } from 'react';
import { Download } from 'lucide-react';
import type { SaveData } from '../game/types';
import { contractsFor, operationsFor } from '../game/frontier';
import { todayKey } from '../game/dailyRun';
import { CoinChip, ProgressBar, ScreenHeader } from './bits';
export function Operations({ save, onBack, onClaim }: { save: SaveData; onBack: () => void; onClaim: (id: string) => void }) {
  const [exported, setExported] = useState(false);
  const date = todayKey(); const ops = operationsFor(save, date);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `novastrike-save-${date}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000); setExported(true);
  };
  return <div className="workshop-screen"><div className="safe-top"><ScreenHeader title="Контракты" sub="Новые задания каждый день" onBack={onBack} right={<CoinChip value={save.coins} />} /></div><div className="workshop-scroll"><p className="mb-5 text-sm leading-relaxed text-slate-400">Прогресс складывается из завершённых вылетов, кроме ежедневного события. Обновление в полночь по времени устройства.</p>{contractsFor(date).map(c => {
    const progress = Math.min(c.goal, ops.progress[c.metric]); const claimed = ops.claimed.includes(c.id);
    return <article className="workshop-panel" key={c.id}><h2 className="text-lg font-bold">{c.title}</h2><p className="my-3 text-sm text-slate-300">{progress} / {c.goal} {c.unit}</p><ProgressBar k={progress / c.goal} color="#fb923c" /><button type="button" disabled={claimed || progress < c.goal} onClick={() => onClaim(c.id)} className="workshop-primary mt-4">{claimed ? 'Награда получена' : progress >= c.goal ? `Забрать ${c.reward} монет` : `Награда: ${c.reward} монет`}</button></article>;
  })}<button type="button" onClick={download} className="workshop-secondary mt-6"><Download size={16} />Скачать сохранение</button>{exported && <p role="status" className="mt-3 text-center text-sm text-emerald-300">Файл сохранения подготовлен</p>}</div></div>;
}
