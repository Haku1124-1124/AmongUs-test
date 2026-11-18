import React, { useEffect, useMemo, useRef } from 'react';
import { CREW_COLORS, ROLES_DEF } from '../game/constants';
import { hasCrewTasks, isImpostorTeam, KillEvent, PlayerState } from '../game/rules';
import { drawCrewmateSprite, renderCrewmateLineupCanvas } from '../game/renderer';

/* 1. ゲーム開始時：SHHH! & CREWMATE / IMPOSTOR スポットライト発表演出 */
export const RoleRevealOverlay: React.FC<{
  open: boolean;
  mapName: string;
  gimmickSummary: string;
  roleId: string;
  partners: string[];
  me: PlayerState | undefined;
  players: Record<string, PlayerState>;
  impostorCount: number;
  onDismiss?: () => void;
}> = ({ open, mapName, gimmickSummary, roleId, partners, me, players, impostorCount, onDismiss }) => {
  const lineupRef = useRef<HTMLCanvasElement | null>(null);
  const roleDef = ROLES_DEF[roleId] || ROLES_DEF.crewmate;
  const isImp = roleDef.team === 'impostor';
  const isNeutral = roleDef.team === 'neutral';
  const glowHex = isImp ? '#f43f5e' : isNeutral ? '#fb923c' : '#38bdf8';

  const lineupMembers = useMemo(() => {
    const all = Object.values(players);
    if (!me) return [];
    if (isImp) {
      const team = all.filter((p) => isImpostorTeam(p.role));
      return [
        { id: me.id, name: me.name, color: me.color, hat: me.hat, pet: me.pet, isHighlight: true },
        ...team
          .filter((p) => p.id !== me.id)
          .slice(0, 4)
          .map((p) => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, pet: p.pet }))
      ];
    }
    return [
      { id: me.id, name: me.name, color: me.color, hat: me.hat, pet: me.pet, isHighlight: true },
      ...all
        .filter((p) => p.id !== me.id)
        .slice(0, 6)
        .map((p) => ({ id: p.id, name: p.name, color: p.color, hat: p.hat, pet: p.pet }))
    ];
  }, [isImp, me, players]);

  useEffect(() => {
    if (!open || !lineupRef.current) return;
    renderCrewmateLineupCanvas({
      canvas: lineupRef.current,
      members: lineupMembers,
      glowColor: glowHex
    });
  }, [glowHex, lineupMembers, open]);

  if (!open) return null;

  return (
    <div
      data-testid="role-reveal-overlay"
      className="fixed inset-0 z-50 bg-[#02050e] flex flex-col items-center justify-center p-4 overflow-hidden"
    >
      {/* 横帯光束エフェクト */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 pointer-events-none au-banner-sweep"
        style={{
          background: `radial-gradient(ellipse at center, ${glowHex}44 0%, ${glowHex}14 48%, transparent 78%)`
        }}
      />

      <div className="relative z-10 max-w-2xl w-full text-center space-y-4 au-cutin-pop">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-slate-600/80 bg-slate-900/90 text-xs font-orbitron font-bold text-slate-200 tracking-widest">
          <span>🤫 SHHH!</span>
          <span className="text-slate-500">|</span>
          <span className="text-amber-300">{mapName}</span>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-orbitron tracking-[0.28em] text-slate-300">
            {isImp
              ? `船内に ${impostorCount}人 のインポスターが潜伏中`
              : isNeutral
                ? '第三陣営・独自の勝利条件を達成せよ'
                : `船内のインポスター（${impostorCount}人）を見つけ出せ`}
          </div>
          <h2
            className="font-orbitron text-4xl sm:text-6xl font-black tracking-wider drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)]"
            style={{ color: roleDef.color }}
          >
            {roleDef.name}
          </h2>
          <div className="text-lg sm:text-xl font-black text-white">{roleDef.jp}</div>
        </div>

        <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950/80 p-2">
          <canvas ref={lineupRef} width={560} height={136} className="w-full h-32 block" />
        </div>

        <div className="max-w-lg mx-auto space-y-2">
          <p className="text-sm text-slate-100 font-medium leading-relaxed">{roleDef.desc}</p>
          <div className="text-xs font-bold text-emerald-300 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2">
            ⚖️ {roleDef.balance}
          </div>
          <div className="text-[11px] text-amber-300 font-bold">
            ✨ ステージギミック: {gimmickSummary}
          </div>
          {partners.length > 0 && (
            <div className="text-xs font-black text-rose-300">
              🩸 インポスター陣営の仲間: {partners.join(', ')}
            </div>
          )}
        </div>

        {onDismiss && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onDismiss}
              className="sf-btn px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs"
            >
              ▶ ミッション開始
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* 2. 死体発見 / 緊急会議招集 Among Us風カットイン演出 */
export const ReportCutInOverlay: React.FC<{
  open: boolean;
  reason: 'body' | 'emergency';
  callerName: string;
  callerColor: string;
  callerHat: string;
  victimName?: string;
  victimColor?: string;
}> = ({ open, reason, callerName, callerColor, callerHat, victimName, victimColor }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = 420;
    c.height = 132;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    // スポットライト背景
    const accent = reason === 'body' ? '#f97316' : '#f43f5e';
    const g = ctx.createRadialGradient(210, 68, 12, 210, 68, 180);
    g.addColorStop(0, `${accent}55`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    if (reason === 'body' && victimColor) {
      ctx.save();
      ctx.translate(145, 76);
      ctx.scale(1.55, 1.55);
      drawCrewmateSprite(ctx, 0, 0, callerColor, callerHat, 1, true, false, 1, false, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(275, 84);
      ctx.scale(1.65, 1.65);
      drawCrewmateSprite(ctx, 0, 0, victimColor, 'none', 1, false, false, 1, false, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(102, 74, 68, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(136, 72, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(260, 76);
      ctx.scale(1.6, 1.6);
      drawCrewmateSprite(ctx, 0, 0, callerColor, callerHat, -1, true, false, 1, false, 0);
      ctx.restore();
    }
  }, [callerColor, callerHat, open, reason, victimColor]);

  if (!open) return null;

  const isBody = reason === 'body';

  return (
    <div
      data-testid="report-cutin-overlay"
      className="fixed inset-0 z-50 bg-[#04060e] flex flex-col items-center justify-center overflow-hidden"
    >
      <div className="w-full h-5 au-hazard-stripe opacity-90" />
      <div className="flex-1 w-full flex flex-col items-center justify-center p-4 relative">
        <div
          className="w-full py-6 sm:py-8 border-y-4 flex flex-col items-center justify-center text-center space-y-3 au-banner-sweep"
          style={{
            borderColor: isBody ? '#fb923c' : '#f43f5e',
            background: isBody
              ? 'linear-gradient(90deg, rgba(124,45,18,0.18) 0%, rgba(234,88,12,0.45) 50%, rgba(124,45,18,0.18) 100%)'
              : 'linear-gradient(90deg, rgba(136,19,55,0.18) 0%, rgba(225,29,72,0.45) 50%, rgba(136,19,55,0.18) 100%)'
          }}
        >
          <div className="text-xs font-orbitron font-black tracking-[0.35em] text-amber-300">
            {isBody ? '⚠️ CREWMATE DOWN' : '🚨 ALERT TRIGGERED'}
          </div>
          <h2 className="font-orbitron text-3xl sm:text-5xl font-black tracking-wider text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] au-cutin-pop">
            {isBody ? 'DEAD BODY REPORTED!' : 'EMERGENCY MEETING!'}
          </h2>
          <div className="text-base sm:text-xl font-black text-amber-200">
            {isBody
              ? `${callerName} が ${victimName ? `${victimName} の` : ''}死体を発見！`
              : `${callerName} が緊急会議を招集！`}
          </div>
          <canvas ref={canvasRef} width={420} height={132} className="w-80 sm:w-[420px] h-28 sm:h-32 block mx-auto" />
        </div>
      </div>
      <div className="w-full h-5 au-hazard-stripe opacity-90" />
    </div>
  );
};

/* 3. キル・防衛時の一瞬フラッシュカットイン */
export const KillFlashOverlay: React.FC<{
  flash: { kind: 'killed' | 'shield' | 'strike'; title: string; subtitle: string } | null;
}> = ({ flash }) => {
  if (!flash) return null;
  const isShield = flash.kind === 'shield';
  const borderCol = isShield ? 'border-cyan-400' : 'border-rose-500';
  const bgStyle = isShield
    ? 'radial-gradient(circle at center, rgba(6,182,212,0.15) 35%, rgba(8,145,178,0.65) 100%)'
    : 'radial-gradient(circle at center, rgba(225,29,72,0.12) 32%, rgba(159,18,57,0.72) 100%)';

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center au-slash-flash"
      style={{ background: bgStyle }}
    >
      <div className={`px-8 py-4 rounded-2xl bg-slate-950/90 border-2 ${borderCol} text-center shadow-2xl`}>
        <div
          className={`font-orbitron text-2xl sm:text-4xl font-black tracking-widest ${
            isShield ? 'text-cyan-300' : 'text-rose-400'
          }`}
        >
          {flash.title}
        </div>
        <div className="text-xs sm:text-sm font-bold text-white mt-1">{flash.subtitle}</div>
      </div>
    </div>
  );
};

/* 4. 追放演出（宇宙空間放逐＋回転アニメーション） */
export const EjectionOverlay: React.FC<{
  open: boolean;
  text: string;
  subtext: string;
  ejectedColor?: string;
  ejectedHat?: string;
}> = ({ open, text, subtext, ejectedColor, ejectedHat }) => {
  const spriteRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open || !spriteRef.current || !ejectedColor) return;
    const c = spriteRef.current;
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 96, 96);
    ctx.save();
    ctx.translate(48, 54);
    ctx.scale(1.35, 1.35);
    drawCrewmateSprite(ctx, 0, 0, ejectedColor, ejectedHat || 'none', 1, true, false, 1, false, 0);
    ctx.restore();
  }, [ejectedColor, ejectedHat, open]);

  if (!open) return null;

  return (
    <div
      data-testid="ejection-overlay"
      className="fixed inset-0 z-50 bg-[#02040a] flex flex-col items-center justify-center p-4 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-85 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(2px 2px at 12% 20%, #fff, transparent), radial-gradient(2.5px 2.5px at 24% 48%, #93c5fd, transparent), radial-gradient(2px 2px at 42% 70%, #7dd3fc, transparent), radial-gradient(1.5px 1.5px at 56% 24%, #fff, transparent), radial-gradient(1.5px 1.5px at 78% 30%, #fff, transparent), radial-gradient(2.5px 2.5px at 88% 82%, #fde047, transparent), radial-gradient(1.5px 1.5px at 28% 86%, #fff, transparent), radial-gradient(2px 2px at 64% 16%, #fff, transparent), radial-gradient(2px 2px at 74% 66%, #e2e8f0, transparent)'
        }}
      />
      <div className="relative z-10 text-center max-w-xl w-full space-y-5">
        <div className="h-28 flex items-center justify-center overflow-hidden">
          {ejectedColor ? (
            <canvas ref={spriteRef} width={96} height={96} className="w-24 h-24 au-eject-drift" />
          ) : (
            <div className="px-5 py-2.5 rounded-full border border-cyan-400/50 bg-slate-900/90 font-orbitron text-xs font-black tracking-[0.28em] text-cyan-300 shadow-[0_0_24px_rgba(56,189,248,0.25)]">
              AIRLOCK REMAINED CLOSED
            </div>
          )}
        </div>
        <div className="text-xl sm:text-3xl font-black text-white tracking-wide au-cutin-pop">{text}</div>
        <div className="text-sm sm:text-base font-bold text-cyan-300">{subtext}</div>
      </div>
    </div>
  );
};

/* 5. ゲーム終了時：Among Us風 VICTORY / DEFEAT + 役職・貢献度1位・キルタイムライン総括画面 */
export const GameOverModal: React.FC<{
  open: boolean;
  winner: string;
  reason: string;
  players: Record<string, PlayerState>;
  killTimeline?: KillEvent[];
  myId: string;
  isHost: boolean;
  onBackToLobby: () => void;
}> = ({ open, winner, reason, players, killTimeline = [], myId, isHost, onBackToLobby }) => {
  const lineupRef = useRef<HTMLCanvasElement | null>(null);

  const allList = Object.values(players);
  const me = players[myId];

  const iWon = Boolean(
    me &&
      ((me.alive && me.role === 'survivor') ||
        (winner === 'crewmates' && hasCrewTasks(me.role)) ||
        (winner === 'impostors' && isImpostorTeam(me.role)) ||
        (winner === 'jester' && me.role === 'jester') ||
        (winner === 'jackal' && me.role === 'jackal') ||
        (winner === 'arsonist' && me.role === 'arsonist'))
  );

  let titleText = 'IMPOSTORS WIN!';
  let titleColor = '#f43f5e';
  if (winner === 'crewmates') {
    titleText = 'CREWMATES WIN!';
    titleColor = '#38bdf8';
  } else if (winner === 'jester') {
    titleText = 'JESTER WINS!';
    titleColor = '#f472b6';
  } else if (winner === 'jackal') {
    titleText = 'JACKAL WINS!';
    titleColor = '#fb923c';
  } else if (winner === 'arsonist') {
    titleText = 'ARSONIST WINS!';
    titleColor = '#f97316';
  }

  const winningMembers = useMemo(() => {
    return allList
      .filter((p) => {
        if (p.alive && p.role === 'survivor') return true;
        if (winner === 'crewmates') return hasCrewTasks(p.role);
        if (winner === 'impostors') return isImpostorTeam(p.role);
        return p.role === winner;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        hat: p.hat,
        pet: p.pet,
        isHighlight: p.id === myId
      }));
  }, [allList, myId, winner]);

  const topTaskPlayer = useMemo(() => {
    const candidates = allList.filter((p) => hasCrewTasks(p.role) && (p.tasksDone || 0) > 0);
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => (b.tasksDone || 0) - (a.tasksDone || 0))[0];
  }, [allList]);

  useEffect(() => {
    if (!open || !lineupRef.current) return;
    renderCrewmateLineupCanvas({
      canvas: lineupRef.current,
      members:
        winningMembers.length > 0
          ? winningMembers
          : allList.slice(0, 5).map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              hat: p.hat,
              pet: p.pet,
              isHighlight: p.id === myId
            })),
      glowColor: titleColor
    });
  }, [allList, myId, open, titleColor, winningMembers]);

  if (!open) return null;

  const survivingSurvivors = allList.filter((p) => p.alive && p.role === 'survivor');

  return (
    <div
      data-testid="gameover-overlay"
      className="fixed inset-0 z-50 bg-[#02050e]/95 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        className="sf-panel rounded-3xl p-4 sm:p-6 w-full max-w-3xl text-center space-y-3.5 border-2 au-cutin-pop max-h-[94vh] overflow-y-auto"
        style={{ borderColor: `${titleColor}99` }}
      >
        <div className="space-y-1">
          <div
            className={`font-orbitron text-3xl sm:text-5xl font-black tracking-widest ${
              iWon ? 'text-cyan-300' : 'text-rose-400'
            }`}
          >
            {iWon ? 'VICTORY' : 'DEFEAT'}
          </div>
          <div className="font-orbitron text-base sm:text-xl font-black" style={{ color: titleColor }}>
            {titleText}
          </div>
          <p className="text-xs sm:text-sm text-slate-300">{reason}</p>
        </div>

        {/* 勝者スポットライトラインナップ */}
        <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-2">
          <canvas ref={lineupRef} width={540} height={132} className="w-full h-32 block" />
        </div>

        {/* タスク貢献度1位（MVP）＆ 追加生存者 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/50 px-3 py-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-orbitron font-bold text-amber-300">TASK MVP / タスク貢献度1位</div>
              <div className="text-xs sm:text-sm font-black text-white">
                {topTaskPlayer ? `🏆 ${topTaskPlayer.name}` : '該当者なし'}
              </div>
            </div>
            {topTaskPlayer && (
              <span className="font-orbitron font-black text-sm text-amber-300 tabular-nums whitespace-nowrap">
                {topTaskPlayer.tasksDone} タスク完了
              </span>
            )}
          </div>
          <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 px-3 py-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-orbitron font-bold text-cyan-300">MATCH SUMMARY</div>
              <div className="text-xs font-bold text-slate-200">
                生存 {allList.filter((p) => p.alive).length}/{allList.length} 人 · 発生事件 {killTimeline.length} 件
              </div>
            </div>
            {survivingSurvivors.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-300 truncate">
                🦺 {survivingSurvivors.map((s) => s.name).join(', ')}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
          {/* 全プレイヤーの役職＆戦績 */}
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1.5 max-h-52 overflow-y-auto text-xs">
            <div className="text-[11px] font-orbitron font-bold text-cyan-300 border-b border-slate-800 pb-1">
              CREW ROSTER / 役職＆貢献一覧
            </div>
            {allList.map((p) => {
              const r = ROLES_DEF[p.role] || ROLES_DEF.crewmate;
              const cObj = CREW_COLORS.find((c) => c.id === p.color) || CREW_COLORS[0];
              const isMvp = topTaskPlayer?.id === p.id;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/80 last:border-none">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-3 h-3 rounded-full border border-white/60 shrink-0" style={{ background: cObj.hex }} />
                    <span className="font-bold text-white truncate">{p.name}</span>
                    {isMvp && <span className="text-[10px] text-amber-300 font-black shrink-0">🏆1位</span>}
                    <span className={`text-[10px] shrink-0 ${p.alive ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {p.alive ? '生存' : '脱落'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-300 tabular-nums whitespace-nowrap">
                      {hasCrewTasks(p.role) ? `課題 ${p.tasksDone || 0}` : `撃破 ${p.killsCount || 0}`}
                    </span>
                    <span className="font-orbitron font-bold whitespace-nowrap" style={{ color: r.color }}>
                      {r.jp}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 誰が誰をキル/追放したか タイムライン */}
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800 space-y-1.5 max-h-52 overflow-y-auto text-xs">
            <div className="text-[11px] font-orbitron font-bold text-rose-300 border-b border-slate-800 pb-1">
              KILL &amp; EJECT TIMELINE / 事件タイムライン
            </div>
            {killTimeline.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-[11px]">
                この試合ではキル・追放イベントは発生しませんでした
              </div>
            ) : (
              killTimeline.map((ev) => {
                const methodLabel =
                  ev.method === 'eject' ? '追放' : ev.method === 'misfire' ? '誤射自爆' : 'キル';
                const badgeColor =
                  ev.method === 'eject'
                    ? 'text-amber-300 border-amber-400/50 bg-amber-500/15'
                    : 'text-rose-300 border-rose-400/50 bg-rose-500/15';
                return (
                  <div key={ev.id} className="py-1 border-b border-slate-800/80 last:border-none space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-orbitron text-[10px] text-cyan-300 tabular-nums">
                        {Math.floor(ev.timeSec)}s · {ev.roomName}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black whitespace-nowrap ${badgeColor}`}>
                        {methodLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-100">
                      {ev.method === 'eject' ? (
                        <span>
                          🚀 <strong className="text-amber-300">{ev.victimName}</strong> が追放された
                        </span>
                      ) : ev.method === 'misfire' ? (
                        <span>
                          💥 <strong className="text-yellow-300">{ev.victimName}</strong> が誤射により脱落
                        </span>
                      ) : (
                        <span>
                          🔪 <strong className="text-rose-300">{ev.killerName}</strong> →{' '}
                          <strong className="text-white">{ev.victimName}</strong> を排除
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button
          type="button"
          data-start="true"
          onClick={onBackToLobby}
          className="sf-btn w-full py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm sm:text-base"
        >
          {isHost ? '🛸 待機デッキへ戻る（全員をロビーへ戻す）' : '🛸 待機デッキへ戻る'}
        </button>
      </div>
    </div>
  );
};
