import { Wrench } from 'lucide-react';
import type { BaseShipId, SaveData, ShipId } from '../game/types';
import { allShips, starOf, starRank, TEST_MODE } from '../game/content';
import { hasBlueprint } from '../game/exploration';
import { ShipPreview } from './ShipPreview';
import { ShipStats } from './ShipStats';
import { CoinChip, ScreenHeader } from './bits';
export function Ships({ save, onBack, onSelect, onBuy, onConstructor, onUnfuse }: {
  save: SaveData; onBack: () => void; onSelect: (id: ShipId) => void; onBuy: (id: ShipId) => void;
  onConstructor: () => void; onUnfuse: (id: ShipId) => void;
}) {
  return <div className="workshop-screen"><div className="safe-top"><ScreenHeader title="Флот" sub="Выбери свой корабль" onBack={onBack} right={<CoinChip value={save.coins} />} /></div><div className="workshop-scroll">
    <button type="button" className="constructor-entry" onClick={onConstructor}><Wrench size={25} /><span><strong>Конструктор</strong><small>Два чертежа. Новый экспериментальный корабль.</small></span></button>
    {allShips(save).map(ship => {
      const owned = save.shipsOwned.includes(ship.id) || !!ship.fusedFrom;
      const locked = !TEST_MODE && (Math.max(0, ...save.checkpoints) < ship.requires || (!!ship.requiresUnlock && !save.unlocks.includes(ship.requiresUnlock)));
      const active = save.ship === ship.id;
      return <article key={ship.id} className="workshop-panel" style={{ borderColor: active ? ship.accent : undefined }}><div className="flex justify-between gap-3"><h2 className="text-lg font-black" style={{ color: ship.accent }}>{ship.name}</h2><span className="text-xs text-slate-300">{starRank(starOf(save, ship.id)).name}</span></div><p className="mt-2 text-xs leading-relaxed text-slate-400">{ship.desc}</p><ShipPreview ship={ship.id} /><ShipStats save={save} ship={ship} />
        {!ship.fusedFrom && hasBlueprint(save, ship.id as BaseShipId) && <p className="mt-4 text-sm text-emerald-300">Чертёж получен</p>}
        <button type="button" className="workshop-primary mt-4" disabled={active || (!owned && (locked || (!TEST_MODE && save.coins < ship.cost)))} onClick={() => owned ? onSelect(ship.id) : onBuy(ship.id)}>{active ? 'Выбран' : owned ? 'Выбрать корабль' : locked ? `Нужна ${ship.requiresUnlock ? 'разблокировка в карьере' : `веха ${ship.requires}`}` : `Купить · ${ship.cost.toLocaleString('ru-RU')} монет`}</button>
        {ship.fusedFrom && <button type="button" className="workshop-secondary mt-2" onClick={() => { if (window.confirm('Разобрать экспериментальный корабль? Его прокачка будет потеряна. Чертежи и исходные корабли сохранятся.')) onUnfuse(ship.id); }}>Разобрать корабль</button>}
      </article>;
    })}</div></div>;
}
