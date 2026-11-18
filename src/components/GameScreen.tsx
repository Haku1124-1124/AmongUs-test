import React, { useRef, useState } from 'react';
import { ROLES_DEF } from '../game/constants';
import { MapDef, MapVent } from '../game/maps';
import { hasCrewTasks, PlayerState } from '../game/rules';
import { formatKeyCodeLabel } from '../game/storage';
import { getTaskLabelInMap } from './GameModals';

export interface ActionButtonState {
  visible?: boolean;
  enabled: boolean;
  label: string;
}

interface GameScreenProps {
  gameCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  me: PlayerState | undefined;
  mapDef: MapDef;
  roomName: string;
  visionRadius: number;
  taskCompletedCount: number;
  taskTotalCount: number;
  sabotage: { type: 'lights' | 'reactor'; timer: number } | null;
  myTasks: string[];
  completedTasks: Record<string, boolean>;
  gimmickStatusText: string;
  cameraWatchTimer: number;
  cameraFeedLabel: string;
  cameraFeedCount: number;
  cameraFeedIndex: number;
  onSwitchCameraFeed: () => void;
  onCloseCamera: () => void;
  currentVentIndex: number;
  ventStayTimer: number;
  onJumpToVent: (idx: number) => void;
  onExitVent: () => void;
  onOpenMap: () => void;
  useActionState: ActionButtonState;
  reportActionState: ActionButtonState;
  killActionState: ActionButtonState;
  ventActionState: ActionButtonState;
  sabotageActionState: ActionButtonState;
  abilityActionState: ActionButtonState;
  onUse: () => void;
  onReport: () => void;
  onKill: () => void;
  onVent: () => void;
  onSabotage: () => void;
  onAbility: () => void;
  onJoystickChange: (dx: number, dy: number) => void;
  keybinds: Record<string, string>;
}

function stripLeadingEmoji(label: string): { short: string; cooldown: string | null } {
  const cleaned = label.replace(/^[^\p{L}\p{N}(]+/u, '').trim();
  const cdMatch = cleaned.match(/^(.*?)\s*\((\d+s)\)$/);
  if (cdMatch) {
    const base = cdMatch[1].trim();
    return { short: base || '待機', cooldown: cdMatch[2] };
  }
  if (/^\(\d+\)$/.test(cleaned)) {
    return { short: `残 ${cleaned.slice(1, -1)}`, cooldown: null };
  }
  return { short: cleaned || label, cooldown: null };
}

const HudActionIcon: React.FC<{ kind: 'use' | 'report' | 'kill' | 'vent' | 'sabotage' | 'ability'; label: string }> = ({
  kind,
  label
}) => {
  if (kind === 'kill') {
    if (label.includes('塗布') || label.includes('点火')) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3C12 3 17 8.5 17 13A5 5 0 0 1 7 13C7 10.5 8.5 8 10 6.5C10.2 8.2 11.4 9 11.4 9C11.4 9 11 5.5 12 3Z" fill="currentColor" opacity="0.9" />
        </svg>
      );
    }
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19.5 3.5L10 13L11.5 14.5L21 5L19.5 3.5Z" fill="currentColor" />
        <path d="M9.5 12.5L4 18L6 20L11.5 14.5L9.5 12.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 15L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'report') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 11V14L9 15.5L18 19V6L9 9.5L4 11Z" fill="currentColor" opacity="0.92" />
        <path d="M8 15.5L9.5 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 9.5C21.2 10.8 21.2 14.2 20 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'vent') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M7 9.5H17M7 12H17M7 14.5H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'sabotage') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2L5 14H12L11 22L19 10H12L13 2Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'ability') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3L14.5 9L21 10.5L16 14.8L17.5 21L12 17.6L6.5 21L8 14.8L3 10.5L9.5 9L12 3Z" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.25" />
      </svg>
    );
  }
  // use / task / fix
  if (label.includes('修理')) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2L5 14H12L11 22L19 10H12L13 2Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.7 6.3A4.5 4.5 0 0 0 9 11.7L4.3 16.4A1.5 1.5 0 0 0 6.4 18.5L11.1 13.8A4.5 4.5 0 0 0 16.5 8.1L14 10.6L12.2 8.8L14.7 6.3Z" fill="currentColor" />
    </svg>
  );
};

export const GameScreen: React.FC<GameScreenProps> = ({
  gameCanvasRef,
  me,
  mapDef,
  roomName,
  visionRadius,
  taskCompletedCount,
  taskTotalCount,
  sabotage,
  myTasks,
  completedTasks,
  gimmickStatusText,
  cameraWatchTimer,
  cameraFeedLabel,
  cameraFeedCount,
  cameraFeedIndex,
  onSwitchCameraFeed,
  onCloseCamera,
  currentVentIndex,
  ventStayTimer,
  onJumpToVent,
  onExitVent,
  onOpenMap,
  useActionState,
  reportActionState,
  killActionState,
  ventActionState,
  sabotageActionState,
  abilityActionState,
  onUse,
  onReport,
  onKill,
  onVent,
  onSabotage,
  onAbility,
  onJoystickChange,
  keybinds
}) => {
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyActiveRef = useRef(false);

  if (!me) return null;

  const roleDef = ROLES_DEF[me.role] || ROLES_DEF.crewmate;
  const taskPct = Math.round((taskCompletedCount / Math.max(1, taskTotalCount)) * 100);
  const filledSegments = Math.round((taskPct / 100) * 10);
  const showCrewTasks = hasCrewTasks(me.role);
  const findRoomName = (x: number, y: number) => {
    for (const r of mapDef.rooms) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.name;
    }
    return '連絡通路';
  };

  const updateJoystickFromPointer = (clientX: number, clientY: number) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      setJoyKnob({ x: 0, y: 0 });
      onJoystickChange(0, 0);
      return;
    }
    const clamped = Math.min(maxR, dist);
    const nx = dx / dist;
    const ny = dy / dist;
    setJoyKnob({ x: nx * clamped, y: ny * clamped });
    onJoystickChange(nx, ny);
  };

  const resetJoystick = () => {
    joyActiveRef.current = false;
    setJoyKnob({ x: 0, y: 0 });
    onJoystickChange(0, 0);
  };

  const useParsed = stripLeadingEmoji(useActionState.label);
  const reportParsed = stripLeadingEmoji(reportActionState.label);
  const killParsed = stripLeadingEmoji(killActionState.label);
  const ventParsed = stripLeadingEmoji(ventActionState.label);
  const sabParsed = stripLeadingEmoji(sabotageActionState.label);
  const abilParsed = stripLeadingEmoji(abilityActionState.label);

  return (
    <section className="flex-1 w-full flex flex-col relative overflow-hidden min-h-[540px]">
      {/* 上部HUDバー（Among Us風タスクゲージ＋コンパクト位置情報） */}
      <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 bg-slate-950/90 border-b border-slate-800/80">
        <div className="hud-plate rounded-2xl px-3.5 py-2 flex items-center gap-3.5">
          <div>
            <div className="text-[10px] font-orbitron font-bold tracking-wider text-slate-400">ROLE</div>
            <div className="font-orbitron font-black text-xs sm:text-sm leading-tight" style={{ color: roleDef.color }}>
              {roleDef.jp}
            </div>
          </div>
          <div className="h-7 w-px bg-slate-700/80" />
          <div className="min-w-[140px] sm:min-w-[190px]">
            <div className="flex justify-between items-center text-[10px] font-orbitron font-bold mb-1">
              <span className="text-emerald-300 tracking-wider">TOTAL TASKS</span>
              <span className="text-white tabular-nums">{taskPct}%</span>
            </div>
            {/* Among Us風セグメント型タスクバー */}
            <div className="grid grid-cols-10 gap-1 p-1 rounded-lg bg-slate-950 border border-slate-700/90">
              {Array.from({ length: 10 }, (_, idx) => (
                <div
                  key={idx}
                  className={`h-2.5 rounded-[3px] transition-all duration-300 ${
                    idx < filledSegments
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
                      : 'bg-slate-800/90'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {sabotage && (
          <div className="alarm-blink px-4 py-2 rounded-2xl bg-rose-950/95 border-2 border-rose-500 text-rose-100 font-black text-xs sm:text-sm">
            {sabotage.type === 'lights'
              ? `停電発生！ ${mapDef.sabotageFix.lights.label}で復旧してください`
              : `炉心メルトダウン発生！ 残り ${Math.max(0, Math.ceil(sabotage.timer))} 秒 (${mapDef.sabotageFix.reactor.label})`}
          </div>
        )}

        <div className="hud-plate rounded-2xl px-3 py-1.5 flex items-center gap-2.5 text-xs">
          <div className="hidden sm:block text-right pr-1">
            <div className="text-[10px] font-bold text-slate-400">
              {mapDef.name} · 視界 {visionRadius}px
            </div>
            <div className="font-bold text-cyan-300">{roomName}</div>
          </div>
          {gimmickStatusText && (
            <span className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-[11px]">
              {gimmickStatusText}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenMap}
            className="sf-btn px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/65 text-cyan-100 font-bold flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6L9 3L15 6L21 3V18L15 21L9 18L3 21V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M9 3V18M15 6V21" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>マップ</span>
            <span className="text-[10px] text-cyan-300 font-orbitron">[{formatKeyCodeLabel(keybinds.map)}]</span>
          </button>
        </div>
      </div>

      {/* メイン2Dゲームキャンバス */}
      <div className="relative flex-1 w-full bg-slate-950 overflow-hidden min-h-0">
        <canvas
          ref={gameCanvasRef}
          data-testid="game-canvas"
          className="absolute inset-0 w-full h-full block"
        />

        {/* 左上：タスク・目的カード（Canvas上に透過オーバーレイ・backdrop-filter禁止） */}
        <div
          className="absolute top-3 left-3 rounded-2xl p-3 w-56 sm:w-64 pointer-events-none z-10 space-y-1.5 border border-cyan-400/30 shadow-[0_12px_28px_rgba(0,0,0,0.62)]"
          style={{ background: 'rgba(7, 13, 28, 0.78)' }}
        >
          <div className="text-[11px] font-orbitron font-bold text-cyan-300 flex justify-between items-center border-b border-slate-700/70 pb-1">
            <span>OBJECTIVES</span>
            <span className={me.alive ? 'text-emerald-300' : 'text-purple-300'}>
              {me.alive ? 'ALIVE' : 'GHOST'}
            </span>
          </div>
          <ul className="space-y-1 text-xs">
            {showCrewTasks ? (
              myTasks.map((tid) => {
                const done = Boolean(completedTasks[tid]);
                return (
                  <li
                    key={tid}
                    className={`flex items-center gap-1.5 ${
                      done ? 'text-emerald-400 line-through opacity-75' : 'text-slate-100 font-medium'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 text-[9px] font-black ${
                        done
                          ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900/90 border-slate-500'
                      }`}
                    >
                      {done ? '✓' : ''}
                    </span>
                    <span className="truncate">{getTaskLabelInMap(tid, mapDef, findRoomName)}</span>
                  </li>
                );
              })
            ) : (
              <li className="text-rose-200 leading-relaxed text-[11px]">{roleDef.desc}</li>
            )}
          </ul>
          <div className="pt-1 border-t border-slate-800/90 text-[10px] text-amber-300/95 leading-snug">
            {mapDef.gimmickSummary}
          </div>
          {!me.alive && (
            <div className="pt-1 border-t border-purple-500/40 text-[10px] text-purple-200 font-bold leading-snug">
              👻 幽霊状態：壁を通過し残りタスク完了＆イタズラ可能
            </div>
          )}
        </div>

        {/* 監視カメラマルチフィード切替バー */}
        {cameraWatchTimer > 0 && (
          <div
            className="absolute bottom-28 sm:bottom-24 left-1/2 -translate-x-1/2 z-20 rounded-2xl p-2.5 flex flex-wrap items-center justify-center gap-2 border-2 border-cyan-400/85 shadow-2xl"
            style={{ background: 'rgba(6, 12, 26, 0.9)' }}
          >
            <span className="text-xs font-black text-cyan-300 px-1">
              監視カメラ: {cameraFeedLabel} ({cameraFeedIndex + 1}/{Math.max(1, cameraFeedCount)})
            </span>
            {cameraFeedCount > 1 && (
              <button
                type="button"
                onClick={onSwitchCameraFeed}
                className="sf-btn px-3 py-1.5 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/50 border border-cyan-400 text-cyan-100 text-xs font-black"
              >
                切替 [Tab]
              </button>
            )}
            <button
              type="button"
              onClick={onCloseCamera}
              className="sf-btn px-3 py-1.5 rounded-xl bg-rose-600/85 hover:bg-rose-500 text-white text-xs font-black"
            >
              視聴終了 [{formatKeyCodeLabel(keybinds.use)}]
            </button>
          </div>
        )}

        {/* ベント移動パネル */}
        {me.inVent && (
          <div
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 rounded-2xl p-3 flex flex-wrap items-center justify-center gap-2 max-w-[92vw] border border-emerald-400/50 shadow-2xl"
            style={{ background: 'rgba(6, 12, 26, 0.9)' }}
          >
            <span className="text-xs font-bold text-emerald-300">
              ベント潜伏中（{(mapDef.vents[currentVentIndex] as MapVent | undefined)?.label || ''}
              {me.role === 'engineer' ? ` / 残り ${Math.max(0, Math.ceil(ventStayTimer))}s` : ''}）：
            </span>
            {mapDef.vents.map((v, idx) => (
              <button
                key={v.id}
                type="button"
                disabled={idx === currentVentIndex}
                onClick={() => onJumpToVent(idx)}
                className={`sf-btn px-2.5 py-1 rounded-xl text-xs font-bold border ${
                  idx === currentVentIndex
                    ? 'bg-emerald-500 text-slate-950 border-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-cyan-200 border-cyan-400/50'
                }`}
              >
                [{idx + 1}] {v.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onExitVent}
              className="sf-btn px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
            >
              外へ出る [{formatKeyCodeLabel(keybinds.vent)}]
            </button>
          </div>
        )}

        {/* 左下：タクティカルバーチャルジョイスティック */}
        <div
          ref={joyBaseRef}
          onPointerDown={(e) => {
            joyActiveRef.current = true;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            updateJoystickFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!joyActiveRef.current) return;
            updateJoystickFromPointer(e.clientX, e.clientY);
          }}
          onPointerUp={resetJoystick}
          onPointerCancel={resetJoystick}
          className="absolute bottom-4 left-4 w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-cyan-400/45 flex items-center justify-center touch-none z-20 cursor-grab active:cursor-grabbing shadow-[0_0_24px_rgba(6,182,212,0.18)]"
          style={{ background: 'radial-gradient(circle, rgba(15,28,54,0.68) 0%, rgba(7,12,26,0.78) 100%)' }}
        >
          <div className="absolute inset-3 rounded-full border border-dashed border-cyan-400/25 pointer-events-none" />
          <div
            className="w-12 h-12 rounded-full bg-cyan-400/85 border-2 border-white shadow-[0_0_16px_rgba(56,189,248,0.72)] pointer-events-none transition-transform duration-75"
            style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
          />
        </div>

        {/* 右下：洗練されたAmong Us風タクティカルアクションパッド */}
        <div className="absolute bottom-4 right-4 flex flex-wrap items-end justify-end gap-2.5 sm:gap-3 z-20 max-w-[70vw]">
          {abilityActionState.visible && (
            <button
              type="button"
              disabled={!abilityActionState.enabled}
              onClick={onAbility}
              className="hud-action-pad hud-pad-purple w-[76px] h-[76px] rounded-2xl font-black text-[11px] text-purple-100 flex flex-col items-center justify-center gap-0.5 leading-tight"
            >
              <HudActionIcon kind="ability" label={abilityActionState.label} />
              <span className="truncate max-w-[68px]">{abilParsed.cooldown || abilParsed.short}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-950/65 text-[9px] font-orbitron text-purple-200 border border-purple-300/30">
                {formatKeyCodeLabel(keybinds.ability)}
              </span>
            </button>
          )}

          {sabotageActionState.visible && (
            <button
              type="button"
              disabled={!sabotageActionState.enabled}
              onClick={onSabotage}
              className="hud-action-pad hud-pad-amber w-[76px] h-[76px] rounded-2xl font-black text-[11px] text-amber-100 flex flex-col items-center justify-center gap-0.5 leading-tight"
            >
              <HudActionIcon kind="sabotage" label={sabotageActionState.label} />
              <span className="truncate max-w-[68px]">{sabParsed.cooldown || sabParsed.short}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-950/65 text-[9px] font-orbitron text-amber-200 border border-amber-300/30">
                {formatKeyCodeLabel(keybinds.sabotage)}
              </span>
            </button>
          )}

          {ventActionState.visible && (
            <button
              type="button"
              disabled={!ventActionState.enabled}
              onClick={onVent}
              className="hud-action-pad hud-pad-emerald w-[76px] h-[76px] rounded-2xl font-black text-[11px] text-emerald-100 flex flex-col items-center justify-center gap-0.5 leading-tight"
            >
              <HudActionIcon kind="vent" label={ventActionState.label} />
              <span className="truncate max-w-[68px]">{ventParsed.cooldown || ventParsed.short}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-950/65 text-[9px] font-orbitron text-emerald-200 border border-emerald-300/30">
                {formatKeyCodeLabel(keybinds.vent)}
              </span>
            </button>
          )}

          {killActionState.visible && (
            <button
              type="button"
              disabled={!killActionState.enabled}
              onClick={onKill}
              className={`hud-action-pad hud-pad-rose w-[82px] h-[82px] rounded-full font-black text-[11px] text-rose-100 flex flex-col items-center justify-center gap-0.5 leading-tight ${
                killActionState.enabled ? 'hud-pad-rose-ready' : ''
              }`}
            >
              <HudActionIcon kind="kill" label={killActionState.label} />
              <span className="truncate max-w-[72px]">{killParsed.cooldown || killParsed.short}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-950/65 text-[9px] font-orbitron text-rose-200 border border-rose-300/30">
                {formatKeyCodeLabel(keybinds.kill)}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={!reportActionState.enabled}
            onClick={onReport}
            className="hud-action-pad hud-pad-orange w-[82px] h-[82px] rounded-full font-black text-[11px] text-orange-100 flex flex-col items-center justify-center gap-0.5 leading-tight"
          >
            <HudActionIcon kind="report" label={reportActionState.label} />
            <span className="truncate max-w-[72px]">{reportParsed.short}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950/65 text-[9px] font-orbitron text-orange-200 border border-orange-300/30">
              {formatKeyCodeLabel(keybinds.report)}
            </span>
          </button>

          <button
            type="button"
            disabled={!useActionState.enabled}
            onClick={onUse}
            className="hud-action-pad hud-pad-cyan w-[92px] h-[92px] rounded-full font-black text-xs text-cyan-50 flex flex-col items-center justify-center gap-0.5 leading-tight"
          >
            <HudActionIcon kind="use" label={useActionState.label} />
            <span className="truncate max-w-[82px]">{useParsed.cooldown || useParsed.short}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950/70 text-[9px] font-orbitron text-cyan-200 border border-cyan-300/40">
              {formatKeyCodeLabel(keybinds.use)}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
