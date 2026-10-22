import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export * from './src/game/exploration'; export * from './src/game/content'; export * from './src/game/storage';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { defaultSave, installModule, availableWorlds, awardArtifact, starArtifacts, promoteShip, hasBlueprint, normalizeExploration, createExperimental, maxUpgradesFor, SHIP_MAP, loadSave, selectedWorld } = api;
function ranked(id, star) { const s = defaultSave(); s.ship = id; s.shipsOwned.push(id); s.coins = 500000; s.shipStars[id] = star; s.shipUpgrades[id] = maxUpgradesFor(SHIP_MAP[id], star); return s; }
test('module cannot open early or for an unowned ship, unlocks at three stars once', () => {
  const early = ranked('falcon', 2); assert.equal(installModule(early, 'falcon'), early);
  const s = ranked('falcon', 3); assert.equal(installModule(s, 'comet'), s);
  const installed = installModule(s, 'falcon'); assert.equal(installed.coins, s.coins - 4000);
  assert.equal(availableWorlds(installed)[0].id, '112'); assert.equal(installModule(installed, 'falcon'), installed);
});
test('later stars require both coins and local artifacts and deduct resources exactly', () => {
  let s = ranked('falcon', 3); assert.equal(promoteShip(s), s);
  s = awardArtifact(s, 'falcon', 12); const requirements = starArtifacts(s); assert.equal(requirements[0].count, 12);
  const next = promoteShip(s); assert.equal(next.shipStars.falcon, 4); assert.equal(next.exploration.artifacts.falcon, 0); assert.equal(next.coins, s.coins - 32000);
  const poor = { ...s, coins: 0 }; assert.equal(promoteShip(poor), poor);
});
test('blueprints require full legendary development and are permanent', () => {
  const s = ranked('falcon', 4); assert.equal(hasBlueprint(s, 'falcon'), false);
  const legend = ranked('falcon', 5); legend.shipUpgrades.falcon.power = 0; assert.equal(hasBlueprint(legend, 'falcon'), false);
  legend.shipUpgrades.falcon = maxUpgradesFor(SHIP_MAP.falcon, 5);
  const earned = normalizeExploration(legend); assert.equal(hasBlueprint(earned, 'falcon'), true);
  earned.shipUpgrades.falcon.power = 0; assert.equal(hasBlueprint(earned, 'falcon'), true);
});
test('constructor keeps parents and blueprints, rejects duplicates and grants two orbits', () => {
  let s = ranked('falcon', 5); s.shipsOwned.push('titan'); s.shipStars.titan = 5; s.shipUpgrades.titan = maxUpgradesFor(SHIP_MAP.titan, 5); s = normalizeExploration(s);
  const before = structuredClone(s); const created = createExperimental(s, 'falcon', 'titan');
  assert.equal(created.fusions.length, 1); assert.deepEqual(created.shipsOwned, before.shipsOwned); assert.deepEqual(created.shipUpgrades, before.shipUpgrades);
  assert.deepEqual(created.exploration.blueprints, before.exploration.blueprints); assert.equal(availableWorlds(created).length, 2);
  assert.equal(createExperimental(created, 'falcon', 'titan'), created); assert.equal(createExperimental(s, 'falcon', 'falcon'), s); assert.equal(createExperimental(defaultSave(), 'falcon', 'titan').fusions.length, 0);
  assert.equal(starArtifacts({ ...created, shipStars: { ...created.shipStars, [created.ship]: 3 } }).length, 2);
});
test('legacy migration clears journal, retains hybrids and grants inherited technology', () => {
  const s = defaultSave(); s.v = 10; s.ship = 'fused:falcon+titan'; s.fusions = [{ id: s.ship, a: 'falcon', b: 'titan' }]; s.operations.flights = [{ score: 900 }];
  globalThis.localStorage = { getItem: () => JSON.stringify(s), setItem() {} };
  const migrated = loadSave(); assert.deepEqual(migrated.operations.flights, []); assert.equal(migrated.ship, s.ship); assert.equal(availableWorlds(migrated).length, 2); assert.equal(hasBlueprint(migrated, 'falcon'), true);
});
test('world selection cannot bypass ship compatibility', () => {
  let s = installModule(ranked('falcon', 3), 'falcon'); s.exploration.orbit = '112'; assert.equal(selectedWorld(s).id, '112');
  s.ship = 'comet'; assert.equal(selectedWorld(s), undefined);
});
