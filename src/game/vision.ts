import { MapDef, MapRect } from './maps';

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Point2D {
  x: number;
  y: number;
}

function isInsideRectList(x: number, y: number, rects: MapRect[]): boolean {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return true;
    }
  }
  return false;
}

const mapWallCache = new Map<string, WallSegment[]>();

/**
 * マップの部屋・通路の和集合から外周壁および部屋間の境界壁を正確に抽出する。
 * 重なり合う出入口は壁として扱わず、視線遮蔽障害物(blocksSight)の辺も追加する。
 */
export function extractMapWallSegments(mapDef: MapDef, extraBlockedRects: MapRect[] = []): WallSegment[] {
  let baseWalls = mapWallCache.get(mapDef.id);

  if (!baseWalls) {
    const walkables: MapRect[] = [...mapDef.rooms, ...mapDef.corridors];
    const xSet = new Set<number>();
    const ySet = new Set<number>();

    for (const r of walkables) {
      xSet.add(r.x);
      xSet.add(r.x + r.w);
      ySet.add(r.y);
      ySet.add(r.y + r.h);
    }

    const xs = Array.from(xSet).sort((a, b) => a - b);
    const ys = Array.from(ySet).sort((a, b) => a - b);
    const segments: WallSegment[] = [];

    // 水平境界セグメント抽出＆マージ
    for (let j = 0; j < ys.length; j++) {
      const y = ys[j];
      let segStart: number | null = null;
      for (let i = 0; i < xs.length - 1; i++) {
        const xA = xs[i];
        const xB = xs[i + 1];
        if (xB - xA < 0.5) continue;
        const midX = (xA + xB) * 0.5;
        const above = isInsideRectList(midX, y - 0.5, walkables);
        const below = isInsideRectList(midX, y + 0.5, walkables);
        const isWall = above !== below;
        if (isWall) {
          if (segStart === null) segStart = xA;
        } else if (segStart !== null) {
          segments.push({ x1: segStart, y1: y, x2: xA, y2: y });
          segStart = null;
        }
      }
      if (segStart !== null) {
        segments.push({ x1: segStart, y1: y, x2: xs[xs.length - 1], y2: y });
      }
    }

    // 垂直境界セグメント抽出＆マージ
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      let segStart: number | null = null;
      for (let j = 0; j < ys.length - 1; j++) {
        const yA = ys[j];
        const yB = ys[j + 1];
        if (yB - yA < 0.5) continue;
        const midY = (yA + yB) * 0.5;
        const left = isInsideRectList(x - 0.5, midY, walkables);
        const right = isInsideRectList(x + 0.5, midY, walkables);
        const isWall = left !== right;
        if (isWall) {
          if (segStart === null) segStart = yA;
        } else if (segStart !== null) {
          segments.push({ x1: x, y1: segStart, x2: x, y2: yA });
          segStart = null;
        }
      }
      if (segStart !== null) {
        segments.push({ x1: x, y1: segStart, x2: x, y2: ys[ys.length - 1] });
      }
    }

    // 視線を遮る背の高い障害物（柱・コンテナ・サーバー・リアクター）
    for (const obs of mapDef.obstacles) {
      if (!obs.blocksSight) continue;
      segments.push(
        { x1: obs.x, y1: obs.y, x2: obs.x + obs.w, y2: obs.y },
        { x1: obs.x + obs.w, y1: obs.y, x2: obs.x + obs.w, y2: obs.y + obs.h },
        { x1: obs.x + obs.w, y1: obs.y + obs.h, x2: obs.x, y2: obs.y + obs.h },
        { x1: obs.x, y1: obs.y + obs.h, x2: obs.x, y2: obs.y }
      );
    }

    baseWalls = segments;
    mapWallCache.set(mapDef.id, baseWalls);
  }

  if (extraBlockedRects.length === 0) {
    return baseWalls;
  }

  const combined = [...baseWalls];
  for (const r of extraBlockedRects) {
    combined.push(
      { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y },
      { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h },
      { x1: r.x + r.w, y1: r.y + r.h, x2: r.x, y2: r.y + r.h },
      { x1: r.x, y1: r.y + r.h, x2: r.x, y2: r.y }
    );
  }
  return combined;
}

function raySegmentIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  seg: WallSegment,
  maxDist: number
): number {
  const sx = seg.x2 - seg.x1;
  const sy = seg.y2 - seg.y1;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-8) return maxDist;

  const qpx = seg.x1 - ox;
  const qpy = seg.y1 - oy;
  const t = (qpx * sy - qpy * sx) / denom;
  if (t < 0 || t > maxDist) return maxDist;

  const u = (qpx * dy - qpy * dx) / denom;
  if (u < -0.0001 || u > 1.0001) return maxDist;

  return t;
}

/**
 * プレイヤー位置からの壁遮蔽つき2D視界ポリゴンを計算する。
 */
export function computeVisibilityPolygon(
  ox: number,
  oy: number,
  radius: number,
  wallSegments: WallSegment[]
): Point2D[] {
  const bound = radius + 60;
  const minX = ox - bound;
  const maxX = ox + bound;
  const minY = oy - bound;
  const maxY = oy + bound;

  const nearSegs: WallSegment[] = [];
  const angles: number[] = [];

  for (let i = 0; i < wallSegments.length; i++) {
    const s = wallSegments[i];
    if (
      Math.max(s.x1, s.x2) < minX ||
      Math.min(s.x1, s.x2) > maxX ||
      Math.max(s.y1, s.y2) < minY ||
      Math.min(s.y1, s.y2) > maxY
    ) {
      continue;
    }
    nearSegs.push(s);

    const a1 = Math.atan2(s.y1 - oy, s.x1 - ox);
    const a2 = Math.atan2(s.y2 - oy, s.x2 - ox);
    angles.push(a1 - 0.0006, a1, a1 + 0.0006);
    angles.push(a2 - 0.0006, a2, a2 + 0.0006);
  }

  // 円周方向の滑らかさ確保
  const stepCount = 56;
  for (let i = 0; i < stepCount; i++) {
    angles.push(-Math.PI + (i / stepCount) * Math.PI * 2);
  }

  // [-PI, PI] へ正規化してソート
  const normalized = angles.map((a) => {
    let ang = a;
    while (ang <= -Math.PI) ang += Math.PI * 2;
    while (ang > Math.PI) ang -= Math.PI * 2;
    return ang;
  });
  normalized.sort((a, b) => a - b);

  // 重複に近い微小角度を間引く
  const uniqueAngles: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (uniqueAngles.length === 0 || normalized[i] - uniqueAngles[uniqueAngles.length - 1] > 0.00015) {
      uniqueAngles.push(normalized[i]);
    }
  }

  const pts: Point2D[] = [];
  for (let i = 0; i < uniqueAngles.length; i++) {
    const ang = uniqueAngles[i];
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let minT = radius;

    for (let j = 0; j < nearSegs.length; j++) {
      const t = raySegmentIntersect(ox, oy, dx, dy, nearSegs[j], minT);
      if (t < minT) minT = t;
    }

    pts.push({
      x: ox + dx * minT,
      y: oy + dy * minT
    });
  }

  return pts;
}

/**
 * 2点間に視線を遮る壁がないか判定する（壁越しの他プレイヤー・死体非表示用）
 */
export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  wallSegments: WallSegment[],
  maxDist = Infinity
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist > maxDist) return false;
  if (dist < 1) return true;

  const ux = dx / dist;
  const uy = dy / dist;
  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2);
  const segMaxY = Math.max(y1, y2);

  for (let i = 0; i < wallSegments.length; i++) {
    const s = wallSegments[i];
    if (
      Math.max(s.x1, s.x2) < segMinX ||
      Math.min(s.x1, s.x2) > segMaxX ||
      Math.max(s.y1, s.y2) < segMinY ||
      Math.min(s.y1, s.y2) > segMaxY
    ) {
      continue;
    }
    const t = raySegmentIntersect(x1, y1, ux, uy, s, dist - 2);
    if (t < dist - 2) {
      return false;
    }
  }
  return true;
}
