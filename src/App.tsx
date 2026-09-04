import { useCallback, useEffect, useRef, useState } from 'react';
import { Home, Play, Volume2, VolumeX } from 'lucide-react';
import type { GameMode, HudState, RunResult, SaveData, ShipId, UpgradeId } from './game/types';
import { loadSave, persist } from './game/storage';
import { GameEngine } from './game/engine';
import { sfx } from './game/audio';
import { SHIP_MAP, upgradeCost, UPGRADE_MAP } from './game/content';
import { isModeUnlocked, MODE_MAP } from './game/modes';
import { Hud } from './ui/Hud';
import { Menu } from './ui/Menu';
import { Modes } from './ui/Modes';
import { GameOver } from './ui/GameOver';
import { Upgrades } from './ui/Upgrades';
import { Ships } from './ui/Ships';
import { Achievements } from './ui/Achievements';

type Screen = 'menu' | 'game' | 'gameover' | 'upgrades' | 'ships' | 'achievements' | 'modes';

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const saveRef = useRef(save);
  saveRef.current = save;

  const commit = useCallback((fn: (s: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = fn(prev);
      if (next !== prev) persist(next);
      return next;
    });
  }, []);

  const [screen, setScreen] = useState<Screen>('menu');
  const [backTo, setBackTo] = useState<Screen>('menu');
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [startCp, setStartCp] = useState(0);
  const [lastMode, setLastMode] = useState<GameMode>('classic');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const engine = new GameEngine(cv, {
      getSave: () => saveRef.current,
      commit,
      onHud: setHud,
      onGameOver: (r) => {
        setResult(r);
        setScreen('gameover');
      },
    });
    engineRef.current = engine;
    sfx.setMuted(saveRef.current.muted);
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [commit]);

  const play = useCallback((mode: GameMode, cp: number) => {
    sfx.unlock();
    sfx.play('ui');
    const target = isModeUnlocked(saveRef.current, mode) ? mode : 'classic';
    setLastMode(target);
    engineRef.current?.startRun({ mode: target, startCheckpoint: MODE_MAP[target].allowCheckpoints ? cp : 0 });
    setResult(null);
    setScreen('game');
  }, []);

  const openPanel = useCallback(
    (s: Screen) => {
      sfx.play('ui');
      setBackTo(screen === 'gameover' ? 'gameover' : 'menu');
      setScreen(s);
    },
    [screen],
  );

  const toggleMute = useCallback(() => {
    commit((s) => {
      const muted = !s.muted;
      sfx.setMuted(muted);
      if (muted) sfx.stopAmbient();
      return { ...s, muted };
    });
  }, [commit]);

  const buyUpgrade = useCallback(
    (id: UpgradeId) => {
      const cur = saveRef.current;
      const lvl = cur.upgrades[id];
      const cost = upgradeCost(id, lvl);
      if (lvl >= UPGRADE_MAP[id].max || cur.coins < cost) return;
      sfx.unlock();
      sfx.play('powerup');
      commit((s) => ({ ...s, coins: s.coins - cost, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } }));
    },
    [commit],
  );

  const selectShip = useCallback(
    (id: ShipId) => {
      if (!saveRef.current.shipsOwned.includes(id)) return;
      sfx.play('ui');
      commit((s) => ({ ...s, ship: id }));
    },
    [commit],
  );

  const buyShip = useCallback(
    (id: ShipId) => {
      const cur = saveRef.current;
      const def = SHIP_MAP[id];
      if (cur.shipsOwned.includes(id) || cur.coins < def.cost) return;
      if (def.requiresUnlock && !cur.unlocks.includes(def.requiresUnlock)) return;
      if (def.requires > 0 && (cur.checkpoints.length ? Math.max(...cur.checkpoints) : 0) < def.requires) return;
      sfx.unlock();
      sfx.play('powerup');
      commit((s) => ({ ...s, coins: s.coins - def.cost, shipsOwned: [...s.shipsOwned, id], ship: id }));
    },
    [commit],
  );

  return (
    <div id="shell" className="scanlines">
      <canvas ref={canvasRef} className="game-canvas" />

      {screen === 'menu' && (
        <Menu
          save={save}
          lastMode={lastMode}
          startCp={startCp}
          onPlay={play}
          onOpen={openPanel}
          onToggleMute={toggleMute}
        />
      )}

      {screen === 'game' && hud && (
        <Hud hud={hud} onPause={() => engineRef.current?.setPaused(true)} onAbility={() => engineRef.current?.activateAbility()} />
      )}

      {screen === 'game' && hud?.paused && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#02030a]/72 backdrop-blur-sm">
          <div className="pop-in text-center">
            <div className="text-[10px] font-extrabold tracking-[0.42em] text-cyan-300/80">ОЖИДАНИЕ</div>
            <div className="text-glow mt-1 text-4xl font-black tracking-[0.2em] text-cyan-50">ПАУЗА</div>
            <div className="num mt-2 text-[10px] font-bold tracking-[0.18em]" style={{ color: hud.modeColor }}>
              {hud.modeLabel} · СЧЁТ {hud.score}
            </div>
          </div>
          <div className="pop-in-1 mt-8 flex w-full max-w-[280px] flex-col gap-2.5 px-6">
            <button
              type="button"
              onClick={() => engineRef.current?.setPaused(false)}
              className="btn btn-primary flex h-14 items-center justify-center gap-2.5 rounded-2xl text-base font-black tracking-[0.24em]"
            >
              <Play size={19} strokeWidth={3} className="fill-current" />
              ПРОДОЛЖИТЬ
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={toggleMute}
                className="btn btn-ghost flex h-12 items-center justify-center gap-2 rounded-2xl text-[11px] font-black tracking-[0.16em] text-slate-200"
              >
                {save.muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                ЗВУК
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.play('ui');
                  engineRef.current?.abortToMenu();
                  setScreen('menu');
                }}
                className="btn btn-ghost flex h-12 items-center justify-center gap-2 rounded-2xl text-[11px] font-black tracking-[0.16em] text-slate-200"
              >
                <Home size={15} />
                ВЫХОД
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'gameover' && result && (
        <GameOver
          result={result}
          save={save}
          onRetry={() => play(result.mode, result.startCheckpoint)}
          onMenu={() => {
            sfx.play('ui');
            setScreen('menu');
          }}
          onModes={() => openPanel('modes')}
          onUpgrades={() => openPanel('upgrades')}
        />
      )}

      {screen === 'modes' && (
        <Modes
          save={save}
          startCp={startCp}
          setStartCp={setStartCp}
          onPlay={play}
          onBack={() => setScreen(backTo)}
        />
      )}
      {screen === 'upgrades' && <Upgrades save={save} onBack={() => setScreen(backTo)} onBuy={buyUpgrade} />}
      {screen === 'ships' && <Ships save={save} onBack={() => setScreen(backTo)} onSelect={selectShip} onBuy={buyShip} />}
      {screen === 'achievements' && <Achievements save={save} onBack={() => setScreen(backTo)} />}
    </div>
  );
}
