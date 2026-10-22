import { useState } from 'react';
import { FileText, Lock, Plus } from 'lucide-react';
import type { BaseShipId, SaveData } from '../game/types';
import { buildFusion, FUSION_COST, fusionId, SHIPS } from '../game/content';
import { hasBlueprint, WORLDS } from '../game/exploration';
import { CoinChip, ScreenHeader } from './bits';
import { ShipPreview } from './ShipPreview';
import { ShipStats } from './ShipStats';
export function Constructor({ save, onBack, onCreate }: { save: SaveData; onBack: () => void; onCreate: (a: BaseShipId, b: BaseShipId) => void }) {
  const [a, setA] = useState<BaseShipId | ''>(''); const [b, setB] = useState<BaseShipId | ''>(''); const [created, setCreated] = useState(false);
  const result = a && b && a !== b ? buildFusion(a, b) : null;
  const exists = !!(a && b && save.fusions.some(f => f.id === fusionId(a, b)));
  const ready = !!(a && b && result && hasBlueprint(save, a) && hasBlueprint(save, b) && !exists && save.coins >= FUSION_COST);
  return <div className="workshop-screen"><div className="safe-top"><ScreenHeader title="Конструктор" sub="Экспериментальные корабли" onBack={onBack} right={<CoinChip value={save.coins} />} /></div><div className="workshop-scroll">
    <p className="mb-5 text-sm leading-relaxed text-slate-300">Освой два корпуса и объедини их технологии. Чертежи постоянные, исходные корабли остаются во флоте.</p>
    <div className="blueprint-slots">{([0, 1] as const).map(slot => <label className="blueprint-slot" key={slot}><FileText size={24} aria-hidden="true" /><span>Чертёж {slot + 1}</span><select aria-label={`Выбрать чертёж ${slot + 1}`} value={slot === 0 ? a : b} onChange={e => { const id = e.target.value as BaseShipId | ''; if (slot === 0) setA(id); else setB(id); setCreated(false); }}><option value="">Выбрать</option>{SHIPS.map(s => <option key={s.id} value={s.id} disabled={!hasBlueprint(save, s.id as BaseShipId) || s.id === (slot === 0 ? b : a)}>{s.name}{!hasBlueprint(save, s.id as BaseShipId) ? ' · закрыт' : ''}</option>)}</select></label>)}<Plus className="blueprint-plus" size={20} aria-hidden="true" /></div>
    {!result ? <div className="blueprint-empty"><FileText size={44} /><h2>Проект ещё не собран</h2><p>Выбери два разных чертежа, чтобы увидеть корабль и все его характеристики.</p></div> : <article className="workshop-panel blueprint-result"><p className="text-xs text-cyan-300">Результат проектирования · начальные характеристики</p><h2 className="mt-2 text-2xl font-black">{result.name}</h2><ShipPreview ship={result.id} /><ShipStats save={save} ship={result} fresh /><h3 className="mt-5 text-sm font-bold">Две родительские орбиты</h3>{WORLDS.filter(w => w.ship === a || w.ship === b).map(w => <p key={w.id} className="mt-2 text-sm" style={{ color: w.color }}>{w.name} · {w.title}</p>)}<button type="button" disabled={!ready} className="workshop-primary mt-5" onClick={() => { if (a && b && ready) { onCreate(a, b); setCreated(true); } }}>{exists ? 'Корабль уже создан' : `Создать корабль · ${FUSION_COST.toLocaleString('ru-RU')} монет`}</button>{!exists && save.coins < FUSION_COST && <p className="mt-2 text-sm text-amber-200">Не хватает {(FUSION_COST - save.coins).toLocaleString('ru-RU')} монет</p>}{created && <p role="status" className="mt-3 text-sm text-emerald-300">Корабль создан и выбран. Чертежи сохранены.</p>}</article>}
    <h2 className="mb-3 mt-6 text-lg font-bold">Библиотека чертежей</h2>{SHIPS.map(s => { const unlocked = hasBlueprint(save, s.id as BaseShipId); return <div className="blueprint-library-row" key={s.id}>{unlocked ? <FileText size={19} /> : <Lock size={19} />}<div><strong>{s.name}</strong><p>{unlocked ? 'Изучен · можно использовать многократно' : 'Полностью прокачай корпус ранга «Легенда»'}</p></div></div>; })}
  </div></div>;
}
