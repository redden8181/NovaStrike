import { Sparkles } from 'lucide-react';
import { BUILD_VERSION, CHANGELOG } from '../game/content';
import { ScreenHeader } from './bits';

export function Info({ onBack }: { onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#02030a]/90 backdrop-blur-md">
      <div className="safe-top">
        <ScreenHeader
          title="ЧТО НОВОГО"
          sub={`СБОРКА ${BUILD_VERSION}`}
          onBack={onBack}
          right={
            <div className="glass num rounded-full px-3 py-1.5 text-[11px] font-black text-cyan-200">
              v{BUILD_VERSION}
            </div>
          }
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6" style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-3">
          {CHANGELOG.map((entry, idx) => {
            const latest = idx === 0;
            return (
              <div
                key={entry.version}
                className="glass pop-in rounded-3xl p-3.5"
                style={{
                  animationDelay: `${idx * 0.05}s`,
                  borderColor: latest ? 'rgba(34,211,238,0.45)' : undefined,
                  boxShadow: latest ? '0 0 24px rgba(34,211,238,0.14)' : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {latest && <Sparkles size={13} className="shrink-0 text-cyan-300" strokeWidth={2.8} />}
                    <span
                      className="truncate text-[12px] font-black tracking-[0.14em]"
                      style={{ color: latest ? '#67e8f9' : '#e2e8f0' }}
                    >
                      {entry.title}
                    </span>
                  </div>
                  <span
                    className="num shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black"
                    style={{
                      background: latest ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.06)',
                      color: latest ? '#67e8f9' : '#94a3b8',
                    }}
                  >
                    v{entry.version}
                  </span>
                </div>

                <ul className="mt-2 flex flex-col gap-1.5">
                  {entry.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span
                        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: latest ? '#22d3ee' : '#475569' }}
                      />
                      <span className="text-[10.5px] leading-snug font-medium text-slate-300">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center text-[9.5px] leading-relaxed font-semibold tracking-[0.1em] text-slate-500">
          NOVA STRIKE · РАБОТАЕТ ПОЛНОСТЬЮ ОФЛАЙН
          <br />
          ПРОГРЕСС ХРАНИТСЯ НА ЭТОМ УСТРОЙСТВЕ
        </div>
      </div>
    </div>
  );
}
