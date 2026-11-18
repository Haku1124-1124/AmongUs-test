import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CREW_COLORS, CREW_HATS, CREW_PETS, KILL_EFFECTS } from '../game/constants';
import { drawPetSprite, getHatThumbnailUrl, getPetThumbnailUrl } from '../game/cosmetics';
import { MAPS_DEF } from '../game/maps';
import { drawCrewmateSprite } from '../game/renderer';

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  mapId: string;
  mapName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  isPublic: boolean;
  updatedAt: number;
}

interface TitleScreenProps {
  myName: string;
  myColor: string;
  myHat: string;
  myPet: string;
  myKillEffect: string;
  isPublicRoom: boolean;
  publicRooms: Record<string, PublicRoomSummary>;
  onChangeName: (name: string) => void;
  onChangeColor: (colorId: string) => void;
  onChangeHat: (hatId: string) => void;
  onChangePet: (petId: string) => void;
  onChangeKillEffect: (effectId: string) => void;
  onToggleVisibility: (pub: boolean) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onQuickSoloStart: () => void;
  onRefreshPublicRooms: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  myName,
  myColor,
  myHat,
  myPet,
  myKillEffect,
  isPublicRoom,
  publicRooms,
  onChangeName,
  onChangeColor,
  onChangeHat,
  onChangePet,
  onChangeKillEffect,
  onToggleVisibility,
  onCreateRoom,
  onJoinRoom,
  onQuickSoloStart,
  onRefreshPublicRooms
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [joinCode, setJoinCode] = useState('');

  const hatThumbs = useMemo(() => {
    const map: Record<string, string> = {};
    for (const h of CREW_HATS) {
      map[h.id] = getHatThumbnailUrl(h.id);
    }
    return map;
  }, []);

  const petThumbs = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of CREW_PETS) {
      map[p.id] = getPetThumbnailUrl(p.id, myColor);
    }
    return map;
  }, [myColor]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = 128;
    canvas.height = 112;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 128, 112);
    ctx.save();
    ctx.translate(myPet !== 'none' ? 76 : 64, 70);
    ctx.scale(1.32, 1.32);
    if (myPet !== 'none') {
      drawPetSprite(ctx, -28, 12, myPet, myColor, 1, false, 0);
    }
    drawCrewmateSprite(ctx, 0, 0, myColor, myHat, 1, true, false, 1, false, 0);
    ctx.restore();
  }, [myColor, myHat, myPet]);

  const curColor = CREW_COLORS.find((c) => c.id === myColor) || CREW_COLORS[0];
  const curHat = CREW_HATS.find((h) => h.id === myHat) || CREW_HATS[0];
  const curPet = CREW_PETS.find((p) => p.id === myPet) || CREW_PETS[0];
  const curKillEff = KILL_EFFECTS.find((k) => k.id === myKillEffect) || KILL_EFFECTS[0];

  const roomsList = Object.values(publicRooms).sort((a, b) => {
    if (a.phase === 'lobby' && b.phase !== 'lobby') return -1;
    if (a.phase !== 'lobby' && b.phase === 'lobby') return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  const openCount = roomsList.filter((r) => r.phase === 'lobby' && r.playerCount < (r.maxPlayers || 15)).length;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col justify-center">
      {/* ヒーロータイトル */}
      <div className="text-center mb-5 space-y-1.5">
        <div className="inline-flex items-center justify-center gap-2.5 text-cyan-300/90 text-[11px] sm:text-xs font-orbitron font-bold tracking-[0.22em]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" stroke="currentColor" strokeWidth="1.8" fill="rgba(34,211,238,0.22)" />
          </svg>
          <span>15 STAGES · 20 ROLES · 40 COSMETICS</span>
        </div>
        <h1 className="font-orbitron text-2xl sm:text-4xl md:text-5xl font-black tracking-wider text-white drop-shadow-[0_4px_24px_rgba(34,211,238,0.22)]">
          STARSHIP IMPOSTOR DELUXE
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          リアルタイム視界遮蔽・固有ギミック搭載の15ステージ＆20役職で繰り広げる本格宇宙船人狼アクション
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* 左カラム：クルーカスタマイズ */}
        <section className="lg:col-span-6 sf-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="font-orbitron text-sm font-bold text-cyan-300 tracking-wider flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="6" y="4" width="12" height="15" rx="6" stroke="#67e8f9" strokeWidth="2" />
                  <rect x="11" y="7" width="8" height="5" rx="2.5" fill="#bae6fd" />
                  <path d="M8 19V21M16 19V21" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>CREW CUSTOMIZE</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-400">クルー外見設定</span>
            </div>

            <div>
              <label htmlFor="player-name-input" className="block text-xs font-bold text-slate-300 mb-1.5">
                プレイヤー名（最大10文字）
              </label>
              <input
                id="player-name-input"
                type="text"
                maxLength={10}
                value={myName}
                onChange={(e) => onChangeName(e.target.value)}
                placeholder="クルー名を入力..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700/90 focus:border-cyan-400 focus:outline-none text-white font-bold text-sm transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-300">宇宙服カラー（15色）</span>
                <span className="text-xs text-cyan-300 font-bold">{curColor.name}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {CREW_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`宇宙服カラー ${c.name}`}
                    onClick={() => onChangeColor(c.id)}
                    className={`sf-btn h-7 rounded-lg border-2 ${
                      myColor === c.id
                        ? 'border-white scale-105 shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                        : 'border-slate-700/80 opacity-80 hover:opacity-100'
                    }`}
                    style={{ background: c.hex }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-300">アクセサリー / 装飾品（40種）</span>
                <span className="text-xs text-amber-300 font-bold">{curHat.name}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {CREW_HATS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onChangeHat(h.id)}
                    className={`sf-btn px-1 py-1.5 rounded-lg border text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 ${
                      myHat === h.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.22)]'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {hatThumbs[h.id] ? (
                      <img
                        src={hatThumbs[h.id]}
                        alt={h.name}
                        className="w-8 h-8 object-contain pointer-events-none"
                      />
                    ) : (
                      <span className="text-sm">{h.icon}</span>
                    )}
                    <span className="truncate w-full text-center text-[10px]">{h.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-300">ミニペット（9種・歩行追従）</span>
                <span className="text-xs text-emerald-300 font-bold">{curPet.name}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 max-h-28 overflow-y-auto pr-1">
                {CREW_PETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChangePet(p.id)}
                    className={`sf-btn px-1 py-1.5 rounded-lg border text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 ${
                      myPet === p.id
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.22)]'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600'
                    }`}
                    title={p.desc}
                  >
                    {petThumbs[p.id] && (
                      <img src={petThumbs[p.id]} alt={p.name} className="w-7 h-7 object-contain pointer-events-none" />
                    )}
                    <span className="truncate w-full text-center">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-300">やられ演出 / キルエフェクト（6種）</span>
                <span className="text-xs font-bold" style={{ color: curKillEff.accent }}>{curKillEff.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {KILL_EFFECTS.map((ef) => (
                  <button
                    key={ef.id}
                    type="button"
                    onClick={() => onChangeKillEffect(ef.id)}
                    className={`sf-btn px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      myKillEffect === ef.id
                        ? 'bg-slate-800 text-white shadow'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600'
                    }`}
                    style={myKillEffect === ef.id ? { borderColor: ef.accent, boxShadow: `0 0 12px ${ef.accent}44` } : undefined}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ef.accent }} />
                    <span className="truncate">{ef.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/90 border border-slate-800/90 p-3 flex items-center gap-4">
            <canvas
              ref={previewCanvasRef}
              className="w-28 h-24 rounded-xl bg-slate-900 border border-slate-700/80 shrink-0"
            />
            <div className="text-xs space-y-1 min-w-0">
              <div className="font-black text-base text-white truncate">{myName || 'CREW'}</div>
              <div className="text-cyan-300 font-bold truncate">
                {curColor.name} · {curHat.name}
              </div>
              <div className="text-emerald-300 font-bold truncate">
                ペット: {curPet.name} · 演出: {curKillEff.name}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                選択したスーツ・装飾・ペット・特殊やられ演出はロビーや対戦中に反映されます
              </p>
            </div>
          </div>
        </section>

        {/* 右カラム：オンラインルーム作成・参加 */}
        <section className="lg:col-span-6 sf-panel rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="font-orbitron text-sm font-bold text-rose-300 tracking-wider flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="#fda4af" strokeWidth="1.8" />
                  <path d="M3.6 9H20.4M3.6 15H20.4M12 3C14.8 6 14.8 18 12 21M12 3C9.2 6 9.2 18 12 21" stroke="#fda4af" strokeWidth="1.5" />
                </svg>
                <span>MISSION LAUNCH</span>
              </h2>
              <span className="text-[11px] font-bold text-slate-400">オンライン / ソロ出撃</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-white">宇宙船ルームを作成</div>
                  <div className="text-xs text-slate-400">
                    15ステージや20種類の役職ルールを自由に編成できます
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(true)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      isPublicRoom ? 'bg-cyan-400 text-slate-950 font-black' : 'text-slate-300 font-bold'
                    }`}
                  >
                    公開
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleVisibility(false)}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      !isPublicRoom ? 'bg-rose-500 text-white font-black' : 'text-slate-300 font-bold'
                    }`}
                  >
                    非公開
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={onCreateRoom}
                  className="sm:col-span-8 sf-btn py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-black text-sm sm:text-base shadow-[0_0_24px_rgba(56,189,248,0.35)]"
                >
                  ＋ ルームを作成して待機デッキへ
                </button>
                <button
                  type="button"
                  onClick={onQuickSoloStart}
                  className="sm:col-span-4 sf-btn py-3 px-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_16px_rgba(16,185,129,0.28)]"
                >
                  ▶ すぐAI対戦
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/85 border border-rose-500/30 space-y-2.5">
              <label htmlFor="join-code-input" className="block font-bold text-sm text-white">
                ルームコードで参加
              </label>
              <div className="flex gap-2">
                <input
                  id="join-code-input"
                  type="text"
                  maxLength={5}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="例: AB12C"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-400 focus:outline-none text-white font-orbitron font-black text-base sm:text-lg tracking-widest uppercase"
                />
                <button
                  type="button"
                  onClick={() => onJoinRoom(joinCode)}
                  className="sf-btn px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-sm"
                >
                  参加する
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/35 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-orbitron text-xs font-bold text-emerald-300">PUBLIC ROOMS</span>
                  <span className="text-[11px] font-bold text-emerald-200 tabular-nums">
                    {openCount > 0 ? `${openCount}件 募集中` : `${roomsList.length}件 公開中`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRefreshPublicRooms}
                  className="sf-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-cyan-200"
                >
                  更新
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-0.5 text-xs">
                {roomsList.length === 0 ? (
                  <div className="py-3 px-2 text-center text-slate-400 text-[11px] leading-relaxed">
                    現在公開中のルームはありません。「公開」を選択してルームを作成すると一覧に表示されます
                  </div>
                ) : (
                  roomsList.map((r) => {
                    const mapObj = MAPS_DEF[r.mapId] || MAPS_DEF.starship;
                    const isJoinable = r.phase === 'lobby' && (r.playerCount || 1) < (r.maxPlayers || 15);
                    return (
                      <div
                        key={r.code}
                        className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-700/80 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-orbitron font-black text-xs text-cyan-300 tracking-wider">
                              {r.code}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-300">
                              {r.phase === 'lobby' ? '募集中' : '対戦中'}
                            </span>
                            <span className="font-bold text-xs text-white truncate">{r.hostName}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">{mapObj.name}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-slate-300 tabular-nums">
                            {r.playerCount || 1}/{r.maxPlayers || 15}
                          </span>
                          <button
                            type="button"
                            disabled={!isJoinable}
                            onClick={() => onJoinRoom(r.code)}
                            className={`sf-btn px-3 py-1.5 rounded-lg font-black text-xs ${
                              isJoinable
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {isJoinable ? '参加 ▶' : '参加不可'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="text-xs font-bold text-cyan-300">収録15ステージ（固有ギミック＆壁遮蔽視界対応）</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] text-slate-300 max-h-24 overflow-y-auto pr-0.5">
                {Object.values(MAPS_DEF).map((m, idx) => (
                  <div key={m.id} className="px-2 py-1 rounded-md bg-slate-900/90 border border-slate-800 truncate">
                    {idx + 1}. {m.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>操作: WASD移動 · E 実行 · R 通報 · Q キル · V ベント · C 能力 · M マップ</span>
          </div>
        </section>
      </div>
    </main>
  );
};
