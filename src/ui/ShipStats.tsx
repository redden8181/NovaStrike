import type { SaveData } from '../game/types';
import { abilityOf, DAMAGE, emptyUpgrades, shipUpgradesOf, starOf, starRank, TECHS, type ShipDef } from '../game/content';
export function ShipStats({ save, ship, fresh = false }: { save: SaveData; ship: ShipDef; fresh?: boolean }) {
  const up = fresh ? emptyUpgrades() : shipUpgradesOf(save, ship.id);
  const sm = fresh ? 1 : starRank(starOf(save, ship.id)).statMul;
  const damage = ship.mods.damage * sm * (1 + .18 * up.power);
  const rate = 4.1 * ship.mods.rate * sm * (1 + .22 * up.rate);
  const guns = 1 + ship.mods.streams + up.streams;
  const turrets = up.turretL + up.turretR;
  const ability = abilityOf(ship);
  const rows = [
    ['Прочность', `${Math.round(ship.mods.hp * sm + 25 * up.hull)} HP`],
    ['Броня', `${Math.min(DAMAGE.armorCap, Math.round(ship.mods.armor * sm) + 4 * up.armor)}%`],
    ['Урон снаряда', damage.toFixed(2)], ['Скорострельность', `${rate.toFixed(1)} / с`],
    ['Стволы', `${guns}`], ['Манёвренность', `×${(ship.mods.speed * sm).toFixed(2)}`],
    ['Турели', `${turrets}`], ['Общий урон / с', (damage * rate * guns + turrets * damage * (.34 + .2 * up.turretPower) * 1.6 * (1 + .2 * up.turretRate) * (1 + up.turretStreams)).toFixed(1)],
    ['Длительность щита', `${(7 + 1.5 * up.shield).toFixed(1)} с`],
    ['Радиус магнита', `${Math.round(62 * (1 + .5 * up.magnet))}`],
    ['Уровень техники', `${up.tech}`],
  ];
  return <><dl className="ship-stat-list">{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><div className="mt-4 border-t border-white/10 pt-3"><h3 className="text-sm font-bold" style={{ color: ability.color }}>{ability.name}</h3><p className="mt-1 text-xs leading-relaxed text-slate-300">{ability.desc}</p><p className="mt-1 text-xs text-slate-400">Длительность {ability.duration.toFixed(1)} с · перезарядка {ability.cooldown} с</p><p className="mt-2 text-xs text-slate-300">Техника: {TECHS[ship.tech].name} · {TECHS[ship.tech].desc}</p>{ship.voidDrive && <p className="mt-2 text-xs text-violet-300">Двигатель бездны: урон растёт, пока корабль не получает повреждений.</p>}</div></>;
}
