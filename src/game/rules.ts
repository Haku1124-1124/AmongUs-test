import {
  IMPOSTOR_KILL_ROLES,
  IMPOSTOR_TEAM_ROLES,
  ROLES_DEF,
  SPECIAL_ROLE_KEYS
} from './constants';
import { MapDef, MapRect, MAPS_DEF } from './maps';

export interface PlayerState {
  id: string;
  peerId?: string;
  name: string;
  color: string;
  hat: string;
  pet?: string;
  killEffect?: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: number;
  role: string;
  alive: boolean;
  invisible: boolean;
  inVent: boolean;
  shielded: boolean;
  disguisedAs: { name: string; color: string; hat: string } | null;
  isBot: boolean;
  tasksDone: number;
  killsCount?: number;
  aiGoal?: { x: number; y: number } | null;
  aiWait?: number;
  aiKillCd?: number;
}

export interface KillEvent {
  id: string;
  timeSec: number;
  killerId: string;
  killerName: string;
  killerColor: string;
  killerRole: string;
  victimId: string;
  victimName: string;
  victimColor: string;
  victimRole: string;
  roomName: string;
  method: 'kill' | 'misfire' | 'eject';
  killEffect?: string;
}

export interface GameSettings {
  mapId: string;
  impostors: number;
  killCooldown: number;
  spawnKillCooldown: number;
  meetingTime: number;
  taskCount: number;
  specialRolesCount: number;
  enabledRoles: Record<string, boolean>;
}

export function isImpostorTeam(role: string): boolean {
  return IMPOSTOR_TEAM_ROLES.includes(role);
}

export function canUseVentRole(role: string): boolean {
  return isImpostorTeam(role) || role === 'engineer' || role === 'jackal' || role === 'jester' || role === 'arsonist';
}

export function canKillRole(role: string): boolean {
  return IMPOSTOR_KILL_ROLES.includes(role) || role === 'sheriff' || role === 'jackal';
}

export function hasCrewTasks(role: string): boolean {
  const def = ROLES_DEF[role];
  return Boolean(def && def.team === 'crew');
}

export function getPlayerTaskTargetCount(playerObj: { role?: string } | null | undefined, baseTaskCount = 4): number {
  const base = baseTaskCount || 4;
  if (playerObj && playerObj.role === 'mayor') {
    return Math.min(8, base + 1);
  }
  return base;
}

export function getRoleKillCooldown(role: string, baseCd: number): number {
  const cd = Number(baseCd || 25);
  if (role === 'viper') return cd + 5;
  if (role === 'sheriff') return cd + 3;
  if (role === 'jackal') return Math.max(10, cd - 2);
  return cd;
}

export function isRawFloorPoint(x: number, y: number, m: MapDef): boolean {
  for (const r of m.rooms) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  for (const c of m.corridors) {
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
  }
  return false;
}

export function isInsideObstacleOrClosedDoor(
  x: number,
  y: number,
  radius: number,
  m: MapDef,
  closedDoors: MapRect[] = []
): boolean {
  for (const obs of m.obstacles) {
    if (x + radius > obs.x && x - radius < obs.x + obs.w && y + radius > obs.y && y - radius < obs.y + obs.h) {
      return true;
    }
  }
  for (const d of closedDoors) {
    if (x + radius > d.x && x - radius < d.x + d.w && y + radius > d.y && y - radius < d.y + d.h) {
      return true;
    }
  }
  return false;
}

export function isPointWalkable(
  x: number,
  y: number,
  mapObj?: MapDef,
  closedDoors: MapRect[] = [],
  radius = 12
): boolean {
  const m = mapObj || MAPS_DEF.starship;
  if (isInsideObstacleOrClosedDoor(x, y, radius, m, closedDoors)) {
    return false;
  }
  const diag = radius * 0.7071;
  const checkPoints: [number, number][] = [
    [x, y],
    [x + radius, y],
    [x - radius, y],
    [x, y + radius],
    [x, y - radius],
    [x + diag, y + diag],
    [x - diag, y + diag],
    [x + diag, y - diag],
    [x - diag, y - diag]
  ];
  for (const [px, py] of checkPoints) {
    if (!isRawFloorPoint(px, py, m)) return false;
  }
  return true;
}

/**
 * 狭い通路や出入口の角でも引っかからず滑らかに壁沿いスライド移動する衝突解決
 */
export function resolveMovementWithWalls(
  curX: number,
  curY: number,
  moveVx: number,
  moveVy: number,
  dt: number,
  mapObj: MapDef,
  isAlive: boolean,
  closedDoors: MapRect[] = []
): { x: number; y: number } {
  let x = curX;
  let y = curY;

  if (Math.hypot(moveVx, moveVy) <= 1) {
    return { x, y };
  }

  const nx = x + moveVx * dt;
  const ny = y + moveVy * dt;

  if (!isAlive) {
    return {
      x: Math.max(40, Math.min(1960, nx)),
      y: Math.max(40, Math.min(1260, ny))
    };
  }

  if (isPointWalkable(nx, y, mapObj, closedDoors)) {
    x = Math.max(40, Math.min(1960, nx));
  } else if (Math.abs(moveVy) < 5) {
    // 狭い出入口への自動コーナーアシスト
    for (const offset of [-6, 6, -12, 12, -18, 18, -24, 24]) {
      if (isPointWalkable(nx, y + offset, mapObj, closedDoors)) {
        y += Math.sign(offset) * Math.min(Math.abs(offset), 160 * dt);
        break;
      }
    }
  }

  if (isPointWalkable(x, ny, mapObj, closedDoors)) {
    y = Math.max(40, Math.min(1260, ny));
  } else if (Math.abs(moveVx) < 5) {
    for (const offset of [-6, 6, -12, 12, -18, 18, -24, 24]) {
      if (isPointWalkable(x + offset, ny, mapObj, closedDoors)) {
        x += Math.sign(offset) * Math.min(Math.abs(offset), 160 * dt);
        break;
      }
    }
  }

  return { x, y };
}

export function findSafeSpawnPosition(
  targetX: number,
  targetY: number,
  mapObj?: MapDef,
  closedDoors: MapRect[] = []
): { x: number; y: number } {
  const m = mapObj || MAPS_DEF.starship;
  if (isPointWalkable(targetX, targetY, m, closedDoors)) {
    return { x: targetX, y: targetY };
  }
  for (let r = 10; r <= 140; r += 10) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const tx = targetX + Math.cos(a) * r;
      const ty = targetY + Math.sin(a) * r;
      if (isPointWalkable(tx, ty, m, closedDoors)) {
        return { x: tx, y: ty };
      }
    }
  }
  return { x: m.emergency.x, y: m.emergency.y };
}

export function getCurrentRoomName(x: number, y: number, mapObj?: MapDef): string {
  const m = mapObj || MAPS_DEF.starship;
  for (const r of m.rooms) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.name;
  }
  return '連絡通路';
}

/**
 * プレイヤーの現在視界半径を計算する（役職・停電・胞子ミスト・砂嵐・クリスタル灯台を反映）
 */
export function computePlayerVisionRadius(params: {
  role: string;
  x: number;
  y: number;
  mapDef: MapDef;
  sabotageType: 'lights' | 'reactor' | null;
  crystalBeaconActive: boolean;
  sandstormActive: boolean;
  hauntedActive?: boolean;
}): number {
  const { role, x, y, mapDef, sabotageType, crystalBeaconActive, sandstormActive, hauntedActive } = params;
  let visionRadius = 295;
  if (isImpostorTeam(role)) {
    visionRadius = 410;
  } else if (role === 'jackal') {
    visionRadius = 385;
  } else if (role === 'security') {
    visionRadius = 335;
  }

  if (sabotageType === 'lights' && !isImpostorTeam(role) && role !== 'jackal') {
    visionRadius = 120;
  }

  // マップ環境ギミックによる視界調整
  const inRoom = mapDef.rooms.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);

  if (sandstormActive && !inRoom && !isImpostorTeam(role)) {
    visionRadius *= 0.78;
  }

  for (const g of mapDef.gimmicks) {
    if ((g.type === 'spore_mist' || g.type === 'steam_hazard') && g.w && g.h) {
      if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) {
        visionRadius *= g.visionMult ?? 0.72;
      }
    }
  }

  if (crystalBeaconActive && hasCrewTasks(role)) {
    visionRadius = Math.max(visionRadius, 390);
  }

  if (hauntedActive) {
    visionRadius = Math.max(110, visionRadius * 0.76);
  }

  return Math.round(visionRadius);
}

/**
 * 勝利条件判定（クルー全タスク/追放・インポスター制圧・ジャッカル単独勝利）
 */
export function evaluateWinCondition(
  playersMap: Record<string, PlayerState>,
  baseTaskCount: number
): { winner: 'crewmates' | 'impostors' | 'jackal'; reason: string } | null {
  const allPlayers = Object.values(playersMap);
  if (allPlayers.length === 0) return null;

  const alivePlayers = allPlayers.filter((p) => p.alive);
  const aliveImpostors = alivePlayers.filter((p) => isImpostorTeam(p.role));
  const aliveJackals = alivePlayers.filter((p) => p.role === 'jackal');
  const aliveArsonists = alivePlayers.filter((p) => p.role === 'arsonist');
  const nonImpostorAlive = alivePlayers.filter(
    (p) => !isImpostorTeam(p.role) && p.role !== 'jackal' && p.role !== 'arsonist'
  );

  if (aliveJackals.length > 0 && aliveImpostors.length === 0 && aliveArsonists.length === 0 && nonImpostorAlive.length <= 1) {
    return {
      winner: 'jackal',
      reason: '第三陣営・ジャッカルが船内を制圧し単独勝利しました！'
    };
  }

  const aliveKillImpostors = aliveImpostors.filter((p) => IMPOSTOR_KILL_ROLES.includes(p.role));
  if (
    aliveKillImpostors.length > 0 &&
    aliveImpostors.length >= nonImpostorAlive.length + aliveJackals.length + aliveArsonists.length
  ) {
    return {
      winner: 'impostors',
      reason: 'インポスター陣営が過半数を制圧しました！'
    };
  }

  if (aliveImpostors.length === 0 && aliveJackals.length === 0 && aliveArsonists.length === 0) {
    return {
      winner: 'crewmates',
      reason: 'すべての脅威（インポスター・第三陣営）が排除されました！'
    };
  }

  const crewPlayers = allPlayers.filter((p) => hasCrewTasks(p.role));
  if (
    crewPlayers.length > 0 &&
    crewPlayers.every((p) => (p.tasksDone || 0) >= getPlayerTaskTargetCount(p, baseTaskCount))
  ) {
    return {
      winner: 'crewmates',
      reason: 'すべての緊急タスクが完了しました！'
    };
  }

  return null;
}

/**
 * 投票集計ロジック（メイヤー2票対応・同数スキップ判定）
 */
export function tallyVotes(
  votes: Record<string, string>,
  playersMap: Record<string, PlayerState>
): { ejectedId: string | null; tie: boolean; skipCount: number } {
  const tally: Record<string, number> = {};
  let skipCount = 0;

  Object.entries(votes).forEach(([voterId, tid]) => {
    const voter = playersMap[voterId];
    const weight = voter && voter.role === 'mayor' ? 2 : 1;
    if (tid === 'skip') skipCount += weight;
    else tally[tid] = (tally[tid] || 0) + weight;
  });

  let maxVotes = skipCount;
  let ejectedId: string | null = null;
  let tie = false;

  Object.entries(tally).forEach(([pid, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      ejectedId = pid;
      tie = false;
    } else if (count === maxVotes) {
      tie = true;
    }
  });

  return { ejectedId: tie ? null : ejectedId, tie, skipCount };
}

/**
 * 全20役職のバランス配分ロジック
 */
export function assignRoles(
  ids: string[],
  settings: GameSettings,
  rng: () => number = Math.random
): Record<string, string> {
  const impCount = Math.min(settings.impostors, Math.max(1, Math.floor(ids.length / 3)));
  const specialLimit = settings.specialRolesCount || 0;
  const enabledMap = settings.enabledRoles || {};

  const shuffled = [...ids].sort(() => rng() - 0.5);
  const impostorIds = shuffled.slice(0, impCount);
  const remainingIds = shuffled.slice(impCount);

  const roleMap: Record<string, string> = {};
  let specialAssigned = 0;

  const specialImpPool = ['phantom', 'viper', 'shapeshifter']
    .filter((rk) => enabledMap[rk] !== false)
    .sort(() => rng() - 0.5);

  impostorIds.forEach((id) => {
    if (specialAssigned < specialLimit && specialImpPool.length > 0 && rng() < 0.78) {
      roleMap[id] = specialImpPool.shift()!;
      specialAssigned++;
    } else {
      roleMap[id] = 'impostor';
    }
  });

  const nonImpSpecialKeys = SPECIAL_ROLE_KEYS.filter(
    (rk) => !['phantom', 'viper', 'shapeshifter'].includes(rk)
  );
  let specialPool = nonImpSpecialKeys
    .filter((rk) => enabledMap[rk] !== false)
    .sort(() => rng() - 0.5);

  if (ids.length <= 6) {
    let killerNeutralSeen = false;
    specialPool = specialPool.filter((rk) => {
      if (rk === 'madscientist') return false;
      if (rk === 'jackal' || rk === 'arsonist') {
        if (killerNeutralSeen) return false;
        killerNeutralSeen = true;
      }
      return true;
    });
  }

  remainingIds.forEach((id) => {
    if (specialAssigned < specialLimit && specialPool.length > 0) {
      roleMap[id] = specialPool.shift()!;
      specialAssigned++;
    } else {
      roleMap[id] = 'crewmate';
    }
  });

  return roleMap;
}
