import { ArrowUpRight, Crosshair, Info, Layers, Play, Rocket, Trophy, Volume2, VolumeX, Wrench } from 'lucide-react';
import type { GameMode, SaveData } from '../game/types';
import { MODE_MAP } from '../game/modes';
import { BUILD_VERSION, resolveShip, starOf, starRank } from '../game/content';
import { contractsFor, operationsFor } from '../game/frontier';
import { todayKey } from '../game/dailyRun';
import { CoinChip } from './bits';
import { ShipPreview } from './ShipPreview';
import { selectedWorld } from '../game/exploration';

export function Menu({ save, lastMode, startCp, onPlay, onOpen, onToggleMute }: {
  save: SaveData; lastMode: GameMode; startCp: number;
  onPlay: (mode: GameMode, cp: number) => void;
  onOpen: (s: 'upgrades' | 'ships' | 'achievements' | 'modes' | 'info' | 'operations' | 'orbits') => void;
  onToggleMute: () => void;
}) {
  const mode = MODE_MAP[lastMode];
  const ship = resolveShip(save, save.ship);
  const world = selectedWorld(save);
  const ops = operationsFor(save, todayKey());
  const contracts = contractsFor(todayKey());
  const ready = contracts.filter(c => ops.progress[c.metric] >= c.goal && !ops.claimed.includes(c.id)).length;
  return (
    <div className="command-screen absolute inset-0 z-20 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
      <header className="command-header safe-top">
        <div className="command-brand">NS<span> / </span>КОМАНДОВАНИЕ</div>
        <div className="flex items-center gap-2">
          <CoinChip value={save.coins} />
          <button type="button" onClick={onToggleMute} className="icon-control" aria-label="Звук">
            {save.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button type="button" onClick={() => onOpen('info')} className="icon-control" aria-label="Что нового"><Info size={18} /></button>
        </div>
      </header>
      <main className="command-main">
        <div className="command-title"><span>НЕИЗВЕСТНЫЕ ОРБИТЫ</span><h1>NOVA<span>STRIKE</span></h1><p>За пределами известного.</p></div>
        <button type="button" className="hangar-display" onClick={() => onOpen('ships')} aria-label="Выбрать корабль">
          <div className="orbital-ring" /><div className="orbital-ring inner" />
          <span className="hangar-coordinate">{world?.name.toUpperCase() ?? 'ОРБИТА 077'}<br />{world?.title.toUpperCase() ?? 'СИСТЕМЫ В НОРМЕ'}</span>
          <ShipPreview ship={save.ship} />
          <div className="hangar-caption"><div><small>АКТИВНЫЙ КОРПУС</small><strong style={{ color: ship.accent }}>{ship.name}</strong></div><span>{starRank(starOf(save, save.ship)).name}<ArrowUpRight size={16} /></span></div>
        </button>
        <div className="command-stats">
          <div><strong>{save.best.toLocaleString('ru-RU')}</strong><span>ЛИЧНЫЙ РЕКОРД</span></div>
          <div><strong>{save.stats.runs}</strong><span>ВЫЛЕТОВ</span></div>
          <div><strong>{ops.bestCombo}</strong><span>ЛУЧШАЯ СЕРИЯ</span></div>
        </div>
        <button type="button" onClick={() => onOpen('operations')} className="contract-shortcut">
          <Crosshair size={22} /><div><strong>Контракты Фронтира</strong><span>{ready ? `${ready} наград к получению` : `${ops.claimed.length} / 3 выполнено · новые задания каждый день`}</span></div><ArrowUpRight size={18} />
        </button>
        <div className="launch-section">
          <button type="button" onClick={() => onOpen('orbits')} className="mode-selector"><span>{world ? `${world.name} · ${world.title}` : 'Орбита 077 · Домашний сектор'}</span><ArrowUpRight size={15} /></button>
          <button type="button" onClick={() => onPlay(lastMode, startCp)} className="launch-button"><span>НАЧАТЬ ВЫЛЕТ</span><Play size={20} fill="currentColor" /></button>
          <button type="button" onClick={() => onOpen('modes')} className="mode-selector"><Layers size={15} /><span>{mode.name}{startCp > 0 && mode.allowCheckpoints ? ` · ${startCp.toLocaleString('ru-RU')}` : ''}</span><ArrowUpRight size={15} /></button>
        </div>
        <nav className="command-nav">
          {([{ id: 'upgrades', label: 'Ангар', Icon: Wrench }, { id: 'ships', label: 'Флот', Icon: Rocket }, { id: 'achievements', label: 'Карьера', Icon: Trophy }] as const).map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => onOpen(id)}><Icon size={19} /><span>{label}</span></button>)}
        </nav>
        <footer className="command-footer safe-bottom"><span>ТЯНИ ПАЛЬЦЕМ · СТРЕЛЬБА АВТОМАТИЧЕСКАЯ</span><span>v{BUILD_VERSION}</span></footer>
      </main>
    </div>
  );
}
