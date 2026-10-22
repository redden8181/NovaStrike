import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { CombatChain, sectorAt, SECTORS, contractsFor, claimContract, recordFlight, operationsFor } from '../src/game/frontier.ts';

const bundle = await build({ entryPoints: ['src/game/storage.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { defaultSave, loadSave, SAVE_VERSION } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const date = '2026-10-22';
const flight = { date: date + 'T12:00:00Z', mode: 'classic', ship: 'falcon', score: 5000, kills: 100, time: 500, coins: 100, combo: 23 };

test('combo tiers, expiry, damage reset and per-run best', () => {
  const chain = new CombatChain();
  for (let i = 0; i < 5; i++) chain.kill();
  assert.equal(chain.multiplier, 1.25);
  chain.tick(5.9); assert.equal(chain.count, 5);
  chain.tick(0.2); assert.equal(chain.count, 0);
  for (let i = 0; i < 40; i++) chain.kill();
  assert.equal(chain.multiplier, 2);
  chain.break(); assert.equal(chain.count, 0); assert.equal(chain.best, 40);
});
test('sector transitions wrap precisely every 45 seconds', () => {
  assert.equal(sectorAt(44.999), SECTORS[0]);
  assert.equal(sectorAt(45), SECTORS[1]);
  assert.equal(sectorAt(90), SECTORS[2]);
  assert.equal(sectorAt(135), SECTORS[3]);
  assert.equal(sectorAt(180), SECTORS[0]);
});
test('rewards require completion and can only be claimed once', () => {
  const initial = defaultSave();
  assert.equal(claimContract(initial, date, 'kills'), initial);
  const earned = recordFlight(initial, date, flight, 1);
  const claimed = claimContract(earned, date, 'kills');
  assert.equal(claimed.coins, contractsFor(date)[0].reward);
  assert.equal(claimContract(claimed, date, 'kills'), claimed);
  assert.equal(claimContract(claimed, date, 'unknown'), claimed);
  assert.equal(earned.coins, 0);
});
test('day rollover clears contracts and preserves best series without a journal', () => {
  const earned = claimContract(recordFlight(defaultSave(), date, flight, 1), date, 'kills');
  const next = operationsFor(earned, '2026-10-23');
  assert.deepEqual(next.progress, { kills: 0, time: 0, bosses: 0 });
  assert.deepEqual(next.claimed, []); assert.equal(next.flights.length, 0); assert.equal(next.bestCombo, 23);
});
test('daily mode cannot farm contracts or career combo', () => {
  const save = recordFlight(defaultSave(), date, { ...flight, mode: 'daily' }, 9);
  assert.deepEqual(save.operations.progress, { kills: 0, time: 0, bosses: 0 });
  assert.equal(save.operations.bestCombo, 0); assert.equal(save.operations.flights.length, 0);
});
test('completed flights update totals without retaining flight records', () => {
  let save = defaultSave();
  for (let i = 0; i < 15; i++) save = recordFlight(save, date, { ...flight, score: i }, 0);
  assert.equal(save.operations.flights.length, 0);
  assert.equal(save.operations.progress.kills, 1500);
});
test('v9 migration preserves currency, fleet, selected hybrid and all upgrades', () => {
  const old = { ...defaultSave(), v: 9, coins: 9832, best: 67891, ship: 'fused:falcon+titan', fusions: [{ id: 'fused:falcon+titan', a: 'falcon', b: 'titan' }], operations: undefined };
  old.shipUpgrades[old.ship] = { ...old.shipUpgrades.falcon, power: 8 };
  const store = new Map([['nova_strike_save_v1', JSON.stringify(old)]]);
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const save = loadSave();
  assert.equal(save.v, SAVE_VERSION); assert.equal(save.coins, 9832); assert.equal(save.ship, old.ship);
  assert.equal(save.shipUpgrades[old.ship].power, 8);
  assert.deepEqual(save.fusions, old.fusions);
  assert.equal(store.get('nova_strike_save_backup_v1'), JSON.stringify(old));
  assert.deepEqual(save.operations.flights, []);
});
test('storage quota cannot turn a valid old save into a fresh profile', () => {
  const old = { ...defaultSave(), v: 9, coins: 5321 };
  globalThis.localStorage = { getItem: () => JSON.stringify(old), setItem: () => { throw Error('QuotaExceeded'); } };
  assert.equal(loadSave().coins, 5321);
});
