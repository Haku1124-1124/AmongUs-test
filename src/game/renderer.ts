import { CREW_COLORS } from './constants';
import { drawHat, drawKillEffectBurst, drawPetSprite, KillEffectBurst } from './cosmetics';
import { MapDef, MapGimmick, MapRect } from './maps';
import { PlayerState } from './rules';
import { computeVisibilityPolygon, extractMapWallSegments, hasLineOfSight, WallSegment } from './vision';

const petTrailMap = new Map<string, { x: number; y: number }>();

export interface BodyState {
  id: string;
  playerId: string;
  name: string;
  color: string;
  killerColor: string;
  killedAt: number;
  dissolveTimer: number | null;
  x: number;
  y: number;
}

export interface AbilityTrace {
  x: number;
  y: number;
  timer: number;
}

export interface RenderGameParams {
  canvas: HTMLCanvasElement;
  mapDef: MapDef;
  me: PlayerState;
  players: Record<string, PlayerState>;
  bodies: BodyState[];
  abilityTraces: AbilityTrace[];
  killBursts?: KillEffectBurst[];
  myTasks: string[];
  completedTasks: Record<string, boolean>;
  hasTasks: boolean;
  sabotage: { type: 'lights' | 'reactor'; timer: number } | null;
  visionRadius: number;
  closedDoors: MapRect[];
  anyCameraActive: boolean;
  cameraWatchTimer: number;
  cameraWatchTarget: { x: number; y: number; label?: string } | null;
  sonarPingTimer: number;
  psychicTimer: number;
  oiledPlayers: Record<string, boolean>;
  crystalBeaconTimer: number;
  sandstormActive: boolean;
  steamActive: boolean;
  bellRingTimer: number;
  bellPos: { x: number; y: number } | null;
  hauntedTimer?: number;
  nowMs: number;
}

const staticMapCanvasCache = new Map<string, HTMLCanvasElement>();
const baseWallSegmentsCache = new Map<string, WallSegment[]>();

function getBaseWallSegments(mapDef: MapDef): WallSegment[] {
  let cached = baseWallSegmentsCache.get(mapDef.id);
  if (!cached) {
    cached = extractMapWallSegments(mapDef, []);
    baseWallSegmentsCache.set(mapDef.id, cached);
  }
  return cached;
}

function computeMapBounds(mapDef: MapDef) {
  let minX = 2000;
  let minY = 1300;
  let maxX = 0;
  let maxY = 0;
  for (const r of [...mapDef.rooms, ...mapDef.corridors]) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function drawExteriorHullDecorations(ctx: CanvasRenderingContext2D, mapDef: MapDef) {
  const b = computeMapBounds(mapDef);
  const theme = mapDef.exteriorTheme || 'space';

  ctx.save();

  if (theme === 'space' || theme === 'moon' || theme === 'cyber' || theme === 'clouds') {
    // 宇宙船・空中艦のアウターハルウィング / ソーラーパネル / エンジンポッド
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = mapDef.wallColor || '#475569';
    ctx.lineWidth = 4;

    // 上下スタビライザー翼
    ctx.beginPath();
    ctx.moveTo(b.cx - 260, b.minY);
    ctx.lineTo(b.cx - 120, Math.max(18, b.minY - 82));
    ctx.lineTo(b.cx + 180, Math.max(18, b.minY - 82));
    ctx.lineTo(b.cx + 290, b.minY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b.cx - 240, b.maxY);
    ctx.lineTo(b.cx - 110, Math.min(1322, b.maxY + 82));
    ctx.lineTo(b.cx + 160, Math.min(1322, b.maxY + 82));
    ctx.lineTo(b.cx + 270, b.maxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ソーラーアレイ（左右外周）
    const panels = [
      { x: Math.max(20, b.minX - 96), y: b.cy - 170, w: 72, h: 120 },
      { x: Math.max(20, b.minX - 96), y: b.cy + 50, w: 72, h: 120 },
      { x: Math.min(1980, b.maxX + 24), y: b.cy - 150, w: 72, h: 110 }
    ];
    for (const p of panels) {
      ctx.fillStyle = '#082f49';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(125,211,252,0.28)';
      ctx.lineWidth = 1;
      for (let gx = p.x + 18; gx < p.x + p.w; gx += 18) {
        ctx.beginPath(); ctx.moveTo(gx, p.y); ctx.lineTo(gx, p.y + p.h); ctx.stroke();
      }
      for (let gy = p.y + 24; gy < p.y + p.h; gy += 24) {
        ctx.beginPath(); ctx.moveTo(p.x, gy); ctx.lineTo(p.x + p.w, gy); ctx.stroke();
      }
      // 接続ストラット
      ctx.fillStyle = '#475569';
      ctx.fillRect(p.x < b.cx ? p.x + p.w : p.x - 24, p.y + p.h / 2 - 7, 24, 14);
    }

    // 左端メインイオンスラスターポッド（3基）
    const thrusterYs = [b.cy - 190, b.cy, b.cy + 190];
    for (const ty of thrusterYs) {
      const tx = Math.max(26, b.minX - 58);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx + 58, ty - 34);
      ctx.lineTo(tx, ty - 22);
      ctx.lineTo(tx, ty + 22);
      ctx.lineTo(tx + 58, ty + 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 右端アンテナ＆通信ディッシュ
    const dx = Math.min(1995, b.maxX + 40);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.maxX, b.cy - 60);
    ctx.lineTo(dx + 24, b.cy - 60);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(dx + 26, b.cy - 60, 14, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.fill();
    ctx.stroke();
  } else {
    // 惑星マップ外周の地形アクセント（雪山・溶岩割れ目・結晶柱・樹木）
    const ringCount = 26;
    for (let i = 0; i < ringCount; i++) {
      const ang = (i / ringCount) * Math.PI * 2;
      const rx = b.cx + Math.cos(ang) * ((b.maxX - b.minX) * 0.56 + 68);
      const ry = b.cy + Math.sin(ang) * ((b.maxY - b.minY) * 0.56 + 58);
      if (rx < 24 || rx > 2056 || ry < 24 || ry > 1316) continue;

      if (theme === 'snow') {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.38)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 42, 26, ang, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (theme === 'lava') {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.28)';
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 34, 20, ang * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (theme === 'crystal') {
        ctx.fillStyle = 'rgba(45, 212, 191, 0.24)';
        ctx.strokeStyle = '#5eead4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 26);
        ctx.lineTo(rx + 18, ry + 14);
        ctx.lineTo(rx - 18, ry + 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (theme === 'jungle') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (theme === 'ocean') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(217, 119, 6, 0.22)';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 38, 22, ang, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function getOrBuildStaticMapCanvas(mapDef: MapDef, baseWalls: WallSegment[]): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cached = staticMapCanvasCache.get(mapDef.id);
  if (cached) return cached;

  const off = document.createElement('canvas');
  off.width = 2080;
  off.height = 1340;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  // 0. 船体・惑星外周ランドマーク装飾
  drawExteriorHullDecorations(ctx, mapDef);

  // 1. 船体アウターハル（3層ベベル外壁・Among Us重厚フレーミング）
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#030610';
  ctx.lineWidth = 34;
  for (const c of mapDef.corridors) ctx.strokeRect(c.x, c.y, c.w, c.h);
  for (const r of mapDef.rooms) {
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.stroke();
  }

  ctx.strokeStyle = mapDef.wallColor || '#334155';
  ctx.lineWidth = 24;
  for (const c of mapDef.corridors) ctx.strokeRect(c.x, c.y, c.w, c.h);
  for (const r of mapDef.rooms) {
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16);
    ctx.stroke();
  }

  // 外壁のリベットボルト装飾
  ctx.fillStyle = 'rgba(226, 232, 240, 0.26)';
  for (const r of mapDef.rooms) {
    for (let rx = r.x + 28; rx < r.x + r.w - 20; rx += 68) {
      ctx.beginPath();
      ctx.arc(rx, r.y - 7, 2.2, 0, Math.PI * 2);
      ctx.arc(rx, r.y + r.h + 7, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. 通路床と部屋床
  ctx.fillStyle = mapDef.corridorFill;
  for (const c of mapDef.corridors) {
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    if (c.w > c.h) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + c.h / 2);
      ctx.lineTo(c.x + c.w, c.y + c.h / 2);
      ctx.stroke();
      for (let tx = c.x + 48; tx < c.x + c.w - 20; tx += 76) {
        ctx.beginPath();
        ctx.moveTo(tx, c.y + 4);
        ctx.lineTo(tx, c.y + c.h - 4);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(c.x + c.w / 2, c.y);
      ctx.lineTo(c.x + c.w / 2, c.y + c.h);
      ctx.stroke();
      for (let ty = c.y + 48; ty < c.y + c.h - 20; ty += 76) {
        ctx.beginPath();
        ctx.moveTo(c.x + 4, ty);
        ctx.lineTo(c.x + c.w - 4, ty);
        ctx.stroke();
      }
    }
  }

  for (const r of mapDef.rooms) {
    drawRoomFloorPattern(ctx, r);
    ctx.font = '900 18px "Noto Sans JP", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, r.x + r.w / 2, r.y + r.h / 2);
  }

  // 3. 正確な境界壁ライン（外壁＆出入口フレーム）
  ctx.strokeStyle = mapDef.accent;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of baseWalls) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();

  // 4. 緊急会議テーブル（椅子＆ガラスドーム緊急ボタン）
  const em = mapDef.emergency;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(em.x + Math.cos(a) * 54, em.y + Math.sin(a) * 54, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(em.x, em.y, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(em.x, em.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(em.x, em.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.48)';
  ctx.beginPath();
  ctx.arc(em.x - 4, em.y - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  // 5. ベント（ボルト止めルーバー蓋）
  for (const v of mapDef.vents) {
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(v.x - 20, v.y - 14, 40, 28, 5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.2;
    for (let sy = v.y - 8; sy <= v.y + 8; sy += 5) {
      ctx.beginPath(); ctx.moveTo(v.x - 14, sy); ctx.lineTo(v.x + 14, sy); ctx.stroke();
    }
    ctx.fillStyle = '#cbd5e1';
    for (const [bx, by] of [[v.x - 16, v.y - 10], [v.x + 16, v.y - 10], [v.x - 16, v.y + 10], [v.x + 16, v.y + 10]]) {
      ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  staticMapCanvasCache.set(mapDef.id, off);
  return off;
}

export function drawCrewmateSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorId: string,
  hatId: string,
  facing = 1,
  isAlive = true,
  isGhost = false,
  alpha = 1,
  isShielded = false,
  nowMs = 0
) {
  const cObj = CREW_COLORS.find((c) => c.id === colorId) || CREW_COLORS[0];
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = isGhost ? 0.45 : alpha;

  if (isShielded && isAlive) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -4, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (!isAlive && !isGhost) {
    ctx.fillStyle = cObj.hex;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-18, -4, 34, 22, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.rect(-3, -15, 7, 13);
    ctx.arc(-2, -16, 4.5, 0, Math.PI * 2);
    ctx.arc(4, -16, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.scale(facing, 1);

  if (!isGhost) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 22, 17, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = cObj.dark;
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-21, -8, 10, 22, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = cObj.hex;
  ctx.beginPath();
  ctx.roundRect(-14, -22, 28, 36, 14);
  ctx.fill();
  ctx.stroke();

  if (!isGhost) {
    ctx.fillRect(-12, 10, 9, 11);
    ctx.strokeRect(-12, 10, 9, 11);
    ctx.fillRect(3, 10, 9, 11);
    ctx.strokeRect(3, 10, 9, 11);
  }

  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.roundRect(-2, -14, 18, 11, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(8, -11, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (hatId && hatId !== 'none') {
    drawHat(ctx, hatId, cObj.hex, nowMs);
  }

  ctx.restore();
}

function drawRoomFloorPattern(ctx: CanvasRenderingContext2D, r: MapDef['rooms'][0]) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.clip();

  ctx.fillStyle = r.color;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const style = r.floorStyle || 'metal';
  if (style === 'tile') {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = r.x; x < r.x + r.w; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    }
    for (let y = r.y; y < r.y + r.h; y += 44) {
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
  } else if (style === 'lab') {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
    ctx.lineWidth = 1;
    for (let x = r.x; x < r.x + r.w; x += 36) {
      ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    }
    for (let y = r.y; y < r.y + r.h; y += 36) {
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
  } else if (style === 'cargo') {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 8;
    for (let x = r.x - r.h; x < r.x + r.w; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x + r.h, r.y + r.h); ctx.stroke();
    }
  } else if (style === 'cyber') {
    ctx.strokeStyle = 'rgba(232, 121, 249, 0.1)';
    ctx.lineWidth = 1.5;
    for (let x = r.x + 24; x < r.x + r.w; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    }
    for (let y = r.y + 24; y < r.y + r.h; y += 64) {
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
  } else if (style === 'carpet') {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fillRect(r.x + 24, r.y + 24, r.w - 48, r.h - 48);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 24, r.y + 24, r.w - 48, r.h - 48);
  } else if (style === 'metal') {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1.5;
    for (let x = r.x; x < r.x + r.w; x += 72) {
      ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    }
    for (let y = r.y; y < r.y + r.h; y += 56) {
      ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    }
  }

  // 内壁インセットフレーム＆上部の壁の立体影
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24);

  const topGrad = ctx.createLinearGradient(0, r.y, 0, r.y + 26);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.48)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(r.x, r.y, r.w, 26);

  ctx.restore();
}

function drawPropsAndObstacles(ctx: CanvasRenderingContext2D, mapDef: MapDef, anyCameraActive: boolean, nowMs: number) {
  // 装飾プロップ
  for (const d of mapDef.decors) {
    ctx.save();
    if (d.kind === 'window') {
      ctx.fillStyle = '#020617';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(d.x, d.y, d.w, d.h, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(d.x + 4, d.y + 4, d.w - 8, d.h - 8);
      // 窓の中の星と斜めガラス反射
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(d.x + 10, d.y + 7, 2, 2);
      ctx.fillRect(d.x + d.w - 16, d.y + d.h - 10, 2.5, 2.5);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(d.x + 8, d.y + d.h - 5);
      ctx.lineTo(d.x + 22, d.y + 5);
      ctx.stroke();
    } else if (d.kind === 'med_scanner') {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(d.x, d.y, d.w, d.h, 12);
      ctx.fill();
      ctx.stroke();
      const pulse = 0.25 + 0.18 * Math.sin(nowMs * 0.005);
      ctx.fillStyle = `rgba(52, 211, 153, ${pulse})`;
      ctx.beginPath();
      ctx.arc(d.x + d.w / 2, d.y + d.h / 2, d.w * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 2;
      const rot = nowMs * 0.003;
      ctx.beginPath();
      ctx.arc(d.x + d.w / 2, d.y + d.h / 2, d.w * 0.25, rot, rot + Math.PI * 1.15);
      ctx.stroke();
    } else if (d.kind === 'med_bed') {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(d.x, d.y, d.w, d.h, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.roundRect(d.x + 6, d.y + 6, d.w - 12, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(d.x + 6, d.y + 24, d.w - 12, d.h - 30, 4);
      ctx.fill();
      // 心電モニター横付け
      ctx.fillStyle = '#020617';
      ctx.fillRect(d.x - 10, d.y + 6, 8, 12);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(d.x - 8, d.y + 10, 4, 2);
    } else if (d.kind === 'turret') {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(d.x, d.y, d.w, d.h, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(d.x + 8, d.y + 8, d.w - 16, 18);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(d.x + d.w / 2, d.y + 17, 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (d.kind === 'caution') {
      ctx.beginPath();
      ctx.rect(d.x, d.y, d.w, d.h);
      ctx.clip();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.lineWidth = 7;
      for (let sx = d.x - d.h; sx < d.x + d.w + d.h; sx += 18) {
        ctx.beginPath();
        ctx.moveTo(sx, d.y);
        ctx.lineTo(sx + d.h, d.y + d.h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'pipes') {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(d.x, d.y, d.w, 7);
      ctx.strokeRect(d.x, d.y, d.w, 7);
      ctx.fillRect(d.x, d.y + 12, d.w, 7);
      ctx.strokeRect(d.x, d.y + 12, d.w, 7);
      // フランジ継ぎ手＆バルブ
      ctx.fillStyle = '#94a3b8';
      for (let px = d.x + 28; px < d.x + d.w - 12; px += 64) {
        ctx.fillRect(px - 2, d.y - 2, 5, 23);
      }
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(d.x + d.w / 2, d.y + 3, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (d.kind === 'carpet') {
      ctx.fillStyle = 'rgba(190, 24, 93, 0.24)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'altar') {
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeRect(d.x, d.y, d.w, d.h);
    } else if (d.kind === 'server_wall') {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      for (let lx = d.x + 12; lx < d.x + d.w - 8; lx += 18) {
        ctx.fillStyle = Math.sin(nowMs * 0.005 + lx) > 0 ? '#22d3ee' : '#e879f9';
        ctx.fillRect(lx, d.y + 5, 6, 5);
      }
    } else if (d.kind === 'camera_prop') {
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const blink = anyCameraActive && Math.floor(nowMs / 350) % 2 === 0;
      ctx.fillStyle = blink ? '#ef4444' : (anyCameraActive ? '#991b1b' : '#334155');
      ctx.beginPath();
      ctx.arc(cx + 3, cy - 2, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 固体障害物（テーブル・木箱・サーバー・リアクター）
  for (const obs of mapDef.obstacles) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    if (obs.kind === 'table_round') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      const rad = obs.w / 2;
      ctx.beginPath(); ctx.arc(cx + 3, cy + 5, rad, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.beginPath(); ctx.arc(cx, cy, rad * 0.72, 0, Math.PI * 2); ctx.fill();
      // 小トレイ＆マグ
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(cx - 10, cy - 8, 12, 8);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(cx + 8, cy + 6, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (obs.kind === 'table_rect') {
      ctx.fillRect(obs.x + 3, obs.y + 5, obs.w, obs.h);
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(obs.x + 12, obs.y + 10, obs.w - 24, 8);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(obs.x + 12, obs.y + 24, 14, 6);
    } else if (obs.kind === 'crate') {
      ctx.fillRect(obs.x + 4, obs.y + 6, obs.w, obs.h);
      ctx.fillStyle = '#6b4c35';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#926c4c';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x + 6, obs.y + 6, obs.w - 12, obs.h - 12);
      ctx.beginPath();
      ctx.moveTo(obs.x + 6, obs.y + 6); ctx.lineTo(obs.x + obs.w - 6, obs.y + obs.h - 6);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(obs.x + obs.w - 14, obs.y + 4, 8, 5);
    } else if (obs.kind === 'server') {
      ctx.fillRect(obs.x + 4, obs.y + 6, obs.w, obs.h);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 6); ctx.fill(); ctx.stroke();
      for (let sy = obs.y + 10; sy < obs.y + obs.h - 12; sy += 16) {
        ctx.fillStyle = Math.sin(nowMs * 0.004 + sy) > 0 ? '#22d3ee' : '#34d399';
        ctx.fillRect(obs.x + 8, sy, obs.w - 16, 4);
      }
    } else if (obs.kind === 'reactor') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      ctx.fillRect(obs.x + 3, obs.y + 5, obs.w, obs.h);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 14); ctx.fill(); ctx.stroke();
      const glow = 0.55 + 0.35 * Math.sin(nowMs * 0.006);
      ctx.strokeStyle = `rgba(56, 189, 248, ${glow})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(obs.w, obs.h) * 0.38, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(56, 189, 248, ${glow})`;
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(obs.w, obs.h) * 0.25, 0, Math.PI * 2); ctx.fill();
    } else if (obs.kind === 'tank') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, obs.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(45, 212, 191, 0.38)';
      ctx.beginPath(); ctx.arc(cx, cy, obs.w * 0.34, 0, Math.PI * 2); ctx.fill();
    } else if (obs.kind === 'rock') {
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 16);
      ctx.fill();
      ctx.stroke();
    } else if (obs.kind === 'console') {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#020617';
      ctx.fillRect(obs.x + 6, obs.y + 6, obs.w - 12, Math.max(8, obs.h - 16));
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillRect(obs.x + 8, obs.y + 9, Math.max(6, (obs.w - 16) * 0.7), 3);
    }
    ctx.restore();
  }
}

function drawGimmickZonesAndTerminals(
  ctx: CanvasRenderingContext2D,
  mapDef: MapDef,
  closedDoors: MapRect[],
  steamActive: boolean,
  nowMs: number
) {
  for (const g of mapDef.gimmicks) {
    ctx.save();
    if (g.type === 'ice' && g.w && g.h) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, 14);
      const iceGrad = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
      iceGrad.addColorStop(0, 'rgba(186, 230, 253, 0.24)');
      iceGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.14)');
      iceGrad.addColorStop(1, 'rgba(224, 242, 254, 0.26)');
      ctx.fillStyle = iceGrad;
      ctx.fill();
      ctx.clip();

      // 光の反射シマー帯（斜めスライド）
      const shimmerOffset = ((nowMs * 0.09) % (g.w + g.h + 160)) - 80;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      ctx.moveTo(g.x + shimmerOffset, g.y);
      ctx.lineTo(g.x + shimmerOffset + 46, g.y);
      ctx.lineTo(g.x + shimmerOffset - 34, g.y + g.h);
      ctx.lineTo(g.x + shimmerOffset - 80, g.y + g.h);
      ctx.closePath();
      ctx.fill();

      // 煌めく結晶スパークル
      const sparkleCount = Math.max(4, Math.floor((g.w * g.h) / 14000));
      for (let i = 0; i < sparkleCount; i++) {
        const sx = g.x + ((i * 97 + 31) % Math.max(20, g.w - 24)) + 12;
        const sy = g.y + ((i * 67 + 29) % Math.max(20, g.h - 24)) + 12;
        const pulse = Math.max(0, Math.sin(nowMs * 0.005 + i * 1.7));
        if (pulse > 0.25) {
          const r = 3 + pulse * 4;
          ctx.strokeStyle = `rgba(224, 242, 254, ${0.35 + pulse * 0.55})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(sx - r, sy);
          ctx.lineTo(sx + r, sy);
          ctx.moveTo(sx, sy - r);
          ctx.lineTo(sx, sy + r);
          ctx.stroke();
        }
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, 14);
      ctx.stroke();
      ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.fillText('❄️ 凍結アイスフロア（滑走注意）', g.x + g.w / 2, g.y + 22);
    } else if (g.type === 'low_gravity' && g.w && g.h) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, 14);
      const lgGrad = ctx.createRadialGradient(
        g.x + g.w / 2,
        g.y + g.h / 2,
        12,
        g.x + g.w / 2,
        g.y + g.h / 2,
        Math.max(g.w, g.h) * 0.65
      );
      lgGrad.addColorStop(0, 'rgba(192, 132, 252, 0.22)');
      lgGrad.addColorStop(1, 'rgba(139, 92, 246, 0.08)');
      ctx.fillStyle = lgGrad;
      ctx.fill();
      ctx.clip();

      // 反重力波紋リング
      const ringPhase = (nowMs * 0.0008) % 1;
      const ringR = 24 + ringPhase * Math.min(g.w, g.h) * 0.48;
      ctx.strokeStyle = `rgba(216, 180, 254, ${(1 - ringPhase) * 0.48})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.x + g.w / 2, g.y + g.h / 2, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // 上昇する紫色の浮遊オーブ
      const orbCount = Math.max(6, Math.floor((g.w * g.h) / 9500));
      for (let i = 0; i < orbCount; i++) {
        const ox = g.x + ((i * 83 + 19) % Math.max(18, g.w - 16)) + 8 + Math.sin(nowMs * 0.003 + i) * 6;
        const rawY = ((i * 59 + nowMs * (0.03 + (i % 3) * 0.012)) % Math.max(24, g.h));
        const oy = g.y + g.h - rawY;
        const rad = 2.4 + (i % 3) * 1.4;
        ctx.fillStyle = `rgba(221, 214, 254, ${0.35 + Math.sin(nowMs * 0.006 + i) * 0.25})`;
        ctx.beginPath();
        ctx.arc(ox, oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(196, 181, 253, 0.68)';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#ede9fe';
      ctx.textAlign = 'center';
      ctx.fillText('🪐 低重力エリア（移動+18%）', g.x + g.w / 2, g.y + 22);
    } else if (g.type === 'conveyor' && g.w && g.h) {
      ctx.save();
      ctx.fillStyle = 'rgba(14, 116, 144, 0.28)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeRect(g.x, g.y, g.w, g.h);

      // 金属ガードレール
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(g.x, g.y, g.w, 6);
      ctx.fillRect(g.x, g.y + g.h - 6, g.w, 6);

      ctx.beginPath();
      ctx.rect(g.x, g.y + 6, g.w, Math.max(4, g.h - 12));
      ctx.clip();

      const dvx = g.vx || 0;
      const dvy = g.vy || 0;
      const dirAngle = Math.atan2(dvy, dvx || (dvy === 0 ? 1 : 0));
      const speedPx = Math.max(40, Math.hypot(dvx, dvy));
      const step = 38;
      const phase = (nowMs * 0.001 * speedPx * 0.72) % step;
      const cx = g.x + g.w / 2;
      const cy = g.y + g.h / 2;
      const span = Math.hypot(g.w, g.h) * 0.65;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dirAngle);
      for (let ax = -span + phase; ax <= span; ax += step) {
        const glow = 0.45 + 0.35 * Math.sin(nowMs * 0.008 - ax * 0.05);
        ctx.strokeStyle = `rgba(125, 211, 252, ${glow})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(ax - 10, -18);
        ctx.lineTo(ax + 6, 0);
        ctx.lineTo(ax - 10, 18);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();

      ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.fillText('⏩ リニア搬送レーン ⏩', g.x + g.w / 2, g.y + g.h / 2 + 4);
    } else if (g.type === 'spore_mist' && g.w && g.h) {
      ctx.fillStyle = 'rgba(132, 204, 22, 0.18)';
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.45)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 16); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#d9f99d';
      ctx.textAlign = 'center';
      ctx.fillText('🌿 胞子ミスト（視界制限）', g.x + g.w / 2, g.y + 22);
    } else if (g.type === 'steam_hazard' && g.w && g.h) {
      if (steamActive) {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 14); ctx.fill(); ctx.stroke();
        ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
        ctx.fillStyle = '#fed7aa';
        ctx.textAlign = 'center';
        ctx.fillText('💨 マグマ蒸気噴出中（視界制限）', g.x + g.w / 2, g.y + 22);
      } else {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.25)';
        ctx.setLineDash([4, 6]);
        ctx.strokeRect(g.x, g.y, g.w, g.h);
        ctx.setLineDash([]);
      }
    } else if (g.type === 'lockdown_door') {
      drawTerminalPad(ctx, g, '#f43f5e');
      if (g.doorRect) {
        const isClosed = closedDoors.some(
          (d) => d.x === g.doorRect!.x && d.y === g.doorRect!.y
        );
        if (isClosed) {
          ctx.fillStyle = 'rgba(225, 29, 72, 0.82)';
          ctx.strokeStyle = '#fda4af';
          ctx.lineWidth = 3;
          ctx.fillRect(g.doorRect.x, g.doorRect.y, g.doorRect.w, g.doorRect.h);
          ctx.strokeRect(g.doorRect.x, g.doorRect.y, g.doorRect.w, g.doorRect.h);
          ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText('🔒 封鎖中', g.doorRect.x + g.doorRect.w / 2, g.doorRect.y + g.doorRect.h / 2 + 4);
        } else {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          ctx.strokeRect(g.doorRect.x, g.doorRect.y, g.doorRect.w, g.doorRect.h);
          ctx.setLineDash([]);
        }
      }
    } else if (g.type === 'boost_vent') {
      drawTerminalPad(ctx, g, '#fb923c');
    } else {
      drawTerminalPad(ctx, g, '#38bdf8');
    }
    ctx.restore();
  }
}

function drawTerminalPad(ctx: CanvasRenderingContext2D, g: MapGimmick, color: string) {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(g.icon || '✨', g.x, g.y + 6);

  ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(g.label, g.x, g.y + 40);
}

function drawAnimatedSpaceBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camX: number,
  camY: number,
  mapDef: MapDef,
  nowMs: number
) {
  const theme = mapDef.exteriorTheme || 'space';

  // 星雲・遠景惑星
  if (theme === 'space' || theme === 'moon' || theme === 'cyber') {
    const px = ((w * 0.78 - camX * 0.04) % (w + 200));
    const py = ((h * 0.24 - camY * 0.04) % (h + 150));
    const grad = ctx.createRadialGradient(px - 14, py - 14, 6, px, py, 44);
    grad.addColorStop(0, theme === 'cyber' ? '#a855f7' : '#38bdf8');
    grad.addColorStop(1, '#090d16');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 44, 0, Math.PI * 2);
    ctx.fill();

    // 惑星の輪
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(px, py, 76, 16, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 多層視差スター・パーティクル
  const count = 68;
  for (let i = 0; i < count; i++) {
    const depth = i % 3 === 0 ? 0.18 : i % 3 === 1 ? 0.1 : 0.05;
    const sx = ((i * 197 - camX * depth) % w + w) % w;
    const sy = ((i * 131 - camY * depth + (theme === 'snow' ? nowMs * 0.025 : 0)) % h + h) % h;
    const sz = i % 5 === 0 ? 3 : i % 2 === 0 ? 2 : 1.4;
    const twinkle = 0.35 + 0.55 * Math.abs(Math.sin(nowMs * 0.002 + i));
    ctx.fillStyle =
      theme === 'lava'
        ? `rgba(251, 146, 60, ${twinkle})`
        : theme === 'jungle'
        ? `rgba(163, 230, 53, ${twinkle})`
        : `rgba(226, 232, 240, ${twinkle})`;
    ctx.fillRect(sx, sy, sz, sz);
  }
}

export function renderGameCanvasFrame(params: RenderGameParams) {
  const {
    canvas,
    mapDef,
    me,
    players,
    bodies,
    abilityTraces,
    killBursts = [],
    myTasks,
    completedTasks,
    hasTasks,
    sabotage,
    visionRadius,
    closedDoors,
    anyCameraActive,
    cameraWatchTimer,
    cameraWatchTarget,
    sonarPingTimer,
    psychicTimer,
    oiledPlayers,
    crystalBeaconTimer,
    sandstormActive,
    steamActive,
    bellRingTimer,
    bellPos,
    hauntedTimer = 0,
    nowMs
  } = params;

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isWatchingCam = cameraWatchTimer > 0 && Boolean(cameraWatchTarget);
  const camX = isWatchingCam && cameraWatchTarget ? cameraWatchTarget.x : me.x;
  const camY = isWatchingCam && cameraWatchTarget ? cameraWatchTarget.y : me.y;

  ctx.fillStyle = mapDef.bg;
  ctx.fillRect(0, 0, w, h);

  drawAnimatedSpaceBackdrop(ctx, w, h, camX, camY, mapDef, nowMs);

  const baseWalls = getBaseWallSegments(mapDef);
  const wallSegments: WallSegment[] =
    closedDoors.length === 0 ? baseWalls : extractMapWallSegments(mapDef, closedDoors);
  const staticLayer = getOrBuildStaticMapCanvas(mapDef, baseWalls);

  ctx.save();
  ctx.translate(w / 2 - camX, h / 2 - camY);

  if (staticLayer) {
    const sx = Math.max(0, Math.floor(camX - w / 2));
    const sy = Math.max(0, Math.floor(camY - h / 2));
    const sw = Math.min(staticLayer.width - sx, Math.ceil(camX + w / 2) - sx);
    const sh = Math.min(staticLayer.height - sy, Math.ceil(camY + h / 2) - sy);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(staticLayer, sx, sy, sw, sh, sx, sy, sw, sh);
    }
  }

  // 宇宙船マップのダイナミック・イオンスラスター噴射炎
  const theme = mapDef.exteriorTheme || 'space';
  if (theme === 'space' || theme === 'moon' || theme === 'cyber' || theme === 'clouds') {
    const b = computeMapBounds(mapDef);
    const tx = Math.max(26, b.minX - 58);
    const flicker = 34 + Math.sin(nowMs * 0.025) * 14;
    for (const ty of [b.cy - 190, b.cy, b.cy + 190]) {
      const grad = ctx.createLinearGradient(tx, ty, tx - flicker, ty);
      grad.addColorStop(0, 'rgba(103, 232, 249, 0.85)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.4)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 16);
      ctx.lineTo(tx - flicker, ty);
      ctx.lineTo(tx, ty + 16);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ギミック床・端末・プロップ・障害物
  drawGimmickZonesAndTerminals(ctx, mapDef, closedDoors, steamActive, nowMs);
  drawPropsAndObstacles(ctx, mapDef, anyCameraActive, nowMs);

  // 7. タスク地点ハイライト
  if (hasTasks) {
    for (const tid of myTasks) {
      if (completedTasks[tid]) continue;
      const spot = mapDef.taskSpots.find((s) => s.taskId === tid);
      if (!spot) continue;
      const pulse = 22 + Math.sin(nowMs * 0.006) * 3;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.24)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 8. サボタージュ修理地点
  if (sabotage) {
    const pt = mapDef.sabotageFix[sabotage.type];
    if (pt) {
      const pulse = 28 + Math.sin(nowMs * 0.01) * 5;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 9. サイキック霊視残滓
  if (me.role === 'psychic' && psychicTimer > 0) {
    for (const tr of abilityTraces) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
      ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#e9d5ff';
      ctx.textAlign = 'center';
      ctx.fillText('🔮 能力・殺害残滓', tr.x, tr.y - 40);
      ctx.restore();
    }
  }

  // 10. 視界線（壁遮蔽）判定付きで死体と他プレイヤーを描画
  const isImpTeam = ['impostor', 'phantom', 'madscientist', 'viper', 'shapeshifter'].includes(me.role);
  const sightMaxDist = isWatchingCam ? 320 : visionRadius + 24;

  const canSeeWorldPoint = (tx: number, ty: number) => {
    if (!me.alive && !isWatchingCam) return true;
    return hasLineOfSight(camX, camY, tx, ty, wallSegments, sightMaxDist);
  };

  for (const b of bodies) {
    if (!canSeeWorldPoint(b.x, b.y)) continue;
    const dissolveAlpha =
      typeof b.dissolveTimer === 'number' && b.dissolveTimer > 0
        ? Math.max(0.2, Math.min(1, b.dissolveTimer / 12))
        : 1;
    drawCrewmateSprite(ctx, b.x, b.y, b.color, 'none', 1, false, false, dissolveAlpha, false);
  }

  const sorted = Object.values(players).sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    if (p.inVent) continue;
    if (!p.alive && me.alive) continue;
    if (p.invisible && p.id !== me.id && !(isImpTeam && ['impostor', 'phantom', 'madscientist', 'viper', 'shapeshifter'].includes(p.role))) {
      continue;
    }
    if (p.id !== me.id && !canSeeWorldPoint(p.x, p.y)) continue;

    const alpha = p.invisible ? 0.35 : 1;
    const disp = p.disguisedAs || null;
    const drawColor = disp ? disp.color : p.color;
    const drawHat = disp ? disp.hat || 'none' : p.hat || 'none';
    const drawName = disp ? disp.name : p.name;

    // 追従ミニペット描画（生存プレイヤーのみ、背後を追従）
    const petId = p.pet || 'none';
    if (p.alive && petId !== 'none' && !p.invisible) {
      const targetPetX = p.x - (p.facing || 1) * 30;
      const targetPetY = p.y + 14;
      const prevPet = petTrailMap.get(p.id) || { x: targetPetX, y: targetPetY };
      const distPet = Math.hypot(targetPetX - prevPet.x, targetPetY - prevPet.y);
      const nextPetX = distPet > 140 ? targetPetX : prevPet.x + (targetPetX - prevPet.x) * 0.16;
      const nextPetY = distPet > 140 ? targetPetY : prevPet.y + (targetPetY - prevPet.y) * 0.16;
      petTrailMap.set(p.id, { x: nextPetX, y: nextPetY });
      const petWalking = distPet > 3.5;
      drawPetSprite(ctx, nextPetX, nextPetY, petId, drawColor, p.facing || 1, petWalking, nowMs);
    }

    drawCrewmateSprite(ctx, p.x, p.y, drawColor, drawHat, p.facing || 1, p.alive, !p.alive, alpha, Boolean(p.shielded), nowMs);

    ctx.font = 'bold 13px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    const showImpRed = isImpTeam && ['impostor', 'phantom', 'madscientist', 'viper', 'shapeshifter'].includes(p.role);
    ctx.fillStyle = showImpRed ? '#fb7185' : '#ffffff';
    ctx.fillText(drawName, p.x, p.y - 38);

    if (me.role === 'arsonist' && p.id !== me.id && p.alive && oiledPlayers[p.id]) {
      ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#fb923c';
      ctx.fillText('🛢️ 塗布済', p.x, p.y - 53);
    }
  }

  // 特殊やられエフェクト描画
  for (const burst of killBursts) {
    if (canSeeWorldPoint(burst.x, burst.y)) {
      drawKillEffectBurst(ctx, burst, nowMs);
    }
  }

  ctx.restore();

  // 11. 2Dレイキャスト視界遮蔽シャドウマスク（生存時 or カメラ視聴中）
  if (me.alive || isWatchingCam) {
    const activeRadius = isWatchingCam ? 290 : visionRadius;
    const visPoly = computeVisibilityPolygon(camX, camY, activeRadius, wallSegments);
    if (visPoly.length >= 3) {
      const darkAlpha = sabotage?.type === 'lights' && !isImpTeam && me.role !== 'jackal' ? 0.97 : 0.83;
      const offX = w / 2 - camX;
      const offY = h / 2 - camY;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.moveTo(visPoly[0].x + offX, visPoly[0].y + offY);
      for (let i = visPoly.length - 1; i >= 1; i--) {
        ctx.lineTo(visPoly[i].x + offX, visPoly[i].y + offY);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(3, 6, 15, ${darkAlpha})`;
      ctx.fill('evenodd');

      // 視界外縁の滑らかな減衰グラデーション
      ctx.beginPath();
      ctx.moveTo(visPoly[0].x + offX, visPoly[0].y + offY);
      for (let i = 1; i < visPoly.length; i++) {
        ctx.lineTo(visPoly[i].x + offX, visPoly[i].y + offY);
      }
      ctx.closePath();
      ctx.clip();
      const edgeGrad = ctx.createRadialGradient(w / 2, h / 2, activeRadius * 0.55, w / 2, h / 2, activeRadius);
      edgeGrad.addColorStop(0, 'rgba(3, 6, 15, 0)');
      edgeGrad.addColorStop(0.78, 'rgba(3, 6, 15, 0.14)');
      edgeGrad.addColorStop(1, `rgba(3, 6, 15, ${darkAlpha})`);
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(w / 2 - activeRadius, h / 2 - activeRadius, activeRadius * 2, activeRadius * 2);
      ctx.restore();
    }
  }

  // 12. 砂嵐 / クリスタル灯台 / 深海ソナー / サイキック / 警鐘オーバーレイ
  if (sandstormActive && me.alive) {
    ctx.save();
    ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.fillText('🏜️ 砂嵐発生中（屋外通路の視界低下）', w / 2, h - 18);
    ctx.restore();
  }

  if (crystalBeaconTimer > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.restore();
  }

  if (sonarPingTimer > 0) {
    ctx.save();
    Object.values(players).forEach((p) => {
      if (!p.alive || p.id === me.id || p.inVent) return;
      const dx = p.x - me.x;
      const dy = p.y - me.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 560 && dist > 30) {
        const ang = Math.atan2(dy, dx);
        const ix = w / 2 + Math.cos(ang) * 115;
        const iy = h / 2 + Math.sin(ang) * 115;
        ctx.fillStyle = '#2dd4bf';
        ctx.beginPath();
        ctx.arc(ix, iy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
        ctx.fillStyle = '#ccfbf1';
        ctx.textAlign = 'center';
        ctx.fillText('📡 反応', ix, iy - 13);
      }
    });
    ctx.restore();
  }

  if (bellRingTimer > 0 && bellPos) {
    const dx = bellPos.x - me.x;
    const dy = bellPos.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 45) {
      const ang = Math.atan2(dy, dx);
      const ix = w / 2 + Math.cos(ang) * 125;
      const iy = h / 2 + Math.sin(ang) * 125;
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(ix, iy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
      ctx.fillStyle = '#fef3c7';
      ctx.textAlign = 'center';
      ctx.fillText('🔔 警鐘', ix, iy - 14);
      ctx.restore();
    }
  }

  if (me.role === 'psychic' && psychicTimer > 0) {
    ctx.save();
    for (const b of bodies) {
      const dx = b.x - me.x;
      const dy = b.y - me.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 30) {
        const ang = Math.atan2(dy, dx);
        const ix = w / 2 + Math.cos(ang) * 130;
        const iy = h / 2 + Math.sin(ang) * 130;
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(ix, iy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
        ctx.fillStyle = '#f3e8ff';
        ctx.textAlign = 'center';
        ctx.fillText('💀 死体反応', ix, iy - 14);
      }
    }
    ctx.restore();
  }

  // 13. 監視カメラ録画HUDフレーム
  if (isWatchingCam && cameraWatchTarget) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(w / 2 - 180, 12, 360, 30);
    ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    const feedTitle = cameraWatchTarget.label ? `【${cameraWatchTarget.label}】` : '';
    ctx.fillText(`📹 監視カメラ ${feedTitle} 残り ${Math.ceil(cameraWatchTimer)}s`, w / 2, 31);
    ctx.restore();
  }

  // 14. 炉心サボタージュ赤色警戒ストロボエッジ（Among Us風緊急フラッシュ）
  if (sabotage?.type === 'reactor' && me.alive) {
    const strobe = (Math.sin(nowMs * 0.01) + 1) * 0.5;
    if (strobe > 0.15) {
      ctx.save();
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.18 + strobe * 0.34})`;
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // 15. 幽霊からの霊界イタズラ（インポスター視界微減・妨害ウィスプエフェクト）
  if (hauntedTimer > 0 && me.alive) {
    ctx.save();
    const fade = Math.min(1, hauntedTimer * 0.9);
    const vGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, Math.max(w, h) * 0.65);
    vGrad.addColorStop(0, 'rgba(139, 92, 246, 0)');
    vGrad.addColorStop(1, `rgba(109, 40, 217, ${0.42 * fade})`);
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 6; i++) {
      const ang = nowMs * 0.002 + i * ((Math.PI * 2) / 6);
      const wx = w / 2 + Math.cos(ang) * (w * 0.28);
      const wy = h / 2 + Math.sin(ang * 1.3) * (h * 0.24);
      ctx.fillStyle = `rgba(196, 181, 253, ${0.32 * fade})`;
      ctx.beginPath();
      ctx.arc(wx, wy, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#ddd6fe';
    ctx.textAlign = 'center';
    ctx.fillText('👻 幽霊のイタズラ：視界が少し乱れています！', w / 2, 28);
    ctx.restore();
  }
}

export function renderMiniMapCanvas(params: {
  canvas: HTMLCanvasElement;
  mapDef: MapDef;
  me: PlayerState;
  players: Record<string, PlayerState>;
  myTasks: string[];
  completedTasks: Record<string, boolean>;
  hasTasks: boolean;
  sabotage: { type: 'lights' | 'reactor'; timer: number } | null;
  radarTimer: number;
  trackedTargetId: string | null;
  adminTimer: number;
}) {
  const {
    canvas,
    mapDef,
    me,
    players,
    myTasks,
    completedTasks,
    hasTasks,
    sabotage,
    radarTimer,
    trackedTargetId,
    adminTimer
  } = params;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(300, Math.floor(rect.width));
  const h = Math.max(220, Math.floor(rect.height));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = mapDef.bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  const scale = Math.min(w / 2050, h / 1320);
  ctx.translate((w - 2000 * scale) / 2, (h - 1260 * scale) / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = mapDef.corridorFill;
  for (const c of mapDef.corridors) {
    ctx.fillRect(c.x, c.y, c.w, c.h);
  }

  for (const r of mapDef.rooms) {
    ctx.fillStyle = r.color;
    ctx.strokeStyle = mapDef.accent;
    ctx.lineWidth = 5;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.font = 'bold 34px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, r.x + r.w / 2, r.y + r.h / 2);

    // アドミン盤起動時は各部屋の生存者数を匿名シルエット表示（Among Us本家仕様）
    if (adminTimer > 0) {
      const count = Object.values(players).filter(
        (p) => p.alive && !p.inVent && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      ).length;
      if (count > 0) {
        ctx.fillStyle = '#22c55e';
        ctx.font = '900 38px "Orbitron", sans-serif';
        ctx.fillText(`👤×${count}`, r.x + r.w / 2, r.y + r.h / 2 + 54);
      }
    }
  }

  if (hasTasks) {
    for (const tid of myTasks) {
      if (completedTasks[tid]) continue;
      const spot = mapDef.taskSpots.find((s) => s.taskId === tid);
      if (!spot) continue;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (sabotage) {
    const pt = mapDef.sabotageFix[sabotage.type];
    if (pt) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (me.role === 'radar' && radarTimer > 0) {
    Object.values(players).forEach((p) => {
      if (!p.alive || p.id === me.id) return;
      const cObj = CREW_COLORS.find((c) => c.id === p.color) || CREW_COLORS[0];
      ctx.fillStyle = cObj.hex;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  const trackedPlayer = me.role === 'tracker' && trackedTargetId ? players[trackedTargetId] : null;
  if (trackedPlayer && trackedPlayer.alive) {
    ctx.fillStyle = '#f43f5e';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(trackedPlayer.x, trackedPlayer.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 28px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#fecdd3';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 ${trackedPlayer.name}`, trackedPlayer.x, trackedPlayer.y - 36);
  }

  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(me.x, me.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Among Us風の役職発表＆勝利ラインナップ用スポットライトキャンバス描画
 */
export function renderCrewmateLineupCanvas(params: {
  canvas: HTMLCanvasElement;
  members: Array<{ id: string; name: string; color: string; hat: string; pet?: string; isHighlight?: boolean }>;
  glowColor: string;
}) {
  const { canvas, members, glowColor } = params;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width || 560;
  const h = canvas.height || 136;
  ctx.clearRect(0, 0, w, h);

  // スポットライト背景光帯
  const beam = ctx.createRadialGradient(w / 2, h * 0.58, 18, w / 2, h * 0.58, w * 0.52);
  beam.addColorStop(0, `${glowColor}55`);
  beam.addColorStop(0.65, `${glowColor}1a`);
  beam.addColorStop(1, 'rgba(3, 6, 15, 0)');
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, w, h);

  // 水平ライン
  ctx.fillStyle = `${glowColor}30`;
  ctx.fillRect(0, h * 0.62, w, 2);

  const count = Math.min(members.length, 7);
  if (count === 0) return;

  const spacing = Math.min(72, (w - 60) / Math.max(1, count));
  const startX = w / 2 - ((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    const m = members[i];
    const cx = startX + i * spacing;
    const isCenter = Boolean(m.isHighlight);
    const scale = isCenter ? 1.48 : 1.12;
    const cy = isCenter ? h * 0.68 : h * 0.64;

    if (m.pet && m.pet !== 'none') {
      ctx.save();
      ctx.translate(cx - 20 * scale, cy + 10 * scale);
      ctx.scale(scale * 0.9, scale * 0.9);
      drawPetSprite(ctx, 0, 0, m.pet, m.color, cx <= w / 2 ? 1 : -1, false, 0);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    drawCrewmateSprite(ctx, 0, 0, m.color, m.hat || 'none', cx <= w / 2 ? 1 : -1, true, false, 1, false, 0);
    ctx.restore();

    ctx.font = isCenter ? '900 11px "Noto Sans JP", sans-serif' : 'bold 10px "Noto Sans JP", sans-serif';
    ctx.fillStyle = isCenter ? '#ffffff' : '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, cx, h - 8);
  }
}
