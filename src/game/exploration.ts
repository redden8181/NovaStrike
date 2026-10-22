import type { BaseShipId, SaveData, ShipId } from './types';
import { FUSION_COST, MAX_STAR, SHIPS, fusionId, isFullyUpgraded, resolveShip, starOf, starUpCost } from './content';

export const HOME_ORBIT = '077';
export const MODULE_COST = 4000;
export const WORLDS = [
  { ship: 'falcon', id: '112', name: 'Орбита 112', title: 'Вечная мерзлота', module: 'Термоконтур', hint: 'Защита корпуса от экстремального охлаждения.', artifact: 'Криокристалл', color: '#7dd3fc', detail: 'Холодные фронты замедляют манёвры. Термоконтур сохраняет 85% тяги.', effect: 'cold' },
  { ship: 'comet', id: '204', name: 'Орбита 204', title: 'Солнечный ветер', module: 'Парус импульса', hint: 'Стабилизация тяги в потоках звёздного ветра.', artifact: 'Солнечный осколок', color: '#fbbf24', detail: 'Порывы ветра сносят корабль. Парус усиливает манёвренность на 20%.', effect: 'wind' },
  { ship: 'titan', id: '309', name: 'Орбита 309', title: 'Железное кольцо', module: 'Ударный каркас', hint: 'Укрепление корпуса для плотных потоков обломков.', artifact: 'Ферритовое ядро', color: '#fb923c', detail: 'Врагов на 25% больше. Каркас добавляет 10% брони.', effect: 'debris' },
  { ship: 'nova', id: '418', name: 'Орбита 418', title: 'Ионная буря', module: 'Грозовой накопитель', hint: 'Улавливание энергии нестабильных электрических полей.', artifact: 'Ионная призма', color: '#6ee7b7', detail: 'Ионные всплески ускоряют вражеские снаряды. Накопитель даёт +20% темпа огня.', effect: 'storm' },
  { ship: 'voidx', id: '509', name: 'Орбита 509', title: 'Горизонт бездны', module: 'Гравитационный якорь', hint: 'Удержание курса рядом с гравитационными аномалиями.', artifact: 'Тёмная материя', color: '#c4b5fd', detail: 'Гравитационный узел тянет к центру. Якорь расширяет сбор артефактов и монет.', effect: 'gravity' },
] as const;
export type World = typeof WORLDS[number];
export function parentsOf(save: SaveData, ship: ShipId): BaseShipId[] {
  return resolveShip(save, ship).fusedFrom ?? [ship as BaseShipId];
}
export function explorationOf(save: SaveData): NonNullable<SaveData['exploration']> {
  return save.exploration ?? { modules: [], blueprints: [], artifacts: {}, orbit: HOME_ORBIT };
}
export function hasBlueprint(save: SaveData, id: BaseShipId) {
  return explorationOf(save).blueprints.includes(id) || (save.shipsOwned.includes(id) && starOf(save, id) === MAX_STAR && isFullyUpgraded(save, id));
}
export function normalizeExploration(save: SaveData): SaveData {
  const ex = explorationOf(save);
  const legacyParents = (save.fusions ?? []).flatMap(f => [f.a, f.b]);
  const blueprints = SHIPS.map(s => s.id as BaseShipId).filter(id => ex.blueprints.includes(id) || hasBlueprint(save, id) || legacyParents.includes(id));
  const modules = [...new Set([...ex.modules, ...legacyParents])];
  if (save.exploration && blueprints.length === ex.blueprints.length && modules.length === ex.modules.length) return save;
  return { ...save, exploration: { ...ex, blueprints, modules } };
}
export function availableWorlds(save: SaveData, ship = save.ship): World[] {
  const parents = parentsOf(save, ship);
  return WORLDS.filter(w => parents.includes(w.ship) && explorationOf(save).modules.includes(w.ship));
}
export function selectedWorld(save: SaveData): World | undefined {
  return availableWorlds(save).find(w => w.id === explorationOf(save).orbit);
}
export function installModule(save: SaveData, id: BaseShipId): SaveData {
  const ex = explorationOf(save);
  if (!save.shipsOwned.includes(id) || starOf(save, id) < 3 || ex.modules.includes(id) || save.coins < MODULE_COST) return save;
  return { ...save, coins: save.coins - MODULE_COST, exploration: { ...ex, modules: [...ex.modules, id] } };
}
export function starArtifacts(save: SaveData, ship = save.ship) {
  const star = starOf(save, ship);
  return star < 3 ? [] : parentsOf(save, ship).map(id => ({ id, count: star === 3 ? 12 : 30, world: WORLDS.find(w => w.ship === id)! }));
}
export function canPromote(save: SaveData) {
  return starOf(save, save.ship) < MAX_STAR && isFullyUpgraded(save, save.ship) && save.coins >= starUpCost(starOf(save, save.ship)) && starArtifacts(save).every(r => (explorationOf(save).artifacts[r.id] ?? 0) >= r.count);
}
export function promoteShip(save: SaveData): SaveData {
  if (!canPromote(save)) return save;
  const ex = explorationOf(save); const artifacts = { ...ex.artifacts };
  for (const r of starArtifacts(save)) artifacts[r.id] = (artifacts[r.id] ?? 0) - r.count;
  return normalizeExploration({ ...save, coins: save.coins - starUpCost(starOf(save, save.ship)), shipStars: { ...save.shipStars, [save.ship]: starOf(save, save.ship) + 1 }, exploration: { ...ex, artifacts } });
}
export function awardArtifact(save: SaveData, ship: BaseShipId, count: number): SaveData {
  const ex = explorationOf(save);
  return { ...save, exploration: { ...ex, artifacts: { ...ex.artifacts, [ship]: (ex.artifacts[ship] ?? 0) + count } } };
}
export function createExperimental(save: SaveData, a: BaseShipId, b: BaseShipId): SaveData {
  const id = fusionId(a, b);
  if (a === b || !hasBlueprint(save, a) || !hasBlueprint(save, b) || save.coins < FUSION_COST || save.fusions.some(f => f.id === id)) return save;
  return normalizeExploration({ ...save, coins: save.coins - FUSION_COST, fusions: [...save.fusions, { id, a, b }], ship: id });
}
