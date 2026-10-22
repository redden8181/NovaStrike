import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: "export { GameEngine } from './src/game/engine'; export { defaultSave } from './src/game/storage';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { GameEngine, defaultSave } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
// A no-op drawing surface lets these tests exercise the actual game loop,
// not duplicate its rules. Visual rendering still needs a browser check.
function setup() {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (_t, key) => key === 'measureText' ? () => ({ width: 40 }) : String(key).startsWith('create') ? () => gradient : () => {}, set: () => true });
  const canvas = () => ({ getContext: () => ctx, style: {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }), parentElement: { clientWidth: 393, clientHeight: 852 } });
  globalThis.window = { addEventListener() {}, removeEventListener() {}, clearTimeout, setTimeout, innerWidth: 393, innerHeight: 852, devicePixelRatio: 1 };
  globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: canvas, hidden: false };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  let save = { ...defaultSave(), muted: true };
  let hud; let result;
  const engine = new GameEngine(canvas(), { getSave: () => save, commit: fn => { save = fn(save); }, onHud: h => { hud = h; }, onGameOver: r => { result = r; } });
  return { engine, get save() { return save; }, get hud() { return hud; }, get result() { return result; } };
}
test('actual engine crosses sectors, applies multipliers and records the completed run', () => {
  const t = setup(); const e = t.engine;
  e.startRun({ mode: 'classic', startCheckpoint: 0 });
  e.hp = e.maxHp = 1e8;
  for (let i = 0; i < 46 * 60; i++) e.update(1 / 60);
  e.emitHud();
  assert.equal(t.hud.sector.name, 'Пояс обломков');
  assert.ok(t.hud.sector.left <= 45);
  const score = e.score;
  e.enemies.push({ x: 0, y: 0, score: 100, kind: 'scout', coinMin: 0, coinMax: 0, powerChance: 0 });
  e.chain.break(); e.killEnemy(e.enemies.length - 1, true);
  assert.equal(Math.round(e.score - score), 125);
  e.damagePlayer(1); assert.equal(e.chain.count, 0);
  e.render(); e.endRun();
  assert.equal(t.save.operations.flights.length, 1);
  assert.ok(t.save.operations.progress.time >= 45);
  assert.equal(t.result.bestCombo, t.save.operations.flights[0].combo);
  e.destroy();
});
test('actual daily engine keeps sectors and chain disabled and excludes contract progress', () => {
  const t = setup(); const e = t.engine;
  e.startRun({ mode: 'daily', startCheckpoint: 0 });
  e.runTime = 100; e.updateDiff();
  const score = e.score;
  e.enemies.push({ x: 0, y: 0, score: 100, kind: 'scout', coinMin: 0, coinMax: 0, powerChance: 0 });
  e.killEnemy(0, true); e.emitHud();
  assert.equal(e.score - score, 100 * e.scoreMul);
  assert.equal(t.hud.sector, null); assert.equal(t.hud.combo, 0);
  e.endRun();
  assert.deepEqual(t.save.operations.progress, { kills: 0, time: 0, bosses: 0 });
  assert.equal(t.save.operations.flights[0].mode, 'daily');
  e.destroy();
});

test('saturated player bullet pool preserves every stream and symmetry of new volleys', () => {
  const { engine: e } = setup();
  e.startRun({ mode: 'daily', startCheckpoint: 0 });
  e.streamsBase = 9;
  // Saturate with a mixture of main volleys and independent tech projectiles.
  for (let i = 0; i < 120; i++) {
    e.fire();
    const volley = e.pBullets.filter(b => b.volley === e.nextVolley);
    assert.equal(volley.length, 9, `volley ${i} must retain all nine streams`);
    for (let j = 0; j < 4; j++) {
      assert.ok(Math.abs(volley[j].x + volley[8 - j].x - 2 * e.px) < 1e-8);
      assert.ok(Math.abs(volley[j].vx + volley[8 - j].vx) < 1e-8);
    }
    e.addPBullet(0, 0, 0, -1, 1, 1, false, 1);
    assert.ok(e.pBullets.length <= 180);
    const sizes = new Map();
    for (const b of e.pBullets) if (b.volley) sizes.set(b.volley, (sizes.get(b.volley) ?? 0) + 1);
    assert.ok([...sizes.values()].every(size => size === 9), 'old volleys must retire as whole groups too');
  }
  e.destroy();
});

test('left and right turret volleys both fit when the bullet pool is full', () => {
  const { engine: e } = setup();
  e.startRun({ mode: 'daily', startCheckpoint: 0 }); e.phase = 'playing';
  e.streamsBase = 9;
  for (let i = 0; i < 20; i++) e.fire();
  assert.equal(e.pBullets.length, 180);
  e.turretL = e.turretR = true; e.turretStreams = 4;
  e.turretTL = e.turretTR = 0;
  e.turretAngL = Math.PI; e.turretAngR = 0;
  const left = e.turretMount(-1), right = e.turretMount(1);
  e.enemies = [{ x: left.x - 100, y: left.y }, { x: right.x + 100, y: right.y }];
  e.updateTurrets(1 / 60);
  const shots = e.pBullets.filter(b => b.kind === 4);
  assert.equal(shots.filter(b => b.vx < 0).length, 4);
  assert.equal(shots.filter(b => b.vx > 0).length, 4);
  assert.ok(e.pBullets.length <= 180);
  e.destroy();
});
