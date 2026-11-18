import Peer, { DataConnection } from 'peerjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GimmickInfoModal,
  MeetingModal,
  MiniMapModal,
  SabotageModal,
  TaskModal
} from './components/GameModals';
import {
  EjectionOverlay,
  GameOverModal,
  KillFlashOverlay,
  ReportCutInOverlay,
  RoleRevealOverlay
} from './components/AmongUsEffects';
import { ActionButtonState, GameScreen } from './components/GameScreen';
import { ChatEntry, LobbyScreen } from './components/LobbyScreen';
import { KeybindModal, NetConfigModal, RolesGuideModal } from './components/Modals';
import { PublicRoomSummary, TitleScreen } from './components/TitleScreen';
import {
  ALL_TASKS,
  BOT_NAMES,
  CREW_COLORS,
  CREW_PETS,
  DEFAULT_KEYBINDS,
  KILL_EFFECTS,
  ROLES_DEF,
  SPECIAL_ROLE_KEYS,
  TaskDef
} from './game/constants';
import { drawPetSprite, KillEffectBurst } from './game/cosmetics';
import { MapDef, MapGimmick, MapRect, MAPS_DEF } from './game/maps';
import { AbilityTrace, BodyState, drawCrewmateSprite, renderGameCanvasFrame } from './game/renderer';
import {
  assignRoles,
  canKillRole,
  canUseVentRole,
  computePlayerVisionRadius,
  evaluateWinCondition,
  findSafeSpawnPosition,
  GameSettings,
  getCurrentRoomName,
  getPlayerTaskTargetCount,
  getRoleKillCooldown,
  hasCrewTasks,
  isImpostorTeam,
  KillEvent,
  PlayerState,
  resolveMovementWithWalls,
  tallyVotes
} from './game/rules';
import { sound } from './game/sound';
import {
  copyTextToClipboard,
  isCanvasPreviewEnvironment,
  safeLocalGet,
  safeLocalSet,
  safeSessionGet,
  safeSessionSet
} from './game/storage';

type GamePhase = 'title' | 'lobby' | 'playing' | 'meeting' | 'gameover';

interface ActiveDoorLock {
  rect: MapRect;
  expiresAt: number;
  id: string;
}

interface SimState {
  phase: GamePhase;
  isHost: boolean;
  isPublicRoom: boolean;
  roomCode: string;
  myId: string;
  myName: string;
  myColor: string;
  myHat: string;
  myPet: string;
  myKillEffect: string;
  players: Record<string, PlayerState>;
  bodies: BodyState[];
  abilityTraces: AbilityTrace[];
  killTimeline: KillEvent[];
  killEffectBursts: KillEffectBurst[];
  settings: GameSettings;
  myTasks: string[];
  completedTasks: Record<string, boolean>;
  sabotage: { type: 'lights' | 'reactor'; timer: number } | null;
  sabotageCooldown: number;
  killCooldown: number;
  douseCooldown: number;
  oiledPlayers: Record<string, boolean>;
  doctorUsed: boolean;
  radarUsesLeft: number;
  radarTimer: number;
  radarCooldown: number;
  securityUsesLeft: number;
  securityShieldTimer: number;
  securityCooldown: number;
  survivorUsesLeft: number;
  survivorShieldTimer: number;
  survivorCooldown: number;
  trackedTargetId: string | null;
  teleportUsesLeft: number;
  teleportCooldown: number;
  psychicTimer: number;
  psychicCooldown: number;
  phantomTimer: number;
  phantomCooldown: number;
  disguiseTimer: number;
  disguiseCooldown: number;
  ghostHauntCooldown: number;
  hauntedTimer: number;
  hauntedTargets: Record<string, number>;
  ventStayTimer: number;
  ventUseCooldown: number;
  currentVentIndex: number;
  myShieldTimer: number;
  mySlowTimer: number;
  emergencyCooldown: number;
  boostTimer: number;
  sonarPingTimer: number;
  adminTimer: number;
  crystalBeaconTimer: number;
  bellRingTimer: number;
  bellPos: { x: number; y: number } | null;
  cameraWatchTimer: number;
  cameraWatchGimmick: MapGimmick | null;
  cameraFeedIndex: number;
  gimmickCooldowns: Record<string, number>;
  activeDoorLocks: ActiveDoorLock[];
  remoteClosedDoors: MapRect[];
  remoteCameraActive: boolean;
  doorLogs: string[];
  doorLogSensorCooldowns: Record<string, number>;
  iceVx: number;
  iceVy: number;
  sandstormActive: boolean;
  steamActive: boolean;
  meetingReason: 'body' | 'emergency';
  meetingCaller: string;
  meetingCallerColor: string;
  meetingCallerHat: string;
  meetingVictimName: string;
  meetingVictimColor: string;
  meetingCutInSec: number;
  meetingTimer: number;
  votes: Record<string, string>;
  aiBotChatSent: Record<string, boolean>;
  chatHistory: ChatEntry[];
  ejectionState: {
    open: boolean;
    text: string;
    subtext: string;
    ejectedColor?: string;
    ejectedHat?: string;
  } | null;
  winner: string;
  winReason: string;
  elapsedMatchSec: number;
  keysDown: Record<string, boolean>;
  joystick: { dx: number; dy: number };
  lastMoveSyncAt: number;
  lastHostBroadcastAt: number;
}

const PUBLIC_DIR_PEER_ID = 'starship-impostor-deluxe-public-dir-v1';
const LOCAL_PUBLIC_ROOMS_KEY = 'starship_impostor_public_rooms_v1';
const KEYBINDS_STORAGE_KEY = 'starship_impostor_keybinds_v1';

function createDefaultEnabledRoles(): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  SPECIAL_ROLE_KEYS.forEach((rk) => {
    m[rk] = true;
  });
  return m;
}

function createInitialSettings(): GameSettings {
  return {
    mapId: 'starship',
    impostors: 1,
    killCooldown: 25,
    spawnKillCooldown: 10,
    meetingTime: 60,
    taskCount: 4,
    specialRolesCount: 5,
    enabledRoles: createDefaultEnabledRoles()
  };
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function App() {
  const [myId] = useState<string>(() => {
    const saved = safeSessionGet('sid_player_id');
    if (saved) return saved;
    const id = 'p_' + Math.random().toString(36).slice(2, 10);
    safeSessionSet('sid_player_id', id);
    return id;
  });

  const [keybinds, setKeybinds] = useState<Record<string, string>>(() => {
    try {
      const raw = safeLocalGet(KEYBINDS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_KEYBINDS, ...JSON.parse(raw) };
    } catch {
      // ignore parse errors
    }
    return { ...DEFAULT_KEYBINDS };
  });

  const [customPublicUrl, setCustomPublicUrl] = useState<string>(
    () => safeLocalGet('sid_public_url') || ''
  );

  const [publicRooms, setPublicRooms] = useState<Record<string, PublicRoomSummary>>({});
  const [netStatus, setNetStatus] = useState<{ label: string; color: string }>({
    label: '接続待機中...',
    color: 'text-amber-300'
  });
  const [muted, setMuted] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // モーダルステート
  const [showRolesGuide, setShowRolesGuide] = useState(false);
  const [showKeybindModal, setShowKeybindModal] = useState(false);
  const [listeningAction, setListeningAction] = useState<string | null>(null);
  const [showNetConfig, setShowNetConfig] = useState(false);
  const [roleRevealOpen, setRoleRevealOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskDef | null>(null);
  const [showSabotageModal, setShowSabotageModal] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [gimmickModalMode, setGimmickModalMode] = useState<'vitals' | 'doorlog' | null>(null);
  const [ejectionBanner, setEjectionBanner] = useState<{
    open: boolean;
    text: string;
    subtext: string;
    ejectedColor?: string;
    ejectedHat?: string;
  }>({
    open: false,
    text: '',
    subtext: ''
  });
  const [reportCutIn, setReportCutIn] = useState<{
    open: boolean;
    reason: 'body' | 'emergency';
    callerName: string;
    callerColor: string;
    callerHat: string;
    victimName?: string;
    victimColor?: string;
  } | null>(null);
  const [killFlash, setKillFlash] = useState<{
    kind: 'killed' | 'shield' | 'strike';
    title: string;
    subtitle: string;
  } | null>(null);

  // React描画用の同期バージョン
  const [, setUiTick] = useState(0);
  const forceUiUpdate = useCallback(() => {
    setUiTick((v) => (v + 1) % 1000000);
  }, []);

  const lobbyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const roleRevealTimerRef = useRef<number | null>(null);
  const reportCutInTimerRef = useRef<number | null>(null);
  const killFlashTimerRef = useRef<number | null>(null);
  const prevEjectOpenRef = useRef(false);
  const hasOverlayOpenRef = useRef(false);
  hasOverlayOpenRef.current =
    showMiniMap ||
    Boolean(gimmickModalMode) ||
    Boolean(activeTask) ||
    showSabotageModal ||
    roleRevealOpen ||
    Boolean(reportCutIn?.open) ||
    ejectionBanner.open;

  // PeerJS通信用Refs
  const peerRef = useRef<Peer | null>(null);
  const hostConnRef = useRef<DataConnection | null>(null);
  const clientConnsRef = useRef<Record<string, DataConnection>>({});
  const dirPeerRef = useRef<Peer | null>(null);
  const dirConnsRef = useRef<DataConnection[]>([]);
  const dirRoomsRef = useRef<Record<string, PublicRoomSummary>>({});
  const bcRef = useRef<BroadcastChannel | null>(null);
  const netModeRef = useRef<'p2p' | 'offline'>(
    isCanvasPreviewEnvironment() || window.location.search.includes('autostart=1') ? 'offline' : 'p2p'
  );

  const simRef = useRef<SimState>({
    phase: 'title',
    isHost: false,
    isPublicRoom: true,
    roomCode: '',
    myId,
    myName: safeSessionGet('sid_name') || 'CREW-' + Math.floor(10 + Math.random() * 89),
    myColor: safeSessionGet('sid_color') || 'cyan',
    myHat: safeSessionGet('sid_hat') || 'none',
    myPet: safeSessionGet('sid_pet') || 'none',
    myKillEffect: safeSessionGet('sid_kill_effect') || 'classic',
    players: {},
    bodies: [],
    abilityTraces: [],
    killTimeline: [],
    killEffectBursts: [],
    settings: createInitialSettings(),
    myTasks: [],
    completedTasks: {},
    sabotage: null,
    sabotageCooldown: 0,
    killCooldown: 0,
    douseCooldown: 0,
    oiledPlayers: {},
    doctorUsed: false,
    radarUsesLeft: 3,
    radarTimer: 0,
    radarCooldown: 0,
    securityUsesLeft: 2,
    securityShieldTimer: 0,
    securityCooldown: 0,
    survivorUsesLeft: 3,
    survivorShieldTimer: 0,
    survivorCooldown: 0,
    trackedTargetId: null,
    teleportUsesLeft: 2,
    teleportCooldown: 0,
    psychicTimer: 0,
    psychicCooldown: 0,
    phantomTimer: 0,
    phantomCooldown: 0,
    disguiseTimer: 0,
    disguiseCooldown: 0,
    ghostHauntCooldown: 0,
    hauntedTimer: 0,
    hauntedTargets: {},
    ventStayTimer: 0,
    ventUseCooldown: 0,
    currentVentIndex: 0,
    myShieldTimer: 0,
    mySlowTimer: 0,
    emergencyCooldown: 0,
    boostTimer: 0,
    sonarPingTimer: 0,
    adminTimer: 0,
    crystalBeaconTimer: 0,
    bellRingTimer: 0,
    bellPos: null,
    cameraWatchTimer: 0,
    cameraWatchGimmick: null,
    cameraFeedIndex: 0,
    gimmickCooldowns: {},
    activeDoorLocks: [],
    remoteClosedDoors: [],
    remoteCameraActive: false,
    doorLogs: [],
    doorLogSensorCooldowns: {},
    iceVx: 0,
    iceVy: 0,
    sandstormActive: false,
    steamActive: false,
    meetingReason: 'emergency',
    meetingCaller: '',
    meetingCallerColor: 'cyan',
    meetingCallerHat: 'none',
    meetingVictimName: '',
    meetingVictimColor: '',
    meetingCutInSec: 0,
    meetingTimer: 60,
    votes: {},
    aiBotChatSent: {},
    chatHistory: [],
    ejectionState: null,
    winner: '',
    winReason: '',
    elapsedMatchSec: 0,
    keysDown: {},
    joystick: { dx: 0, dy: 0 },
    lastMoveSyncAt: 0,
    lastHostBroadcastAt: 0
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 3200);
  }, []);

  const triggerKillFlash = useCallback(
    (kind: 'killed' | 'shield' | 'strike', title: string, subtitle: string) => {
      if (killFlashTimerRef.current) window.clearTimeout(killFlashTimerRef.current);
      setKillFlash({ kind, title, subtitle });
      killFlashTimerRef.current = window.setTimeout(() => {
        setKillFlash(null);
      }, 950);
    },
    []
  );

  const triggerReportCutIn = useCallback(
    (payload: {
      reason: 'body' | 'emergency';
      callerName: string;
      callerColor: string;
      callerHat: string;
      victimName?: string;
      victimColor?: string;
    }) => {
      if (reportCutInTimerRef.current) window.clearTimeout(reportCutInTimerRef.current);
      setReportCutIn({ open: true, ...payload });
      sound.playBodyReport();
      reportCutInTimerRef.current = window.setTimeout(() => {
        setReportCutIn(null);
      }, 1700);
    },
    []
  );

  // document.body.dataset.state を常に同期
  const setPhase = useCallback(
    (nextPhase: GamePhase) => {
      simRef.current.phase = nextPhase;
      document.body.dataset.state = nextPhase;
      forceUiUpdate();
    },
    [forceUiUpdate]
  );

  useEffect(() => {
    document.body.dataset.state = simRef.current.phase;
  }, []);

  // 公開ルームディレクトリ更新
  const syncLocalPublicRooms = useCallback((rooms: Record<string, PublicRoomSummary>) => {
    const now = Date.now();
    const cleaned: Record<string, PublicRoomSummary> = {};
    Object.values(rooms).forEach((r) => {
      if (r && r.code && r.isPublic && now - (r.updatedAt || 0) < 35000) {
        cleaned[r.code] = r;
      }
    });
    setPublicRooms(cleaned);
    return cleaned;
  }, []);

  const refreshPublicRooms = useCallback(() => {
    let merged: Record<string, PublicRoomSummary> = {};
    try {
      const raw = safeLocalGet(LOCAL_PUBLIC_ROOMS_KEY);
      if (raw) merged = JSON.parse(raw);
    } catch {
      merged = {};
    }
    if (simRef.current.isHost && simRef.current.isPublicRoom && simRef.current.roomCode) {
      const curMap = MAPS_DEF[simRef.current.settings.mapId] || MAPS_DEF.starship;
      merged[simRef.current.roomCode] = {
        code: simRef.current.roomCode,
        hostName: simRef.current.myName,
        mapId: curMap.id,
        mapName: curMap.name,
        playerCount: Object.keys(simRef.current.players).length || 1,
        maxPlayers: 15,
        phase: simRef.current.phase === 'lobby' ? 'lobby' : 'playing',
        isPublic: true,
        updatedAt: Date.now()
      };
    }
    syncLocalPublicRooms(merged);

    if (netModeRef.current === 'p2p' && typeof Peer !== 'undefined') {
      try {
        const queryPeer = new Peer();
        queryPeer.on('open', () => {
          const conn = queryPeer.connect(PUBLIC_DIR_PEER_ID, { reliable: true });
          const timer = window.setTimeout(() => {
            try {
              queryPeer.destroy();
            } catch {
              // ignore
            }
          }, 2500);
          conn.on('open', () => {
            conn.send({ type: 'dir_list_req' });
          });
          conn.on('data', (rawData: unknown) => {
            const msg = rawData as { type?: string; rooms?: Record<string, PublicRoomSummary> };
            if (msg && msg.type === 'dir_list_res' && msg.rooms) {
              setPublicRooms((prev) => syncLocalPublicRooms({ ...prev, ...msg.rooms }));
              window.clearTimeout(timer);
              try {
                queryPeer.destroy();
              } catch {
                // ignore
              }
            }
          });
          conn.on('error', () => {
            window.clearTimeout(timer);
            try {
              queryPeer.destroy();
            } catch {
              // ignore
            }
          });
        });
        queryPeer.on('error', () => {
          try {
            queryPeer.destroy();
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }
    }
  }, [syncLocalPublicRooms]);

  const publishRoomToDirectory = useCallback(
    (forceRemove = false) => {
      const sim = simRef.current;
      if (!sim.isHost || !sim.roomCode) return;
      const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const summary: PublicRoomSummary | null =
        !forceRemove && sim.isPublicRoom && (sim.phase === 'lobby' || sim.phase === 'playing' || sim.phase === 'meeting')
          ? {
              code: sim.roomCode,
              hostName: sim.myName,
              mapId: curMap.id,
              mapName: curMap.name,
              playerCount: Object.keys(sim.players).length || 1,
              maxPlayers: 15,
              phase: sim.phase === 'lobby' ? 'lobby' : 'playing',
              isPublic: true,
              updatedAt: Date.now()
            }
          : null;

      try {
        const raw = safeLocalGet(LOCAL_PUBLIC_ROOMS_KEY);
        const stored: Record<string, PublicRoomSummary> = raw ? JSON.parse(raw) : {};
        if (summary) stored[sim.roomCode] = summary;
        else delete stored[sim.roomCode];
        safeLocalSet(LOCAL_PUBLIC_ROOMS_KEY, JSON.stringify(stored));
        syncLocalPublicRooms(stored);
      } catch {
        // ignore
      }

      if (bcRef.current) {
        try {
          bcRef.current.postMessage({ type: 'dir_update', code: sim.roomCode, summary });
        } catch {
          // ignore
        }
      }

      if (netModeRef.current === 'p2p' && peerRef.current && peerRef.current.open) {
        try {
          const dirConn = peerRef.current.connect(PUBLIC_DIR_PEER_ID, { reliable: true });
          dirConn.on('open', () => {
            dirConn.send({ type: 'dir_upsert', code: sim.roomCode, summary });
            window.setTimeout(() => {
              try {
                dirConn.close();
              } catch {
                // ignore
              }
            }, 600);
          });
        } catch {
          // ignore
        }
      }
    },
    [syncLocalPublicRooms]
  );

  // 通信ネットワーク初期化
  const initNetwork = useCallback(() => {
    if (netModeRef.current === 'offline') {
      setNetStatus({ label: 'オフライン / AIソロモード', color: 'text-emerald-300' });
      return;
    }
    try {
      const dirPeer = new Peer(PUBLIC_DIR_PEER_ID, { debug: 0 });
      dirPeerRef.current = dirPeer;
      dirPeer.on('connection', (conn) => {
        dirConnsRef.current.push(conn);
        conn.on('data', (raw: unknown) => {
          const msg = raw as { type?: string; code?: string; summary?: PublicRoomSummary | null };
          if (!msg) return;
          const now = Date.now();
          Object.keys(dirRoomsRef.current).forEach((k) => {
            if (now - dirRoomsRef.current[k].updatedAt > 35000) delete dirRoomsRef.current[k];
          });
          if (msg.type === 'dir_upsert' && msg.code) {
            if (msg.summary) dirRoomsRef.current[msg.code] = msg.summary;
            else delete dirRoomsRef.current[msg.code];
            setPublicRooms((prev) => syncLocalPublicRooms({ ...prev, ...dirRoomsRef.current }));
            dirConnsRef.current.forEach((c) => {
              if (c.open) c.send({ type: 'dir_list_res', rooms: dirRoomsRef.current });
            });
          } else if (msg.type === 'dir_list_req') {
            conn.send({ type: 'dir_list_res', rooms: dirRoomsRef.current });
          }
        });
        conn.on('close', () => {
          dirConnsRef.current = dirConnsRef.current.filter((c) => c !== conn);
        });
      });
      dirPeer.on('error', () => {
        // 既に他タブがディレクトリマスターを担っている場合は正常
      });
    } catch {
      // ignore
    }

    setNetStatus({ label: 'P2Pオンライン待機完了', color: 'text-emerald-300' });
  }, [syncLocalPublicRooms]);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('starship_impostor_dir_v1');
        bcRef.current = bc;
        bc.onmessage = (ev) => {
          if (ev.data && ev.data.type === 'dir_update') {
            setPublicRooms((prev) => {
              const copy = { ...prev };
              if (ev.data.summary) copy[ev.data.code] = ev.data.summary;
              else delete copy[ev.data.code];
              return syncLocalPublicRooms(copy);
            });
          }
        };
      } catch {
        // ignore
      }
    }
    initNetwork();
    refreshPublicRooms();

    const interval = window.setInterval(() => {
      if (simRef.current.isHost && simRef.current.isPublicRoom && simRef.current.roomCode) {
        publishRoomToDirectory(false);
      }
      if (simRef.current.phase === 'title') {
        refreshPublicRooms();
      }
    }, 8000);

    return () => {
      window.clearInterval(interval);
      try {
        bcRef.current?.close();
        peerRef.current?.destroy();
        dirPeerRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, [initNetwork, publishRoomToDirectory, refreshPublicRooms, syncLocalPublicRooms]);

  // ホスト用ブロードキャスト
  const broadcastRoomState = useCallback(() => {
    const sim = simRef.current;
    if (!sim.isHost) return;
    const nowMs = Date.now();
    const payload = {
      type: 'room_state',
      phase: sim.phase,
      settings: sim.settings,
      players: sim.players,
      bodies: sim.bodies,
      killTimeline: sim.killTimeline,
      killBursts: sim.killEffectBursts.filter((b) => nowMs - b.startedAt < b.durationMs),
      hauntedTargets: sim.hauntedTargets,
      sabotage: sim.sabotage,
      closedDoors: sim.activeDoorLocks.map((d) => d.rect),
      anyCameraActive: sim.cameraWatchTimer > 0,
      bellRingTimer: sim.bellRingTimer,
      bellPos: sim.bellPos,
      sandstormActive: sim.sandstormActive,
      steamActive: sim.steamActive,
      meetingReason: sim.meetingReason,
      meetingCaller: sim.meetingCaller,
      meetingCallerColor: sim.meetingCallerColor,
      meetingCallerHat: sim.meetingCallerHat,
      meetingVictimName: sim.meetingVictimName,
      meetingVictimColor: sim.meetingVictimColor,
      meetingTimer: sim.meetingTimer,
      votes: sim.votes,
      chatHistory: sim.chatHistory.slice(-45),
      doorLogs: sim.doorLogs.slice(-30),
      ejectionState: sim.ejectionState,
      winner: sim.winner,
      winReason: sim.winReason
    };
    Object.values(clientConnsRef.current).forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const sendToHost = useCallback((msg: Record<string, unknown>) => {
    const conn = hostConnRef.current;
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch {
        // ignore
      }
    }
  }, []);

  const spawnKillBurst = useCallback((x: number, y: number, effectId: string | undefined, colorId: string) => {
    const sim = simRef.current;
    const cObj = CREW_COLORS.find((c) => c.id === colorId) || CREW_COLORS[0];
    sim.killEffectBursts.push({
      id: 'kb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      x,
      y,
      effectId: effectId || 'classic',
      colorHex: cObj.hex,
      startedAt: Date.now(),
      durationMs: 850
    });
    if (sim.killEffectBursts.length > 16) {
      sim.killEffectBursts = sim.killEffectBursts.slice(-16);
    }
  }, []);

  const recordKillEventHost = useCallback(
    (killer: PlayerState, victim: PlayerState, method: 'kill' | 'misfire' | 'eject') => {
      const sim = simRef.current;
      const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const roomName = getCurrentRoomName(victim.x, victim.y, curMap);
      if (method === 'kill') {
        killer.killsCount = (killer.killsCount || 0) + 1;
      }
      sim.killTimeline.push({
        id: 'ke_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        timeSec: Math.round(sim.elapsedMatchSec),
        killerId: killer.id,
        killerName: killer.name,
        killerColor: killer.color,
        killerRole: killer.role,
        victimId: victim.id,
        victimName: victim.name,
        victimColor: victim.color,
        victimRole: victim.role,
        roomName,
        method,
        killEffect: method === 'kill' ? victim.killEffect || 'classic' : undefined
      });
    },
    []
  );

  const appendChat = useCallback(
    (sender: string, text: string, color: string, isGhost = false, stampId?: string) => {
      const sim = simRef.current;
      sim.chatHistory.push({
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        sender,
        text,
        color,
        isGhost,
        stampId
      });
      if (sim.chatHistory.length > 60) sim.chatHistory = sim.chatHistory.slice(-60);
      if (sim.isHost) broadcastRoomState();
      forceUiUpdate();
    },
    [broadcastRoomState, forceUiUpdate]
  );

  // 勝利チェック＆終了処理（ホスト）
  const endGameHost = useCallback(
    (winner: string, reason: string) => {
      const sim = simRef.current;
      if (sim.phase === 'gameover') return;
      sim.winner = winner;
      sim.winReason = reason;
      setPhase('gameover');
      setShowMiniMap(false);
      setActiveTask(null);
      setShowSabotageModal(false);
      setGimmickModalMode(null);
      broadcastRoomState();
      publishRoomToDirectory(false);

      const me = sim.players[sim.myId];
      const iWon =
        (me?.alive && me?.role === 'survivor') ||
        (winner === 'crewmates' && me && hasCrewTasks(me.role)) ||
        (winner === 'impostors' && me && isImpostorTeam(me.role)) ||
        (winner === 'jester' && me?.role === 'jester') ||
        (winner === 'jackal' && me?.role === 'jackal') ||
        (winner === 'arsonist' && me?.role === 'arsonist');
      if (iWon) sound.playWin();
      else sound.playLose();
    },
    [broadcastRoomState, publishRoomToDirectory, setPhase]
  );

  const checkWinConditionsHost = useCallback(() => {
    const sim = simRef.current;
    if (!sim.isHost || (sim.phase !== 'playing' && sim.phase !== 'meeting')) return;
    const res = evaluateWinCondition(sim.players, sim.settings.taskCount);
    if (res) {
      endGameHost(res.winner, res.reason);
    }
  }, [endGameHost]);

  // 会議開始（ホスト）
  const startMeetingHost = useCallback(
    (
      reason: 'body' | 'emergency',
      callerName: string,
      callerColor = 'cyan',
      callerHat = 'none',
      victim?: { name: string; color: string }
    ) => {
      const sim = simRef.current;
      if (!sim.isHost || sim.phase !== 'playing') return;
      const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      sim.bodies = [];
      sim.killEffectBursts = [];
      sim.sabotage = null;
      sim.cameraWatchTimer = 0;
      sim.cameraWatchGimmick = null;
      sim.activeDoorLocks = [];
      sim.meetingReason = reason;
      sim.meetingCaller = callerName;
      sim.meetingCallerColor = callerColor;
      sim.meetingCallerHat = callerHat;
      sim.meetingVictimName = victim?.name || '';
      sim.meetingVictimColor = victim?.color || '';
      sim.meetingCutInSec = 1.7;
      sim.meetingTimer = sim.settings.meetingTime;
      sim.votes = {};
      sim.aiBotChatSent = {};

      const allIds = Object.keys(sim.players);
      allIds.forEach((id, idx) => {
        const p = sim.players[id];
        p.inVent = false;
        p.invisible = false;
        p.shielded = false;
        p.disguisedAs = null;
        const angle = (idx / Math.max(1, allIds.length)) * Math.PI * 2;
        const pos = findSafeSpawnPosition(
          curMap.emergency.x + Math.cos(angle) * 95,
          curMap.emergency.y + Math.sin(angle) * 95,
          curMap
        );
        p.x = pos.x;
        p.y = pos.y;
        p.targetX = pos.x;
        p.targetY = pos.y;
      });

      sim.phantomTimer = 0;
      sim.disguiseTimer = 0;
      sim.securityShieldTimer = 0;
      sim.survivorShieldTimer = 0;

      setActiveTask(null);
      setShowSabotageModal(false);
      setShowMiniMap(false);
      setGimmickModalMode(null);
      setPhase('meeting');
      triggerReportCutIn({
        reason,
        callerName,
        callerColor,
        callerHat,
        victimName: victim?.name,
        victimColor: victim?.color
      });
      appendChat(
        'SYSTEM',
        reason === 'body' ? `📢 ${callerName} が死体を発見しました！` : `🚨 ${callerName} が緊急会議を招集しました！`,
        '#f43f5e'
      );
      broadcastRoomState();
    },
    [appendChat, broadcastRoomState, setPhase, triggerReportCutIn]
  );

  // 投票終了＆追放（ホスト）
  const finishMeetingHost = useCallback(() => {
    const sim = simRef.current;
    if (!sim.isHost || sim.phase !== 'meeting') return;
    const { ejectedId, tie } = tallyVotes(sim.votes, sim.players);

    let ejectText = '誰も追放されませんでした（スキップ）';
    let subText = '会議が終了し、任務が再開されます';
    let ejectedColor: string | undefined;
    let ejectedHat: string | undefined;
    let jesterWon = false;

    if (ejectedId && sim.players[ejectedId]) {
      const target = sim.players[ejectedId];
      target.alive = false;
      recordKillEventHost(target, target, 'eject');
      ejectedColor = target.color;
      ejectedHat = target.hat || 'none';
      ejectText = `${target.name} は宇宙空間へ追放されました...`;
      if (target.role === 'jester') {
        subText = `🤡 ${target.name} は【テルテル (Jester)】でした！単独勝利！`;
        jesterWon = true;
      } else {
        const rDef = ROLES_DEF[target.role] || ROLES_DEF.crewmate;
        subText = `${target.name} の正体は【${rDef.jp}】でした`;
      }
    } else if (tie) {
      ejectText = '同票のため誰も追放されませんでした';
    }

    const ejectPayload = { open: true, text: ejectText, subtext: subText, ejectedColor, ejectedHat };
    sim.ejectionState = ejectPayload;
    setEjectionBanner(ejectPayload);
    sound.playEject();
    broadcastRoomState();

    window.setTimeout(() => {
      sim.ejectionState = null;
      setEjectionBanner({ open: false, text: '', subtext: '' });
      if (jesterWon) {
        endGameHost('jester', `${sim.players[ejectedId!]?.name || 'Jester'}（テルテル）が会議で追放され単独勝利しました！`);
        return;
      }
      sim.killCooldown = Math.max(sim.killCooldown, 12);
      sim.emergencyCooldown = 18;
      setPhase('playing');
      checkWinConditionsHost();
      broadcastRoomState();
    }, 3200);
  }, [broadcastRoomState, checkWinConditionsHost, endGameHost, recordKillEventHost, setPhase]);

  // マップ固有タスクを優先したタスク割り当て
  const assignTasksForPlayer = useCallback((count: number, curMap: MapDef): string[] => {
    const spotTaskIds = Array.from(new Set(curMap.taskSpots.map((s) => s.taskId)));
    const themedIds = spotTaskIds.filter((tid) => ALL_TASKS.find((t) => t.id === tid)?.themeTag);
    const regularIds = spotTaskIds.filter((tid) => !themedIds.includes(tid));
    const shuffledThemed = [...themedIds].sort(() => Math.random() - 0.5);
    const shuffledRegular = [...regularIds].sort(() => Math.random() - 0.5);
    const ordered = [...shuffledThemed, ...shuffledRegular];
    if (ordered.length > 0) {
      return ordered.slice(0, Math.min(ordered.length, count));
    }
    return [...ALL_TASKS].sort(() => Math.random() - 0.5).slice(0, count).map((t) => t.id);
  }, []);

  // マッチ開始（ホスト）
  const startGameHost = useCallback(
    (skipRevealModal = false) => {
      const sim = simRef.current;
      if (!sim.isHost) return;
      const ids = Object.keys(sim.players);
      if (ids.length < 1) return;

      const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const roleMap = assignRoles(ids, sim.settings);

      sim.bodies = [];
      sim.abilityTraces = [];
      sim.killTimeline = [];
      sim.killEffectBursts = [];
      sim.sabotage = null;
      sim.sabotageCooldown = 10;
      sim.oiledPlayers = {};
      sim.doctorUsed = false;
      sim.radarUsesLeft = 3;
      sim.radarTimer = 0;
      sim.radarCooldown = 0;
      sim.securityUsesLeft = 2;
      sim.securityShieldTimer = 0;
      sim.securityCooldown = 0;
      sim.survivorUsesLeft = 3;
      sim.survivorShieldTimer = 0;
      sim.survivorCooldown = 0;
      sim.trackedTargetId = null;
      sim.teleportUsesLeft = 2;
      sim.teleportCooldown = 0;
      sim.psychicTimer = 0;
      sim.psychicCooldown = 0;
      sim.phantomTimer = 0;
      sim.phantomCooldown = 0;
      sim.disguiseTimer = 0;
      sim.disguiseCooldown = 0;
      sim.ghostHauntCooldown = 0;
      sim.hauntedTimer = 0;
      sim.hauntedTargets = {};
      sim.ventStayTimer = 0;
      sim.ventUseCooldown = 0;
      sim.myShieldTimer = 0;
      sim.mySlowTimer = 0;
      sim.emergencyCooldown = 12;
      sim.boostTimer = 0;
      sim.sonarPingTimer = 0;
      sim.adminTimer = 0;
      sim.crystalBeaconTimer = 0;
      sim.bellRingTimer = 0;
      sim.bellPos = null;
      sim.cameraWatchTimer = 0;
      sim.cameraWatchGimmick = null;
      sim.cameraFeedIndex = 0;
      sim.gimmickCooldowns = {};
      sim.activeDoorLocks = [];
      sim.doorLogs = [];
      sim.doorLogSensorCooldowns = {};
      sim.iceVx = 0;
      sim.iceVy = 0;
      sim.elapsedMatchSec = 0;

      ids.forEach((id, idx) => {
        const p = sim.players[id];
        p.role = roleMap[id] || 'crewmate';
        p.alive = true;
        p.inVent = false;
        p.invisible = false;
        p.shielded = false;
        p.disguisedAs = null;
        p.tasksDone = 0;
        p.killsCount = 0;
        p.aiGoal = null;
        p.aiWait = 0.5 + Math.random() * 1.5;
        p.aiKillCd = sim.settings.spawnKillCooldown;
        const angle = (idx / Math.max(1, ids.length)) * Math.PI * 2;
        const pos = findSafeSpawnPosition(
          curMap.emergency.x + Math.cos(angle) * 105,
          curMap.emergency.y + Math.sin(angle) * 105,
          curMap
        );
        p.x = pos.x;
        p.y = pos.y;
        p.targetX = pos.x;
        p.targetY = pos.y;
      });

      const me = sim.players[sim.myId];
      const spawnCd = sim.settings.spawnKillCooldown;
      sim.killCooldown = spawnCd;
      sim.douseCooldown = spawnCd;
      sim.completedTasks = {};
      sim.myTasks = me && hasCrewTasks(me.role)
        ? assignTasksForPlayer(getPlayerTaskTargetCount(me, sim.settings.taskCount), curMap)
        : [];

      // 各クライアントへ個別役職・タスク通知
      Object.entries(clientConnsRef.current).forEach(([peerId, conn]) => {
        if (!conn.open) return;
        const p = Object.values(sim.players).find((pl) => pl.peerId === peerId || pl.id === peerId);
        if (!p) return;
        const tasks = hasCrewTasks(p.role)
          ? assignTasksForPlayer(getPlayerTaskTargetCount(p, sim.settings.taskCount), curMap)
          : [];
        try {
          conn.send({ type: 'match_start', role: p.role, tasks });
        } catch {
          // ignore
        }
      });

      sim.ejectionState = null;
      setPhase('playing');
      publishRoomToDirectory(false);
      broadcastRoomState();

      if (!skipRevealModal) {
        const myRoleDef = ROLES_DEF[me?.role || 'crewmate'] || ROLES_DEF.crewmate;
        sound.playRoleReveal(myRoleDef.team);
        setRoleRevealOpen(true);
        if (roleRevealTimerRef.current) window.clearTimeout(roleRevealTimerRef.current);
        roleRevealTimerRef.current = window.setTimeout(() => setRoleRevealOpen(false), 3200);
      }
    },
    [assignTasksForPlayer, broadcastRoomState, publishRoomToDirectory, setPhase]
  );

  // ルーム作成・AIボット追加・退出
  const addBotHost = useCallback(
    (silent = false) => {
      const sim = simRef.current;
      if (!sim.isHost) return;
      const curCount = Object.keys(sim.players).length;
      if (curCount >= 15) {
        if (!silent) showToast('定員（15人）に達しています');
        return;
      }
      const usedNames = new Set(Object.values(sim.players).map((p) => p.name));
      const usedColors = new Set(Object.values(sim.players).map((p) => p.color));
      const freeName = BOT_NAMES.find((n) => !usedNames.has(n)) || `BOT-${curCount + 1}`;
      const freeColor = CREW_COLORS.find((c) => !usedColors.has(c.id))?.id || CREW_COLORS[curCount % CREW_COLORS.length].id;
      const nonEmptyPets = CREW_PETS.filter((p) => p.id !== 'none');
      const randPet =
        Math.random() < 0.7 ? nonEmptyPets[Math.floor(Math.random() * nonEmptyPets.length)].id : 'none';
      const randKillEffect = KILL_EFFECTS[Math.floor(Math.random() * KILL_EFFECTS.length)].id;
      const botId = 'bot_' + Math.random().toString(36).slice(2, 8);
      const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const pos = findSafeSpawnPosition(
        curMap.emergency.x + (Math.random() - 0.5) * 140,
        curMap.emergency.y + (Math.random() - 0.5) * 140,
        curMap
      );
      sim.players[botId] = {
        id: botId,
        name: freeName,
        color: freeColor,
        hat: 'none',
        pet: randPet,
        killEffect: randKillEffect,
        x: pos.x,
        y: pos.y,
        targetX: pos.x,
        targetY: pos.y,
        facing: 1,
        role: 'crewmate',
        alive: true,
        invisible: false,
        inVent: false,
        shielded: false,
        disguisedAs: null,
        isBot: true,
        tasksDone: 0,
        killsCount: 0
      };
      if (!silent) {
        broadcastRoomState();
        publishRoomToDirectory(false);
        forceUiUpdate();
      }
    },
    [broadcastRoomState, forceUiUpdate, publishRoomToDirectory, showToast]
  );

  // 受信メッセージ処理（ホスト側）
  const handleHostClientMessage = useCallback(
    (senderConn: DataConnection, raw: unknown) => {
      const sim = simRef.current;
      if (!sim.isHost) return;
      const msg = raw as Record<string, unknown>;
      if (!msg || typeof msg.type !== 'string') return;
      const pid = String(msg.playerId || '');
      const sender = sim.players[pid];

      if (msg.type === 'join_req') {
        if (Object.keys(sim.players).length >= 15) {
          senderConn.send({ type: 'join_err', message: 'ルームが満員です' });
          return;
        }
        const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
        const pos = findSafeSpawnPosition(curMap.emergency.x, curMap.emergency.y + 50, curMap);
        sim.players[pid] = {
          id: pid,
          peerId: senderConn.peer,
          name: String(msg.name || 'CREW').slice(0, 10),
          color: String(msg.color || 'cyan'),
          hat: String(msg.hat || 'none'),
          pet: String(msg.pet || 'none'),
          killEffect: String(msg.killEffect || 'classic'),
          x: pos.x,
          y: pos.y,
          targetX: pos.x,
          targetY: pos.y,
          facing: 1,
          role: 'crewmate',
          alive: true,
          invisible: false,
          inVent: false,
          shielded: false,
          disguisedAs: null,
          isBot: false,
          tasksDone: 0,
          killsCount: 0
        };
        broadcastRoomState();
        publishRoomToDirectory(false);
        forceUiUpdate();
      } else if (msg.type === 'customize' && sender) {
        if (typeof msg.name === 'string' && msg.name.trim()) sender.name = msg.name.trim().slice(0, 10);
        if (typeof msg.color === 'string') sender.color = msg.color;
        if (typeof msg.hat === 'string') sender.hat = msg.hat;
        if (typeof msg.pet === 'string') sender.pet = msg.pet;
        if (typeof msg.killEffect === 'string') sender.killEffect = msg.killEffect;
        broadcastRoomState();
        forceUiUpdate();
      } else if (msg.type === 'move' && sender) {
        sender.x = Number(msg.x || sender.x);
        sender.y = Number(msg.y || sender.y);
        sender.targetX = sender.x;
        sender.targetY = sender.y;
        sender.facing = Number(msg.facing || 1);
      } else if (msg.type === 'chat' && sender) {
        const cObj = CREW_COLORS.find((c) => c.id === sender.color) || CREW_COLORS[0];
        appendChat(
          sender.name,
          String(msg.text || '').slice(0, 90),
          cObj.hex,
          Boolean(msg.isGhost),
          typeof msg.stampId === 'string' ? msg.stampId : undefined
        );
      } else if (msg.type === 'task_done' && sender) {
        sender.tasksDone = (sender.tasksDone || 0) + 1;
        checkWinConditionsHost();
        broadcastRoomState();
      } else if (msg.type === 'kill_req' && sender && sender.alive) {
        const target = sim.players[String(msg.targetId || '')];
        if (!target || !target.alive) return;
        if (target.shielded) {
          senderConn.send({ type: 'shield_blocked' });
          return;
        }
        if (sender.role === 'sheriff' && !isImpostorTeam(target.role) && target.role !== 'jackal' && target.role !== 'arsonist') {
          sender.alive = false;
          recordKillEventHost(sender, sender, 'misfire');
          spawnKillBurst(sender.x, sender.y, sender.killEffect, sender.color);
          sim.bodies.push({
            id: 'b_' + Date.now(),
            playerId: sender.id,
            name: sender.name,
            color: sender.color,
            killerColor: sender.color,
            killedAt: Date.now(),
            dissolveTimer: null,
            x: sender.x,
            y: sender.y
          });
        } else {
          target.alive = false;
          recordKillEventHost(sender, target, 'kill');
          spawnKillBurst(target.x, target.y, target.killEffect, target.color);
          sim.bodies.push({
            id: 'b_' + Date.now(),
            playerId: target.id,
            name: target.name,
            color: target.color,
            killerColor: sender.color,
            killedAt: Date.now(),
            dissolveTimer: sender.role === 'viper' ? 12 : null,
            x: target.x,
            y: target.y
          });
          sim.abilityTraces.push({ x: target.x, y: target.y, timer: 25 });
        }
        checkWinConditionsHost();
        broadcastRoomState();
      } else if (msg.type === 'ghost_mischief_req' && sender && !sender.alive) {
        const target = sim.players[String(msg.targetId || '')];
        if (target && target.alive && (isImpostorTeam(target.role) || target.role === 'jackal')) {
          sim.hauntedTargets[target.id] = 3.5;
          if (target.id === sim.myId) {
            sim.hauntedTimer = 3.5;
            sound.playGhostHaunt();
          }
          broadcastRoomState();
        }
      } else if (msg.type === 'report_req' && sender && sender.alive) {
        const isBody = msg.reason === 'body';
        const nearBody = isBody
          ? sim.bodies
              .slice()
              .sort((a, b) => Math.hypot(a.x - sender.x, a.y - sender.y) - Math.hypot(b.x - sender.x, b.y - sender.y))[0]
          : undefined;
        startMeetingHost(
          isBody ? 'body' : 'emergency',
          sender.name,
          sender.color,
          sender.hat || 'none',
          nearBody ? { name: nearBody.name, color: nearBody.color } : undefined
        );
      } else if (msg.type === 'sabotage_req' && sender) {
        if (!sim.sabotage) {
          const stype = msg.sabotageType === 'reactor' ? 'reactor' : 'lights';
          sim.sabotage = { type: stype, timer: stype === 'reactor' ? 35 : 999 };
          sound.playSabotageTrigger();
          broadcastRoomState();
        }
      } else if (msg.type === 'fix_sabotage' && sender && sender.alive) {
        sim.sabotage = null;
        broadcastRoomState();
      } else if (msg.type === 'vote_cast' && sender && sender.alive && sim.phase === 'meeting') {
        sim.votes[sender.id] = String(msg.targetId || 'skip');
        const aliveIds = Object.values(sim.players)
          .filter((p) => p.alive)
          .map((p) => p.id);
        if (aliveIds.every((id) => Boolean(sim.votes[id]))) {
          finishMeetingHost();
        } else {
          broadcastRoomState();
        }
      } else if (msg.type === 'lock_door_req' && msg.rect) {
        const rect = msg.rect as MapRect;
        sim.activeDoorLocks.push({
          id: String(msg.gimmickId || 'door'),
          rect,
          expiresAt: Date.now() + Number(msg.durationSec || 5) * 1000
        });
        broadcastRoomState();
      } else if (msg.type === 'bell_req' && msg.pos) {
        sim.bellRingTimer = Number(msg.durationSec || 5);
        sim.bellPos = msg.pos as { x: number; y: number };
        broadcastRoomState();
      } else if (msg.type === 'ability_state' && sender) {
        if (typeof msg.inVent === 'boolean') sender.inVent = msg.inVent;
        if (typeof msg.invisible === 'boolean') sender.invisible = msg.invisible;
        if (typeof msg.shielded === 'boolean') sender.shielded = msg.shielded;
        if (typeof msg.x === 'number') sender.x = msg.x;
        if (typeof msg.y === 'number') sender.y = msg.y;
        if ('disguisedAs' in msg) {
          sender.disguisedAs = msg.disguisedAs as PlayerState['disguisedAs'];
        }
        broadcastRoomState();
      } else if (msg.type === 'revive_req' && sender && sender.alive) {
        const bodyId = String(msg.bodyId || '');
        const bIdx = sim.bodies.findIndex((b) => b.id === bodyId);
        if (bIdx !== -1) {
          const b = sim.bodies[bIdx];
          const revived = sim.players[b.playerId];
          if (revived) {
            revived.alive = true;
            revived.x = b.x;
            revived.y = b.y;
            revived.shielded = true;
          }
          sim.bodies.splice(bIdx, 1);
          broadcastRoomState();
        }
      } else if (msg.type === 'arsonist_win') {
        endGameHost('arsonist', `${sender?.name || 'Arsonist'} が生存者全員にオイルを塗布して一斉点火しました！`);
      }
    },
    [
      appendChat,
      broadcastRoomState,
      checkWinConditionsHost,
      endGameHost,
      finishMeetingHost,
      forceUiUpdate,
      publishRoomToDirectory,
      recordKillEventHost,
      spawnKillBurst,
      startMeetingHost
    ]
  );

  // ルーム作成
  const createRoom = useCallback(
    (options?: { botCount?: number; autoStartMatch?: boolean; silent?: boolean }) => {
      if (!options?.silent) {
        sound.init();
        sound.playClick();
      }
      const sim = simRef.current;
      const code = generateRoomCode();
      sim.isHost = true;
      sim.roomCode = code;
      sim.players = {};
      sim.bodies = [];
      sim.killTimeline = [];
      sim.killEffectBursts = [];
      sim.hauntedTargets = {};
      sim.hauntedTimer = 0;
      sim.ghostHauntCooldown = 0;
      sim.chatHistory = [];
      sim.sabotage = null;

      const curMap = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const pos = findSafeSpawnPosition(curMap.emergency.x, curMap.emergency.y + 50, curMap);
      sim.players[sim.myId] = {
        id: sim.myId,
        name: sim.myName || 'CREW',
        color: sim.myColor,
        hat: sim.myHat,
        pet: sim.myPet,
        killEffect: sim.myKillEffect,
        x: pos.x,
        y: pos.y,
        targetX: pos.x,
        targetY: pos.y,
        facing: 1,
        role: 'crewmate',
        alive: true,
        invisible: false,
        inVent: false,
        shielded: false,
        disguisedAs: null,
        isBot: false,
        tasksDone: 0,
        killsCount: 0
      };

      if (netModeRef.current === 'p2p' && typeof Peer !== 'undefined') {
        try {
          peerRef.current?.destroy();
          const hp = new Peer('starship-room-' + code, { debug: 0 });
          peerRef.current = hp;
          hp.on('open', () => {
            setNetStatus({ label: `ホスト中 (${code})`, color: 'text-emerald-300' });
            publishRoomToDirectory(false);
          });
          hp.on('connection', (conn) => {
            clientConnsRef.current[conn.peer] = conn;
            conn.on('data', (data) => handleHostClientMessage(conn, data));
            conn.on('close', () => {
              delete clientConnsRef.current[conn.peer];
            });
          });
          hp.on('error', () => {
            setNetStatus({ label: 'ローカル / AI対戦モード', color: 'text-amber-300' });
          });
        } catch {
          setNetStatus({ label: 'ローカル / AI対戦モード', color: 'text-amber-300' });
        }
      }

      const botsToAdd = options?.botCount ?? 0;
      for (let i = 0; i < botsToAdd; i++) {
        addBotHost(true);
      }

      if (options?.autoStartMatch) {
        startGameHost(true);
      } else {
        setPhase('lobby');
        publishRoomToDirectory(false);
      }
    },
    [addBotHost, handleHostClientMessage, publishRoomToDirectory, setPhase, startGameHost]
  );

  // ルーム参加（クライアント）
  const joinRoomByCode = useCallback(
    (codeInput: string) => {
      const code = codeInput.trim().toUpperCase();
      if (code.length < 4) {
        showToast('5桁のルームコードを入力してください');
        return;
      }
      if (netModeRef.current === 'offline') {
        showToast('オフラインモード中です。オンライン設定からP2P接続に切り替えてください');
        return;
      }
      sound.init();
      sound.playClick();
      const sim = simRef.current;
      sim.isHost = false;
      sim.roomCode = code;

      try {
        peerRef.current?.destroy();
        const cp = new Peer({ debug: 0 });
        peerRef.current = cp;
        setNetStatus({ label: `接続中 (${code})...`, color: 'text-amber-300' });

        cp.on('open', () => {
          const conn = cp.connect('starship-room-' + code, { reliable: true });
          hostConnRef.current = conn;
          conn.on('open', () => {
            setNetStatus({ label: `参加中 (${code})`, color: 'text-emerald-300' });
            conn.send({
              type: 'join_req',
              playerId: sim.myId,
              name: sim.myName,
              color: sim.myColor,
              hat: sim.myHat,
              pet: sim.myPet,
              killEffect: sim.myKillEffect
            });
            setPhase('lobby');
          });
          conn.on('data', (raw: unknown) => {
            const msg = raw as Record<string, unknown>;
            if (!msg) return;
            if (msg.type === 'join_err') {
              showToast(String(msg.message || '参加できませんでした'));
              setPhase('title');
            } else if (msg.type === 'room_state') {
              const prevPlayers = sim.players;
              const incomingPlayers = (msg.players as Record<string, PlayerState>) || {};
              Object.keys(incomingPlayers).forEach((pid) => {
                if (pid === sim.myId && prevPlayers[pid]) {
                  // 自分の座標はローカル移動予測を維持（会議やフェーズ切替時はホスト座標を採用）
                  if (msg.phase === sim.phase && sim.phase === 'playing') {
                    incomingPlayers[pid].x = prevPlayers[pid].x;
                    incomingPlayers[pid].y = prevPlayers[pid].y;
                  }
                }
              });
              const prevPhase = sim.phase;
              const prevMeAlive = Boolean(prevPlayers[sim.myId]?.alive);
              const prevSabotage = sim.sabotage;
              sim.players = incomingPlayers;
              sim.settings = (msg.settings as GameSettings) || sim.settings;
              sim.bodies = (msg.bodies as BodyState[]) || [];
              if (Array.isArray(msg.killTimeline)) {
                sim.killTimeline = msg.killTimeline as KillEvent[];
              }
              if (Array.isArray(msg.killBursts)) {
                const existingIds = new Set(sim.killEffectBursts.map((b) => b.id));
                for (const kb of msg.killBursts as KillEffectBurst[]) {
                  if (!existingIds.has(kb.id)) {
                    sim.killEffectBursts.push(kb);
                  }
                }
              }
              const incomingHaunted = (msg.hauntedTargets as Record<string, number>) || {};
              const myHauntLeft = Number(incomingHaunted[sim.myId] || 0);
              if (myHauntLeft > 0 && sim.hauntedTimer <= 0) {
                sound.playGhostHaunt();
              }
              sim.hauntedTimer = myHauntLeft;
              sim.sabotage = (msg.sabotage as SimState['sabotage']) || null;
              sim.meetingReason = (msg.meetingReason as 'body' | 'emergency') || 'emergency';
              sim.meetingCaller = String(msg.meetingCaller || '');
              sim.meetingCallerColor = String(msg.meetingCallerColor || 'cyan');
              sim.meetingCallerHat = String(msg.meetingCallerHat || 'none');
              sim.meetingVictimName = String(msg.meetingVictimName || '');
              sim.meetingVictimColor = String(msg.meetingVictimColor || '');
              sim.meetingTimer = Number(msg.meetingTimer || 0);
              sim.votes = (msg.votes as Record<string, string>) || {};
              sim.chatHistory = (msg.chatHistory as ChatEntry[]) || [];
              sim.doorLogs = (msg.doorLogs as string[]) || [];
              sim.winner = String(msg.winner || '');
              sim.winReason = String(msg.winReason || '');
              sim.sandstormActive = Boolean(msg.sandstormActive);
              sim.steamActive = Boolean(msg.steamActive);
              sim.remoteClosedDoors = Array.isArray(msg.closedDoors) ? (msg.closedDoors as MapRect[]) : [];
              sim.remoteCameraActive = Boolean(msg.anyCameraActive);
              sim.bellRingTimer = Number(msg.bellRingTimer || 0);
              sim.bellPos = (msg.bellPos as { x: number; y: number } | null) || null;
              const ejectIncoming = (msg.ejectionState as SimState['ejectionState']) || null;
              if (ejectIncoming?.open && !prevEjectOpenRef.current) {
                prevEjectOpenRef.current = true;
                setEjectionBanner(ejectIncoming);
                sound.playEject();
              } else if (!ejectIncoming?.open && prevEjectOpenRef.current) {
                prevEjectOpenRef.current = false;
                setEjectionBanner({ open: false, text: '', subtext: '' });
              }

              const nextPhase = (msg.phase as GamePhase) || prevPhase;
              const nowMe = sim.players[sim.myId];
              if (prevPhase === 'playing' && nextPhase === 'playing' && prevMeAlive && nowMe && !nowMe.alive) {
                sound.playKill();
                triggerKillFlash('killed', 'ELIMINATED', 'インポスターに襲撃されました...');
              }
              if (!prevSabotage && sim.sabotage && nextPhase === 'playing') {
                sound.playSabotageTrigger();
              }
              if (nextPhase !== prevPhase) {
                if (nextPhase === 'meeting' && prevPhase === 'playing') {
                  triggerReportCutIn({
                    reason: sim.meetingReason,
                    callerName: sim.meetingCaller,
                    callerColor: sim.meetingCallerColor,
                    callerHat: sim.meetingCallerHat,
                    victimName: sim.meetingVictimName || undefined,
                    victimColor: sim.meetingVictimColor || undefined
                  });
                } else if (nextPhase === 'gameover') {
                  const iWon = Boolean(
                    nowMe &&
                      ((nowMe.alive && nowMe.role === 'survivor') ||
                        (sim.winner === 'crewmates' && hasCrewTasks(nowMe.role)) ||
                        (sim.winner === 'impostors' && isImpostorTeam(nowMe.role)) ||
                        (sim.winner === 'jester' && nowMe.role === 'jester') ||
                        (sim.winner === 'jackal' && nowMe.role === 'jackal') ||
                        (sim.winner === 'arsonist' && nowMe.role === 'arsonist'))
                  );
                  if (iWon) sound.playWin();
                  else sound.playLose();
                }
                setPhase(nextPhase);
              } else {
                forceUiUpdate();
              }
            } else if (msg.type === 'match_start') {
              const me = sim.players[sim.myId];
              const assignedRole = String(msg.role || 'crewmate');
              if (me) me.role = assignedRole;
              const roleDef = ROLES_DEF[assignedRole] || ROLES_DEF.crewmate;
              sim.myTasks = (msg.tasks as string[]) || [];
              sim.completedTasks = {};
              sim.killTimeline = [];
              sim.killEffectBursts = [];
              sim.ghostHauntCooldown = 0;
              sim.hauntedTimer = 0;
              sim.killCooldown = sim.settings.spawnKillCooldown;
              sim.douseCooldown = sim.settings.spawnKillCooldown;
              setPhase('playing');
              sound.playRoleReveal(roleDef.team);
              setRoleRevealOpen(true);
              if (roleRevealTimerRef.current) window.clearTimeout(roleRevealTimerRef.current);
              roleRevealTimerRef.current = window.setTimeout(() => setRoleRevealOpen(false), 3200);
            } else if (msg.type === 'shield_blocked') {
              sound.playShieldBlock();
              triggerKillFlash('shield', 'SHIELD BLOCKED!', 'バリア・防弾ベストが攻撃を弾いた！');
              showToast('🛡️ バリア・防弾ベストによってキルが防がれました！');
            }
          });
          conn.on('close', () => {
            showToast('ホストとの接続が切断されました');
            setPhase('title');
          });
        });
        cp.on('error', () => {
          showToast('ルームが見つからないか接続に失敗しました');
          setNetStatus({ label: '接続エラー', color: 'text-rose-400' });
        });
      } catch {
        showToast('通信エラーが発生しました');
      }
    },
    [forceUiUpdate, setPhase, showToast, triggerKillFlash, triggerReportCutIn]
  );

  // URLパラメータチェック (?room= / ?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('autostart');
    const room = params.get('room');
    if (auto === '1') {
      createRoom({ botCount: 4, autoStartMatch: true, silent: true });
    } else if (room) {
      joinRoomByCode(room);
    }
  }, [createRoom, joinRoomByCode]);

  // 近接ギミック探索
  const findNearestGimmick = useCallback((x: number, y: number, mapDef: MapDef): MapGimmick | null => {
    let best: MapGimmick | null = null;
    let bestD = 75;
    for (const g of mapDef.gimmicks) {
      if (['ice', 'low_gravity', 'conveyor', 'spore_mist', 'steam_hazard', 'sandstorm_zone'].includes(g.type)) continue;
      const d = Math.hypot(g.x - x, g.y - y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }, []);

  // 各種プレイヤーアクション
  const performUseAction = useCallback(() => {
    const sim = simRef.current;
    const me = sim.players[sim.myId];
    if (!me || sim.phase !== 'playing') return;
    const mapDef = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;

    // 監視カメラ視聴中なら終了
    if (sim.cameraWatchTimer > 0) {
      sim.cameraWatchTimer = 0;
      sim.cameraWatchGimmick = null;
      forceUiUpdate();
      return;
    }

    // 1. サボタージュ修理
    if (sim.sabotage && me.alive) {
      const fixPt = mapDef.sabotageFix[sim.sabotage.type];
      if (fixPt && Math.hypot(fixPt.x - me.x, fixPt.y - me.y) < 88) {
        sound.playTaskDone();
        if (sim.isHost) {
          sim.sabotage = null;
          broadcastRoomState();
        } else {
          sendToHost({ type: 'fix_sabotage', playerId: sim.myId });
        }
        showToast('🔧 緊急サボタージュを修理しました！');
        forceUiUpdate();
        return;
      }
    }

    // 2. タスク実行
    if (hasCrewTasks(me.role)) {
      for (const tid of sim.myTasks) {
        if (sim.completedTasks[tid]) continue;
        const spot = mapDef.taskSpots.find((s) => s.taskId === tid);
        if (spot && Math.hypot(spot.x - me.x, spot.y - me.y) < 76) {
          const tObj = ALL_TASKS.find((t) => t.id === tid);
          if (tObj) {
            sound.playClick();
            setActiveTask(tObj);
            return;
          }
        }
      }
    }

    // 3. マップ固有ギミック発動
    if (me.alive) {
      const g = findNearestGimmick(me.x, me.y, mapDef);
      if (g) {
        const gKey = g.id || `${g.type}_${g.x}_${g.y}`;
        const cdLeft = sim.gimmickCooldowns[gKey] || 0;
        if (cdLeft > 0) {
          showToast(`⏳ ${g.label} クールダウン中（あと ${Math.ceil(cdLeft)}秒）`);
          return;
        }
        sound.playClick();
        if (g.type === 'boost_vent') {
          sim.boostTimer = g.durationSec ?? 3;
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 10;
          showToast('🔥 地熱気流ブースト発動！（移動速度UP）');
        } else if (g.type === 'sonar') {
          sim.sonarPingTimer = g.durationSec ?? 4.5;
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 18;
          showToast('📡 深海ソナー発動！周囲のクルー位置を4.5秒間探知します');
        } else if (g.type === 'teleport') {
          const target =
            mapDef.gimmicks.find((other) => other.type === 'teleport' && other.id === g.targetId) ||
            mapDef.gimmicks.find((other) => other.type === 'teleport' && other !== g);
          if (target) {
            const safe = findSafeSpawnPosition(target.x, target.y, mapDef);
            me.x = safe.x;
            me.y = safe.y;
            me.targetX = safe.x;
            me.targetY = safe.y;
            sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 12;
            sim.abilityTraces.push({ x: safe.x, y: safe.y, timer: 18 });
            showToast(`⚡ ${target.label} へ高速移動しました！`);
          }
        } else if (g.type === 'camera') {
          sim.cameraWatchTimer = 18;
          sim.cameraWatchGimmick = g;
          sim.cameraFeedIndex = 0;
          showToast('📹 監視カメラ映像を表示中（Tabキーで切替 / Eで終了）');
        } else if (g.type === 'admin') {
          sim.adminTimer = g.durationSec ?? 5;
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 12;
          setShowMiniMap(true);
          showToast('🗺️ アドミン盤を起動！各部屋の生存人数を表示します');
        } else if (g.type === 'vitals') {
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 14;
          setGimmickModalMode('vitals');
        } else if (g.type === 'doorlog') {
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 10;
          setGimmickModalMode('doorlog');
        } else if (g.type === 'lockdown_door' && g.doorRect) {
          const dur = g.durationSec ?? 5;
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 22;
          sound.playDoor();
          if (sim.isHost) {
            sim.activeDoorLocks.push({
              id: gKey,
              rect: g.doorRect,
              expiresAt: Date.now() + dur * 1000
            });
            broadcastRoomState();
          } else {
            sendToHost({
              type: 'lock_door_req',
              playerId: sim.myId,
              gimmickId: gKey,
              rect: g.doorRect,
              durationSec: dur
            });
          }
          showToast(`🔒 隔壁ドアを${dur}秒間緊急封鎖しました！`);
        } else if (g.type === 'crystal_beacon') {
          sim.crystalBeaconTimer = g.durationSec ?? 6;
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 18;
          showToast('💎 クリスタル共鳴灯台起動！（視界拡大）');
        } else if (g.type === 'emf_scanner') {
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 12;
          const traces = sim.abilityTraces.filter((t) => Math.hypot(t.x - me.x, t.y - me.y) < 520);
          const nearBodies = sim.bodies.filter((b) => Math.hypot(b.x - me.x, b.y - me.y) < 520);
          const total = traces.length + nearBodies.length;
          if (total > 0) {
            showToast(`⚡ EMFスキャナー反応！半径520px以内に異常痕跡 ${total}件 を検知！`);
          } else {
            showToast('⚡ EMFスキャナー：周囲520px以内に異常反応なし');
          }
        } else if (g.type === 'bell') {
          const dur = g.durationSec ?? 5;
          sim.gimmickCooldowns[gKey] = g.cooldownSec ?? 15;
          sound.playAlarm();
          if (sim.isHost) {
            sim.bellRingTimer = dur;
            sim.bellPos = { x: g.x, y: g.y };
            broadcastRoomState();
          } else {
            sendToHost({ type: 'bell_req', playerId: sim.myId, pos: { x: g.x, y: g.y }, durationSec: dur });
          }
          showToast('🔔 警鐘を鳴らし、全員に現在地の方向を通知しました！');
        }
        forceUiUpdate();
        return;
      }

      // 4. 緊急会議ボタン
      if (Math.hypot(mapDef.emergency.x - me.x, mapDef.emergency.y - me.y) < 92) {
        if (sim.emergencyCooldown > 0) {
          showToast(`緊急会議ボタンはあと ${Math.ceil(sim.emergencyCooldown)}秒 使用できません`);
          return;
        }
        if (sim.isHost) {
          startMeetingHost('emergency', me.name, me.color, me.hat || 'none');
        } else {
          sendToHost({ type: 'report_req', playerId: sim.myId, reason: 'emergency' });
        }
      }
    }
  }, [broadcastRoomState, findNearestGimmick, forceUiUpdate, sendToHost, showToast, startMeetingHost]);

  const performReportAction = useCallback(() => {
    const sim = simRef.current;
    const me = sim.players[sim.myId];
    if (!me || !me.alive || sim.phase !== 'playing') return;
    const nearBody = sim.bodies.find((b) => Math.hypot(b.x - me.x, b.y - me.y) < 110);
    if (!nearBody) return;
    if (sim.isHost) {
      startMeetingHost('body', me.name, me.color, me.hat || 'none', {
        name: nearBody.name,
        color: nearBody.color
      });
    } else {
      sendToHost({ type: 'report_req', playerId: sim.myId, reason: 'body' });
    }
  }, [sendToHost, startMeetingHost]);

  const performKillAction = useCallback(() => {
    const sim = simRef.current;
    const me = sim.players[sim.myId];
    if (!me || !me.alive || sim.phase !== 'playing') return;

    if (me.role === 'arsonist') {
      const othersAlive = Object.values(sim.players).filter((p) => p.alive && p.id !== me.id);
      const allOiled = othersAlive.length > 0 && othersAlive.every((p) => Boolean(sim.oiledPlayers[p.id]));
      if (allOiled) {
        sound.playAlarm();
        if (sim.isHost) {
          endGameHost('arsonist', `${me.name}（アーソニスト）が生存者全員にオイルを塗布し一斉点火で勝利しました！`);
        } else {
          sendToHost({ type: 'arsonist_win', playerId: sim.myId });
        }
        return;
      }
      if (sim.douseCooldown > 0) return;
      const target = othersAlive
        .filter((p) => !sim.oiledPlayers[p.id])
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (target && Math.hypot(target.x - me.x, target.y - me.y) < 115) {
        sim.oiledPlayers[target.id] = true;
        sim.douseCooldown = 16;
        sound.playClick();
        showToast(`🛢️ ${target.name} にオイルを塗布しました！`);
        forceUiUpdate();
      }
      return;
    }

    if (!canKillRole(me.role) || sim.killCooldown > 0 || me.inVent) return;
    if (me.role === 'phantom' && me.invisible) {
      showToast('👻 透明化中はキルできません！');
      return;
    }

    const candidates = Object.values(sim.players).filter((p) => {
      if (!p.alive || p.id === me.id || p.inVent) return false;
      if (isImpostorTeam(me.role) && isImpostorTeam(p.role)) return false;
      return Math.hypot(p.x - me.x, p.y - me.y) < 115;
    });
    const target = candidates.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    if (!target) return;

    sim.killCooldown = getRoleKillCooldown(me.role, sim.settings.killCooldown);
    if (me.role === 'shapeshifter' && me.disguisedAs) {
      me.disguisedAs = null;
      sim.disguiseTimer = 0;
    }

    if (sim.isHost) {
      if (target.shielded) {
        sound.playShieldBlock();
        triggerKillFlash('shield', 'SHIELD BLOCKED!', 'バリア・防弾ベストが攻撃を弾いた！');
        showToast('🛡️ バリア・防弾ベストによってキルが防がれました！');
        return;
      }
      sound.playKill();
      if (me.role === 'sheriff' && !isImpostorTeam(target.role) && target.role !== 'jackal' && target.role !== 'arsonist') {
        me.alive = false;
        recordKillEventHost(me, me, 'misfire');
        spawnKillBurst(me.x, me.y, me.killEffect, me.color);
        sim.bodies.push({
          id: 'b_' + Date.now(),
          playerId: me.id,
          name: me.name,
          color: me.color,
          killerColor: me.color,
          killedAt: Date.now(),
          dissolveTimer: null,
          x: me.x,
          y: me.y
        });
        triggerKillFlash('killed', 'MISFIRE!', '罪のないクルーを撃ち脱落しました...');
        showToast('💥 誤射！罪のないクルーを撃って自爆しました...');
      } else {
        target.alive = false;
        recordKillEventHost(me, target, 'kill');
        spawnKillBurst(target.x, target.y, target.killEffect, target.color);
        sim.bodies.push({
          id: 'b_' + Date.now(),
          playerId: target.id,
          name: target.name,
          color: target.color,
          killerColor: me.color,
          killedAt: Date.now(),
          dissolveTimer: me.role === 'viper' ? 12 : null,
          x: target.x,
          y: target.y
        });
        sim.abilityTraces.push({ x: target.x, y: target.y, timer: 25 });
        triggerKillFlash('strike', 'TARGET ELIMINATED', `${target.name} を排除しました`);
      }
      checkWinConditionsHost();
      broadcastRoomState();
    } else {
      sound.playKill();
      spawnKillBurst(target.x, target.y, target.killEffect, target.color);
      triggerKillFlash('strike', 'STRIKE!', `${target.name} へ攻撃を仕掛けた`);
      sendToHost({ type: 'kill_req', playerId: sim.myId, targetId: target.id });
    }
    forceUiUpdate();
  }, [
    broadcastRoomState,
    checkWinConditionsHost,
    endGameHost,
    forceUiUpdate,
    recordKillEventHost,
    sendToHost,
    showToast,
    spawnKillBurst,
    triggerKillFlash
  ]);

  const jumpToVent = useCallback(
    (idx: number) => {
      const sim = simRef.current;
      const me = sim.players[sim.myId];
      if (!me || !me.inVent) return;
      const mapDef = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const v = mapDef.vents[idx];
      if (!v) return;
      sim.currentVentIndex = idx;
      me.x = v.x;
      me.y = v.y;
      me.targetX = v.x;
      me.targetY = v.y;
      sound.playVent();
      if (!sim.isHost) {
        sendToHost({ type: 'ability_state', playerId: sim.myId, inVent: true, x: me.x, y: me.y });
      } else {
        broadcastRoomState();
      }
      forceUiUpdate();
    },
    [broadcastRoomState, forceUiUpdate, sendToHost]
  );

  const performVentAction = useCallback(() => {
    const sim = simRef.current;
    const me = sim.players[sim.myId];
    if (!me || !me.alive || sim.phase !== 'playing' || !canUseVentRole(me.role)) return;
    const mapDef = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;

    if (me.inVent) {
      me.inVent = false;
      if (me.role === 'engineer') {
        sim.ventUseCooldown = 15;
        sim.ventStayTimer = 0;
      }
      sound.playVent();
      if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, inVent: false });
      else broadcastRoomState();
      forceUiUpdate();
      return;
    }

    if (me.role === 'engineer' && sim.ventUseCooldown > 0) {
      showToast(`⏳ エンジニアのベントはあと ${Math.ceil(sim.ventUseCooldown)}秒 使用できません`);
      return;
    }

    const idx = mapDef.vents.findIndex((v) => Math.hypot(v.x - me.x, v.y - me.y) < 75);
    if (idx === -1) return;
    me.inVent = true;
    sim.currentVentIndex = idx;
    if (me.role === 'engineer') sim.ventStayTimer = 12;
    sound.playVent();
    if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, inVent: true });
    else broadcastRoomState();
    forceUiUpdate();
  }, [broadcastRoomState, forceUiUpdate, sendToHost, showToast]);

  const performAbilityAction = useCallback(() => {
    const sim = simRef.current;
    const me = sim.players[sim.myId];
    if (!me || sim.phase !== 'playing') return;
    const mapDef = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;

    if (!me.alive) {
      if (sim.ghostHauntCooldown > 0) {
        showToast(`👻 イタズラはあと ${Math.ceil(sim.ghostHauntCooldown)}秒 使用できません`);
        return;
      }
      const threats = Object.values(sim.players)
        .filter((p) => p.alive && (isImpostorTeam(p.role) || p.role === 'jackal'))
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
      const target = threats[0];
      if (!target) {
        showToast('👻 妨害対象のインポスターが見つかりません');
        return;
      }
      sim.ghostHauntCooldown = 35;
      sound.playGhostHaunt();
      if (sim.isHost) {
        sim.hauntedTargets[target.id] = 3.5;
        if (target.id === sim.myId) sim.hauntedTimer = 3.5;
        broadcastRoomState();
      } else {
        sendToHost({ type: 'ghost_mischief_req', playerId: sim.myId, targetId: target.id });
      }
      showToast(`👻 ${target.name} の視界を少しだけ歪めるイタズラを実行！（CD 35秒）`);
      forceUiUpdate();
      return;
    }

    if (me.role === 'doctor') {
      if (sim.doctorUsed) return;
      const body = sim.bodies.find((b) => Math.hypot(b.x - me.x, b.y - me.y) < 95);
      if (!body) {
        showToast('近くに蘇生できる死体がありません');
        return;
      }
      sim.doctorUsed = true;
      sound.playTaskDone();
      if (sim.isHost) {
        const target = sim.players[body.playerId];
        if (target) {
          target.alive = true;
          target.x = body.x;
          target.y = body.y;
          target.shielded = true;
          window.setTimeout(() => {
            target.shielded = false;
            broadcastRoomState();
          }, 3000);
        }
        sim.bodies = sim.bodies.filter((b) => b.id !== body.id);
        broadcastRoomState();
      } else {
        sendToHost({ type: 'revive_req', playerId: sim.myId, bodyId: body.id });
      }
      showToast(`⚕️ ${body.name} を蘇生しました！（3秒無敵付与）`);
    } else if (me.role === 'detective') {
      const body = sim.bodies.find((b) => Math.hypot(b.x - me.x, b.y - me.y) < 95);
      if (!body) {
        showToast('近くに調査できる死体がありません');
        return;
      }
      const kColor = CREW_COLORS.find((c) => c.id === body.killerColor)?.name || body.killerColor;
      const elapsed = Math.max(1, Math.round((Date.now() - body.killedAt) / 1000));
      sound.playClick();
      showToast(`🔍 調査結果: 犯人のスーツは【${kColor}】系、死亡から約 ${elapsed}秒 経過！`);
    } else if (me.role === 'radar') {
      if (sim.radarUsesLeft <= 0 || sim.radarCooldown > 0) return;
      sim.radarUsesLeft -= 1;
      sim.radarTimer = 6;
      sim.radarCooldown = 20;
      sound.playClick();
      setShowMiniMap(true);
      showToast(`📡 レーダー探知起動！（残り ${sim.radarUsesLeft}回）`);
    } else if (me.role === 'security') {
      if (sim.securityUsesLeft <= 0 || sim.securityCooldown > 0) return;
      sim.securityUsesLeft -= 1;
      sim.securityShieldTimer = 6;
      sim.securityCooldown = 22;
      me.shielded = true;
      sound.playShieldBlock();
      if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, shielded: true });
      else broadcastRoomState();
      showToast(`🛡️ セキュリティバリア展開！（6秒間キル無効＆移動+15% / 残り ${sim.securityUsesLeft}回）`);
    } else if (me.role === 'survivor') {
      if (sim.survivorUsesLeft <= 0 || sim.survivorCooldown > 0) return;
      sim.survivorUsesLeft -= 1;
      sim.survivorShieldTimer = 7;
      sim.survivorCooldown = 20;
      me.shielded = true;
      sound.playShieldBlock();
      if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, shielded: true });
      else broadcastRoomState();
      showToast(`🦺 防弾ベスト展開！（7秒間キル無効 / 残り ${sim.survivorUsesLeft}回）`);
    } else if (me.role === 'tracker') {
      const target = Object.values(sim.players)
        .filter((p) => p.alive && p.id !== me.id)
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (!target || Math.hypot(target.x - me.x, target.y - me.y) > 120) {
        showToast('発信機を取り付ける相手が近くにいません');
        return;
      }
      sim.trackedTargetId = target.id;
      sound.playClick();
      showToast(`📍 ${target.name} に追跡発信機を取り付けました！（全体マップに表示）`);
    } else if (me.role === 'teleporter') {
      if (sim.teleportUsesLeft <= 0 || sim.teleportCooldown > 0) return;
      sim.teleportUsesLeft -= 1;
      sim.teleportCooldown = 35;
      const safe = findSafeSpawnPosition(mapDef.emergency.x, mapDef.emergency.y + 55, mapDef);
      me.x = safe.x;
      me.y = safe.y;
      me.targetX = safe.x;
      me.targetY = safe.y;
      sim.abilityTraces.push({ x: safe.x, y: safe.y, timer: 25 });
      sound.playVent();
      showToast(`✨ 緊急帰還テレポート完了！（残り ${sim.teleportUsesLeft}回）`);
    } else if (me.role === 'psychic') {
      if (sim.psychicCooldown > 0) return;
      sim.psychicTimer = 5;
      sim.psychicCooldown = 25;
      sound.playClick();
      showToast('🔮 霊視発動！死体方角と能力残滓を5秒間可視化します');
    } else if (me.role === 'phantom') {
      if (sim.phantomCooldown > 0) return;
      sim.phantomTimer = 6;
      sim.phantomCooldown = 22;
      me.invisible = true;
      sound.playVent();
      if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, invisible: true });
      else broadcastRoomState();
      showToast('👻 透明化！（6秒間・透明化中はキル不可）');
    } else if (me.role === 'shapeshifter') {
      if (sim.disguiseCooldown > 0) return;
      const target = Object.values(sim.players)
        .filter((p) => p.alive && p.id !== me.id)
        .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
      if (!target || Math.hypot(target.x - me.x, target.y - me.y) > 200) {
        showToast('近くにコピーできる生存者がいません（200px以内）');
        return;
      }
      sim.disguiseTimer = 10;
      sim.disguiseCooldown = 25;
      me.disguisedAs = { name: target.name, color: target.color, hat: target.hat };
      sound.playClick();
      if (!sim.isHost) {
        sendToHost({ type: 'ability_state', playerId: sim.myId, disguisedAs: me.disguisedAs });
      } else {
        broadcastRoomState();
      }
      showToast(`🎭 ${target.name} に変装しました！（10秒間 / キルで解除）`);
    }
    forceUiUpdate();
  }, [broadcastRoomState, forceUiUpdate, sendToHost, showToast]);

  // 60FPS メインゲームループ（requestAnimationFrame）
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let lastUiSync = 0;
    let lastCanvasDrawAt = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      const me = sim.players[sim.myId];
      const mapDef = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;
      const nowMs = Date.now();

      // ロビーキャンバス移動＆描画
      if (sim.phase === 'lobby' && me && lobbyCanvasRef.current) {
        let vx = sim.joystick.dx;
        let vy = sim.joystick.dy;
        if (sim.keysDown[keybinds.moveUp] || sim.keysDown['ArrowUp']) vy -= 1;
        if (sim.keysDown[keybinds.moveDown] || sim.keysDown['ArrowDown']) vy += 1;
        if (sim.keysDown[keybinds.moveLeft] || sim.keysDown['ArrowLeft']) vx -= 1;
        if (sim.keysDown[keybinds.moveRight] || sim.keysDown['ArrowRight']) vx += 1;
        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
          vx = (vx / mag) * 230;
          vy = (vy / mag) * 230;
          if (vx < -5) me.facing = -1;
          else if (vx > 5) me.facing = 1;
          me.x = Math.max(40, Math.min(560, me.x + vx * dt));
          me.y = Math.max(40, Math.min(260, me.y + vy * dt));
          if (!sim.isHost && now - sim.lastMoveSyncAt > 65) {
            sim.lastMoveSyncAt = now;
            sendToHost({ type: 'move', playerId: sim.myId, x: me.x, y: me.y, facing: me.facing });
          }
        }
        const canvas = lobbyCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const cw = Math.floor(rect.width);
          const ch = Math.floor(rect.height);
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#091122';
            ctx.fillRect(0, 0, cw, ch);
            ctx.strokeStyle = 'rgba(56,189,248,0.12)';
            ctx.lineWidth = 1;
            for (let gx = 0; gx < cw; gx += 40) {
              ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke();
            }
            for (let gy = 0; gy < ch; gy += 40) {
              ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
            }
            const sx = cw / 600;
            const sy = ch / 300;
            ctx.save();
            ctx.scale(sx, sy);
            Object.values(sim.players).forEach((p, idx) => {
              const px = Math.max(36, Math.min(564, p.x % 560 || 120 + idx * 45));
              const py = Math.max(44, Math.min(260, p.y % 250 || 140));
              if (p.pet && p.pet !== 'none') {
                drawPetSprite(
                  ctx,
                  px - (p.facing || 1) * 24,
                  py + 8,
                  p.pet,
                  p.color,
                  p.facing || 1,
                  p.id === sim.myId && mag > 0,
                  nowMs
                );
              }
              drawCrewmateSprite(ctx, px, py, p.color, p.hat || 'none', p.facing || 1, true, false, 1, false, nowMs);
              ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText(p.name, px, py - 34);
            });
            ctx.restore();
          }
        }
      }

      // ゲームプレイ中シミュレーション
      if (sim.phase === 'playing' && me) {
        sim.elapsedMatchSec += dt;

        // タイマー更新
        if (sim.killCooldown > 0) sim.killCooldown = Math.max(0, sim.killCooldown - dt);
        if (sim.douseCooldown > 0) sim.douseCooldown = Math.max(0, sim.douseCooldown - dt);
        if (sim.sabotageCooldown > 0) sim.sabotageCooldown = Math.max(0, sim.sabotageCooldown - dt);
        if (sim.emergencyCooldown > 0) sim.emergencyCooldown = Math.max(0, sim.emergencyCooldown - dt);
        if (sim.ghostHauntCooldown > 0) sim.ghostHauntCooldown = Math.max(0, sim.ghostHauntCooldown - dt);
        if (sim.hauntedTimer > 0) sim.hauntedTimer = Math.max(0, sim.hauntedTimer - dt);
        sim.killEffectBursts = sim.killEffectBursts.filter((b) => nowMs - b.startedAt < b.durationMs);
        if (sim.isHost) {
          Object.keys(sim.hauntedTargets).forEach((tid) => {
            const left = Math.max(0, (sim.hauntedTargets[tid] || 0) - dt);
            if (left <= 0) delete sim.hauntedTargets[tid];
            else sim.hauntedTargets[tid] = left;
          });
          if ((sim.hauntedTargets[sim.myId] || 0) > 0) {
            sim.hauntedTimer = sim.hauntedTargets[sim.myId];
          }
        }
        if (sim.boostTimer > 0) sim.boostTimer = Math.max(0, sim.boostTimer - dt);
        if (sim.sonarPingTimer > 0) sim.sonarPingTimer = Math.max(0, sim.sonarPingTimer - dt);
        if (sim.adminTimer > 0) sim.adminTimer = Math.max(0, sim.adminTimer - dt);
        if (sim.crystalBeaconTimer > 0) sim.crystalBeaconTimer = Math.max(0, sim.crystalBeaconTimer - dt);
        if (sim.bellRingTimer > 0) {
          sim.bellRingTimer = Math.max(0, sim.bellRingTimer - dt);
          if (sim.bellRingTimer === 0) sim.bellPos = null;
        }
        if (sim.radarTimer > 0) sim.radarTimer = Math.max(0, sim.radarTimer - dt);
        if (sim.radarCooldown > 0) sim.radarCooldown = Math.max(0, sim.radarCooldown - dt);
        if (sim.psychicTimer > 0) sim.psychicTimer = Math.max(0, sim.psychicTimer - dt);
        if (sim.psychicCooldown > 0) sim.psychicCooldown = Math.max(0, sim.psychicCooldown - dt);
        if (sim.teleportCooldown > 0) sim.teleportCooldown = Math.max(0, sim.teleportCooldown - dt);
        if (sim.ventUseCooldown > 0) sim.ventUseCooldown = Math.max(0, sim.ventUseCooldown - dt);

        if (sim.securityShieldTimer > 0) {
          sim.securityShieldTimer = Math.max(0, sim.securityShieldTimer - dt);
          if (sim.securityShieldTimer === 0) {
            me.shielded = false;
            if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, shielded: false });
          }
        }
        if (sim.securityCooldown > 0) sim.securityCooldown = Math.max(0, sim.securityCooldown - dt);

        if (sim.survivorShieldTimer > 0) {
          sim.survivorShieldTimer = Math.max(0, sim.survivorShieldTimer - dt);
          if (sim.survivorShieldTimer === 0) {
            me.shielded = false;
            if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, shielded: false });
          }
        }
        if (sim.survivorCooldown > 0) sim.survivorCooldown = Math.max(0, sim.survivorCooldown - dt);

        if (sim.phantomTimer > 0) {
          sim.phantomTimer = Math.max(0, sim.phantomTimer - dt);
          if (sim.phantomTimer === 0) {
            me.invisible = false;
            if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, invisible: false });
          }
        }
        if (sim.phantomCooldown > 0) sim.phantomCooldown = Math.max(0, sim.phantomCooldown - dt);

        if (sim.disguiseTimer > 0) {
          sim.disguiseTimer = Math.max(0, sim.disguiseTimer - dt);
          if (sim.disguiseTimer === 0) {
            me.disguisedAs = null;
            if (!sim.isHost) sendToHost({ type: 'ability_state', playerId: sim.myId, disguisedAs: null });
          }
        }
        if (sim.disguiseCooldown > 0) sim.disguiseCooldown = Math.max(0, sim.disguiseCooldown - dt);

        if (sim.cameraWatchTimer > 0) {
          sim.cameraWatchTimer = Math.max(0, sim.cameraWatchTimer - dt);
          if (sim.cameraWatchTimer === 0) sim.cameraWatchGimmick = null;
        }

        if (me.inVent && me.role === 'engineer') {
          sim.ventStayTimer = Math.max(0, sim.ventStayTimer - dt);
          if (sim.ventStayTimer === 0) {
            me.inVent = false;
            sim.ventUseCooldown = 15;
            sound.playVent();
            showToast('⏳ エンジニアのベント潜伏時間(12秒)が終了しました');
          }
        }

        Object.keys(sim.gimmickCooldowns).forEach((gk) => {
          sim.gimmickCooldowns[gk] = Math.max(0, sim.gimmickCooldowns[gk] - dt);
        });

        // 封鎖ドア・環境ギミック周期（ホスト管理）
        if (sim.isHost) {
          sim.activeDoorLocks = sim.activeDoorLocks.filter((d) => d.expiresAt > nowMs);
          sim.sandstormActive = Boolean(mapDef.hasPeriodicSandstorm && (sim.elapsedMatchSec % 26) > 20);
          sim.steamActive = (sim.elapsedMatchSec % 18) > 12;

          // バイパー死体溶解＆能力残滓減衰
          sim.bodies = sim.bodies.filter((b) => {
            if (typeof b.dissolveTimer === 'number') {
              b.dissolveTimer -= dt;
              return b.dissolveTimer > 0;
            }
            return true;
          });
          sim.abilityTraces = sim.abilityTraces.filter((tr) => {
            tr.timer -= dt;
            return tr.timer > 0;
          });

          // 炉心メルトダウンタイマー
          if (sim.sabotage && sim.sabotage.type === 'reactor') {
            sim.sabotage.timer -= dt;
            if (sim.sabotage.timer <= 0) {
              endGameHost('impostors', '炉心メルトダウンの阻止に失敗しました！');
            }
          }
        }

        const closedDoors = sim.isHost ? sim.activeDoorLocks.map((d) => d.rect) : sim.remoteClosedDoors;

        // 自分の移動計算（カメラ視聴中・ベント潜伏中は停止）
        if (!me.inVent && sim.cameraWatchTimer <= 0) {
          let vx = sim.joystick.dx;
          let vy = sim.joystick.dy;
          if (sim.keysDown[keybinds.moveUp] || sim.keysDown['ArrowUp']) vy -= 1;
          if (sim.keysDown[keybinds.moveDown] || sim.keysDown['ArrowDown']) vy += 1;
          if (sim.keysDown[keybinds.moveLeft] || sim.keysDown['ArrowLeft']) vx -= 1;
          if (sim.keysDown[keybinds.moveRight] || sim.keysDown['ArrowRight']) vx += 1;

          const mag = Math.hypot(vx, vy);
          let speed = me.alive ? 235 : 310;
          if (sim.boostTimer > 0) speed *= 1.25;
          if (sim.securityShieldTimer > 0) speed *= 1.15;

          const onLowGrav = mapDef.gimmicks.some(
            (g) =>
              g.type === 'low_gravity' &&
              g.w &&
              g.h &&
              me.x >= g.x &&
              me.x <= g.x + g.w &&
              me.y >= g.y &&
              me.y <= g.y + g.h
          );
          if (onLowGrav) {
            const lg = mapDef.gimmicks.find((g) => g.type === 'low_gravity');
            speed *= lg?.speedMult ?? 1.18;
          }

          const onIce =
            me.alive &&
            mapDef.gimmicks.some(
              (g) => g.type === 'ice' && g.w && g.h && me.x >= g.x && me.x <= g.x + g.w && me.y >= g.y && me.y <= g.y + g.h
            );

          let moveVx = mag > 0 ? (vx / mag) * speed : 0;
          let moveVy = mag > 0 ? (vy / mag) * speed : 0;

          if (onIce) {
            sim.iceVx = sim.iceVx * 0.92 + moveVx * 0.08;
            sim.iceVy = sim.iceVy * 0.92 + moveVy * 0.08;
            moveVx = sim.iceVx;
            moveVy = sim.iceVy;
          } else {
            sim.iceVx = moveVx;
            sim.iceVy = moveVy;
          }

          // コンベア押し出し
          if (me.alive) {
            for (const g of mapDef.gimmicks) {
              if (g.type === 'conveyor' && g.w && g.h && me.x >= g.x && me.x <= g.x + g.w && me.y >= g.y && me.y <= g.y + g.h) {
                moveVx += g.vx || 0;
                moveVy += g.vy || 0;
              }
            }
          }

          if (moveVx < -5) me.facing = -1;
          else if (moveVx > 5) me.facing = 1;

          const nextPos = resolveMovementWithWalls(me.x, me.y, moveVx, moveVy, dt, mapDef, me.alive, closedDoors);
          me.x = nextPos.x;
          me.y = nextPos.y;
          me.targetX = nextPos.x;
          me.targetY = nextPos.y;

          if (!sim.isHost && now - sim.lastMoveSyncAt > 50) {
            sim.lastMoveSyncAt = now;
            sendToHost({ type: 'move', playerId: sim.myId, x: me.x, y: me.y, facing: me.facing });
          }
        }

        // ホストによるAIボットAI更新 & ドアログ監視
        if (sim.isHost) {
          // ドアログセンサー記録
          const hasDoorlog = mapDef.gimmicks.some((g) => g.type === 'doorlog');
          if (hasDoorlog) {
            const sensors = mapDef.corridors.slice(0, 4);
            Object.values(sim.players).forEach((p) => {
              if (!p.alive || p.inVent) return;
              sensors.forEach((c, idx) => {
                const cx = c.x + c.w / 2;
                const cy = c.y + c.h / 2;
                if (Math.hypot(p.x - cx, p.y - cy) < 50) {
                  const key = `${p.id}_${idx}`;
                  const last = sim.doorLogSensorCooldowns[key] || 0;
                  if (nowMs - last > 6500) {
                    sim.doorLogSensorCooldowns[key] = nowMs;
                    const sec = Math.floor(sim.elapsedMatchSec);
                    const roomNear = getCurrentRoomName(cx, cy, mapDef);
                    sim.doorLogs.push(`[${sec}s] ${p.name} が センサー#${idx + 1} (${roomNear}付近) を通過`);
                    if (sim.doorLogs.length > 35) sim.doorLogs = sim.doorLogs.slice(-35);
                  }
                }
              });
            });
          }

          // AIボット行動
          Object.values(sim.players).forEach((bot) => {
            if (!bot.isBot || !bot.alive) return;
            if ((bot.aiKillCd || 0) > 0) bot.aiKillCd = Math.max(0, (bot.aiKillCd || 0) - dt);

            if (!bot.aiGoal || (bot.aiWait || 0) > 0) {
              bot.aiWait = (bot.aiWait || 0) - dt;
              if ((bot.aiWait || 0) <= 0) {
                const room = mapDef.rooms[Math.floor(Math.random() * mapDef.rooms.length)];
                const goal = findSafeSpawnPosition(
                  room.x + 40 + Math.random() * Math.max(40, room.w - 80),
                  room.y + 40 + Math.random() * Math.max(40, room.h - 80),
                  mapDef,
                  closedDoors
                );
                bot.aiGoal = goal;
                bot.aiWait = 0;
              }
            } else {
              const dx = bot.aiGoal.x - bot.x;
              const dy = bot.aiGoal.y - bot.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 24) {
                bot.aiGoal = null;
                bot.aiWait = 1.2 + Math.random() * 2.2;
                if (hasCrewTasks(bot.role) && Math.random() < 0.35) {
                  const limit = getPlayerTaskTargetCount(bot, sim.settings.taskCount);
                  if (bot.tasksDone < limit) {
                    bot.tasksDone += 1;
                    checkWinConditionsHost();
                  }
                }
              } else {
                const bvx = (dx / dist) * 185;
                const bvy = (dy / dist) * 185;
                bot.facing = bvx < -5 ? -1 : 1;
                const res = resolveMovementWithWalls(bot.x, bot.y, bvx, bvy, dt, mapDef, true, closedDoors);
                if (Math.hypot(res.x - bot.x, res.y - bot.y) < 12 * dt) {
                  bot.aiGoal = null;
                  bot.aiWait = 0.8;
                } else {
                  bot.x = res.x;
                  bot.y = res.y;
                }
              }
            }

            // AIインポスター/ジャッカルによるキル
            if ((isImpostorTeam(bot.role) && bot.role !== 'madscientist') || bot.role === 'jackal') {
              if ((bot.aiKillCd || 0) <= 0) {
                const victim = Object.values(sim.players).find((p) => {
                  if (!p.alive || p.id === bot.id || p.inVent || p.shielded) return false;
                  if (isImpostorTeam(bot.role) && isImpostorTeam(p.role)) return false;
                  return Math.hypot(p.x - bot.x, p.y - bot.y) < 75;
                });
                if (victim && Math.random() < 0.04) {
                  const witnesses = Object.values(sim.players).filter(
                    (w) => w.alive && w.id !== bot.id && w.id !== victim.id && Math.hypot(w.x - bot.x, w.y - bot.y) < 220
                  ).length;
                  if (witnesses === 0) {
                    victim.alive = false;
                    recordKillEventHost(bot, victim, 'kill');
                    spawnKillBurst(victim.x, victim.y, victim.killEffect, victim.color);
                    sim.bodies.push({
                      id: 'b_' + Date.now() + '_' + victim.id,
                      playerId: victim.id,
                      name: victim.name,
                      color: victim.color,
                      killerColor: bot.color,
                      killedAt: nowMs,
                      dissolveTimer: bot.role === 'viper' ? 12 : null,
                      x: victim.x,
                      y: victim.y
                    });
                    bot.aiKillCd = getRoleKillCooldown(bot.role, sim.settings.killCooldown);
                    checkWinConditionsHost();
                  }
                }
              }
            }

            // AIクルーの死体通報
            if (!isImpostorTeam(bot.role) && bot.role !== 'jackal') {
              const seenBody = sim.bodies.find((b) => Math.hypot(b.x - bot.x, b.y - bot.y) < 85);
              if (seenBody && Math.random() < 0.05) {
                startMeetingHost('body', bot.name, bot.color, bot.hat || 'none', {
                  name: seenBody.name,
                  color: seenBody.color
                });
              }
            }
          });

          if (now - sim.lastHostBroadcastAt > 80) {
            sim.lastHostBroadcastAt = now;
            broadcastRoomState();
          }
        }

        // Canvas2D フレーム描画（約30fps・フルモーダル表示中は背面描画を抑制）
        if (gameCanvasRef.current && !hasOverlayOpenRef.current && now - lastCanvasDrawAt >= 34) {
          lastCanvasDrawAt = now;
          const visionRadius = computePlayerVisionRadius({
            role: me.role,
            x: me.x,
            y: me.y,
            mapDef,
            sabotageType: sim.sabotage ? sim.sabotage.type : null,
            crystalBeaconActive: sim.crystalBeaconTimer > 0,
            sandstormActive: sim.sandstormActive,
            hauntedActive: sim.hauntedTimer > 0
          });

          const activeFeed =
            sim.cameraWatchTimer > 0 && sim.cameraWatchGimmick
              ? sim.cameraWatchGimmick.feeds && sim.cameraWatchGimmick.feeds.length > 0
                ? sim.cameraWatchGimmick.feeds[sim.cameraFeedIndex % sim.cameraWatchGimmick.feeds.length]
                : {
                    label: sim.cameraWatchGimmick.label,
                    x: sim.cameraWatchGimmick.watchX ?? sim.cameraWatchGimmick.x,
                    y: sim.cameraWatchGimmick.watchY ?? sim.cameraWatchGimmick.y
                  }
              : null;

          renderGameCanvasFrame({
            canvas: gameCanvasRef.current,
            mapDef,
            me,
            players: sim.players,
            bodies: sim.bodies,
            abilityTraces: sim.abilityTraces,
            killBursts: sim.killEffectBursts,
            myTasks: sim.myTasks,
            completedTasks: sim.completedTasks,
            hasTasks: hasCrewTasks(me.role),
            sabotage: sim.sabotage,
            visionRadius,
            closedDoors,
            anyCameraActive: sim.cameraWatchTimer > 0 || sim.remoteCameraActive,
            cameraWatchTimer: sim.cameraWatchTimer,
            cameraWatchTarget: activeFeed,
            sonarPingTimer: sim.sonarPingTimer,
            psychicTimer: sim.psychicTimer,
            oiledPlayers: sim.oiledPlayers,
            crystalBeaconTimer: sim.crystalBeaconTimer,
            sandstormActive: sim.sandstormActive,
            steamActive: sim.steamActive,
            bellRingTimer: sim.bellRingTimer,
            bellPos: sim.bellPos,
            hauntedTimer: sim.hauntedTimer,
            nowMs
          });
        }
      }

      // 会議フェーズ：カットイン終了後にタイマー＆AIボット発言・投票開始
      if (sim.phase === 'meeting' && sim.isHost) {
        if (sim.meetingCutInSec > 0) {
          sim.meetingCutInSec = Math.max(0, sim.meetingCutInSec - dt);
        } else {
          sim.meetingTimer = Math.max(0, sim.meetingTimer - dt);
          const bots = Object.values(sim.players).filter((p) => p.isBot && p.alive);
          bots.forEach((b) => {
            if (!sim.aiBotChatSent[b.id] && sim.meetingTimer < sim.settings.meetingTime - (3 + Math.random() * 6)) {
              sim.aiBotChatSent[b.id] = true;
              const cObj = CREW_COLORS.find((c) => c.id === b.color) || CREW_COLORS[0];
              const lines = [
                `${getCurrentRoomName(b.x, b.y, mapDef)}付近でタスクを進めていました。`,
                '怪しい動きをしていた人はいませんでしたか？',
                'まだ決定的な証拠がないので様子見したいです。',
                '通路が狭いので死角からの奇襲に注意しましょう！'
              ];
              appendChat(b.name, lines[Math.floor(Math.random() * lines.length)], cObj.hex);
            }
            if (!sim.votes[b.id] && sim.meetingTimer < sim.settings.meetingTime - (8 + Math.random() * 8)) {
              const aliveOthers = Object.values(sim.players).filter((p) => p.alive && p.id !== b.id);
              sim.votes[b.id] =
                Math.random() < 0.72 || aliveOthers.length === 0
                  ? 'skip'
                  : aliveOthers[Math.floor(Math.random() * aliveOthers.length)].id;
              const aliveIds = Object.values(sim.players)
                .filter((p) => p.alive)
                .map((p) => p.id);
              if (aliveIds.every((id) => Boolean(sim.votes[id]))) {
                finishMeetingHost();
              }
            }
          });

          if (sim.meetingTimer <= 0) {
            finishMeetingHost();
          }
        }
      }

      if ((sim.phase === 'playing' || sim.phase === 'meeting') && now - lastUiSync > 250) {
        lastUiSync = now;
        forceUiUpdate();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    appendChat,
    broadcastRoomState,
    checkWinConditionsHost,
    endGameHost,
    finishMeetingHost,
    forceUiUpdate,
    keybinds,
    recordKillEventHost,
    sendToHost,
    showToast,
    spawnKillBurst,
    startMeetingHost
  ]);

  // キーボード入力＆カスタムキーバインド
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (listeningAction) {
        e.preventDefault();
        const next = { ...keybinds, [listeningAction]: e.code };
        setKeybinds(next);
        safeLocalSet(KEYBINDS_STORAGE_KEY, JSON.stringify(next));
        setListeningAction(null);
        sound.playClick();
        return;
      }

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      simRef.current.keysDown[e.code] = true;

      if (simRef.current.phase !== 'playing') return;

      if (e.code === 'Tab' && simRef.current.cameraWatchTimer > 0) {
        e.preventDefault();
        const feeds = simRef.current.cameraWatchGimmick?.feeds || [];
        if (feeds.length > 1) {
          simRef.current.cameraFeedIndex = (simRef.current.cameraFeedIndex + 1) % feeds.length;
          sound.playClick();
          forceUiUpdate();
        }
        return;
      }

      if (e.code === 'Escape' && simRef.current.cameraWatchTimer > 0) {
        simRef.current.cameraWatchTimer = 0;
        simRef.current.cameraWatchGimmick = null;
        forceUiUpdate();
        return;
      }

      if (e.code === keybinds.map) {
        e.preventDefault();
        setShowMiniMap((prev) => !prev);
      } else if (e.code === keybinds.use) {
        e.preventDefault();
        performUseAction();
      } else if (e.code === keybinds.report) {
        e.preventDefault();
        performReportAction();
      } else if (e.code === keybinds.kill) {
        e.preventDefault();
        performKillAction();
      } else if (e.code === keybinds.vent) {
        e.preventDefault();
        performVentAction();
      } else if (e.code === keybinds.sabotage) {
        e.preventDefault();
        const me = simRef.current.players[simRef.current.myId];
        if (me && isImpostorTeam(me.role) && !simRef.current.sabotage && simRef.current.sabotageCooldown <= 0) {
          setShowSabotageModal((prev) => !prev);
        }
      } else if (e.code === keybinds.ability) {
        e.preventDefault();
        performAbilityAction();
      } else if (simRef.current.players[simRef.current.myId]?.inVent && e.code.startsWith('Digit')) {
        const idx = Number(e.code.slice(5)) - 1;
        jumpToVent(idx);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      delete simRef.current.keysDown[e.code];
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    forceUiUpdate,
    jumpToVent,
    keybinds,
    listeningAction,
    performAbilityAction,
    performKillAction,
    performReportAction,
    performUseAction,
    performVentAction
  ]);

  // 派生HUD状態の計算
  const sim = simRef.current;
  const me = sim.players[sim.myId];
  const mapDef = MAPS_DEF[sim.settings.mapId] || MAPS_DEF.starship;

  const hudDerived = useMemo(() => {
    if (!me || sim.phase !== 'playing') {
      return {
        roomName: '',
        visionRadius: 295,
        taskCompletedCount: 0,
        taskTotalCount: 1,
        gimmickStatusText: '',
        useState: { enabled: false, label: '🔧 実行' } as ActionButtonState,
        reportState: { enabled: false, label: '📢 通報' } as ActionButtonState,
        killState: { visible: false, enabled: false, label: '🔪 キル' } as ActionButtonState,
        ventState: { visible: false, enabled: false, label: '🕳️ ベント' } as ActionButtonState,
        sabotageState: { visible: false, enabled: false, label: '⚡ 妨害' } as ActionButtonState,
        abilityState: { visible: false, enabled: false, label: '✨ 能力' } as ActionButtonState
      };
    }

    const roomName = getCurrentRoomName(me.x, me.y, mapDef);
    const visionRadius = computePlayerVisionRadius({
      role: me.role,
      x: me.x,
      y: me.y,
      mapDef,
      sabotageType: sim.sabotage ? sim.sabotage.type : null,
      crystalBeaconActive: sim.crystalBeaconTimer > 0,
      sandstormActive: sim.sandstormActive,
      hauntedActive: sim.hauntedTimer > 0
    });

    const crewList = Object.values(sim.players).filter((p) => hasCrewTasks(p.role));
    const taskTotalCount = crewList.reduce((acc, p) => acc + getPlayerTaskTargetCount(p, sim.settings.taskCount), 0) || 1;
    const taskCompletedCount = crewList.reduce((acc, p) => acc + (p.tasksDone || 0), 0);

    // 環境状態テキスト
    const statusParts: string[] = [];
    if (sim.boostTimer > 0) statusParts.push(`🔥 加速中 ${Math.ceil(sim.boostTimer)}s`);
    if (sim.crystalBeaconTimer > 0) statusParts.push(`💎 視界拡大 ${Math.ceil(sim.crystalBeaconTimer)}s`);
    if (sim.hauntedTimer > 0) statusParts.push(`👻 視界妨害中 ${Math.ceil(sim.hauntedTimer)}s`);
    if (sim.sandstormActive) statusParts.push('🏜️ 砂嵐');
    if (sim.steamActive && mapDef.gimmicks.some((g) => g.type === 'steam_hazard')) statusParts.push('💨 蒸気噴出');
    const gimmickStatusText = statusParts.join(' / ');

    // 実行ボタン状態
    let useState: ActionButtonState = { enabled: false, label: '🔧 実行' };
    if (sim.cameraWatchTimer > 0) {
      useState = { enabled: true, label: '✕ 視聴終了' };
    } else if (
      sim.sabotage &&
      me.alive &&
      Math.hypot(mapDef.sabotageFix[sim.sabotage.type].x - me.x, mapDef.sabotageFix[sim.sabotage.type].y - me.y) < 88
    ) {
      useState = { enabled: true, label: '⚡ 修理' };
    } else if (
      hasCrewTasks(me.role) &&
      sim.myTasks.some((tid) => {
        if (sim.completedTasks[tid]) return false;
        const spot = mapDef.taskSpots.find((s) => s.taskId === tid);
        return Boolean(spot && Math.hypot(spot.x - me.x, spot.y - me.y) < 76);
      })
    ) {
      useState = { enabled: true, label: '🔧 タスク' };
    } else if (me.alive) {
      const g = findNearestGimmick(me.x, me.y, mapDef);
      if (g) {
        const gKey = g.id || `${g.type}_${g.x}_${g.y}`;
        const cdLeft = sim.gimmickCooldowns[gKey] || 0;
        useState = {
          enabled: cdLeft <= 0,
          label: cdLeft > 0 ? `${g.icon || '✨'} (${Math.ceil(cdLeft)}s)` : `${g.icon || '✨'} ${g.label}`
        };
      } else if (Math.hypot(mapDef.emergency.x - me.x, mapDef.emergency.y - me.y) < 92) {
        useState = {
          enabled: sim.emergencyCooldown <= 0,
          label: sim.emergencyCooldown > 0 ? `🚨 (${Math.ceil(sim.emergencyCooldown)}s)` : '🚨 緊急会議'
        };
      }
    }

    // 通報ボタン
    const nearBody = me.alive && sim.bodies.some((b) => Math.hypot(b.x - me.x, b.y - me.y) < 110);
    const reportState: ActionButtonState = { enabled: nearBody, label: '📢 通報' };

    // キル / アーソニスト
    let killState: ActionButtonState = { visible: false, enabled: false, label: '🔪 キル' };
    if (me.alive && me.role === 'arsonist') {
      const othersAlive = Object.values(sim.players).filter((p) => p.alive && p.id !== me.id);
      const allOiled = othersAlive.length > 0 && othersAlive.every((p) => Boolean(sim.oiledPlayers[p.id]));
      if (allOiled) {
        killState = { visible: true, enabled: true, label: '🔥 一斉点火' };
      } else {
        const nearTarget = othersAlive.some((p) => !sim.oiledPlayers[p.id] && Math.hypot(p.x - me.x, p.y - me.y) < 115);
        killState = {
          visible: true,
          enabled: sim.douseCooldown <= 0 && nearTarget,
          label: sim.douseCooldown > 0 ? `🛢️ (${Math.ceil(sim.douseCooldown)}s)` : '🛢️ 塗布'
        };
      }
    } else if (me.alive && canKillRole(me.role)) {
      const nearTarget = Object.values(sim.players).some(
        (p) =>
          p.alive &&
          p.id !== me.id &&
          !p.inVent &&
          !(isImpostorTeam(me.role) && isImpostorTeam(p.role)) &&
          Math.hypot(p.x - me.x, p.y - me.y) < 115
      );
      killState = {
        visible: true,
        enabled: sim.killCooldown <= 0 && nearTarget && !me.inVent && !(me.role === 'phantom' && me.invisible),
        label: sim.killCooldown > 0 ? `🔪 (${Math.ceil(sim.killCooldown)}s)` : me.role === 'sheriff' ? '🔫 成敗' : '🔪 キル'
      };
    }

    // ベントボタン
    const canVent = me.alive && canUseVentRole(me.role);
    const nearVent = mapDef.vents.some((v) => Math.hypot(v.x - me.x, v.y - me.y) < 75);
    const ventState: ActionButtonState = {
      visible: canVent,
      enabled: me.inVent || (nearVent && !(me.role === 'engineer' && sim.ventUseCooldown > 0)),
      label: me.inVent
        ? '🕳️ 退出'
        : me.role === 'engineer' && sim.ventUseCooldown > 0
        ? `🕳️ (${Math.ceil(sim.ventUseCooldown)}s)`
        : '🕳️ ベント'
    };

    // サボタージュボタン
    const canSab = me.alive && isImpostorTeam(me.role);
    const sabotageState: ActionButtonState = {
      visible: canSab,
      enabled: !sim.sabotage && sim.sabotageCooldown <= 0,
      label: sim.sabotageCooldown > 0 ? `⚡ (${Math.ceil(sim.sabotageCooldown)}s)` : '⚡ 妨害'
    };

    // 役職特殊能力ボタン
    let abilityState: ActionButtonState = { visible: false, enabled: false, label: '✨ 能力' };
    if (me.alive) {
      if (me.role === 'doctor') {
        const nearB = sim.bodies.some((b) => Math.hypot(b.x - me.x, b.y - me.y) < 95);
        abilityState = { visible: true, enabled: !sim.doctorUsed && nearB, label: sim.doctorUsed ? '⚕️ 済' : '⚕️ 蘇生' };
      } else if (me.role === 'detective') {
        const nearB = sim.bodies.some((b) => Math.hypot(b.x - me.x, b.y - me.y) < 95);
        abilityState = { visible: true, enabled: nearB, label: '🔍 調査' };
      } else if (me.role === 'radar') {
        abilityState = {
          visible: true,
          enabled: sim.radarUsesLeft > 0 && sim.radarCooldown <= 0,
          label: sim.radarCooldown > 0 ? `📡 (${Math.ceil(sim.radarCooldown)}s)` : `📡 (${sim.radarUsesLeft})`
        };
      } else if (me.role === 'security') {
        abilityState = {
          visible: true,
          enabled: sim.securityUsesLeft > 0 && sim.securityCooldown <= 0,
          label: sim.securityCooldown > 0 ? `🛡️ (${Math.ceil(sim.securityCooldown)}s)` : `🛡️ (${sim.securityUsesLeft})`
        };
      } else if (me.role === 'survivor') {
        abilityState = {
          visible: true,
          enabled: sim.survivorUsesLeft > 0 && sim.survivorCooldown <= 0,
          label: sim.survivorCooldown > 0 ? `🦺 (${Math.ceil(sim.survivorCooldown)}s)` : `🦺 (${sim.survivorUsesLeft})`
        };
      } else if (me.role === 'tracker') {
        const nearP = Object.values(sim.players).some((p) => p.alive && p.id !== me.id && Math.hypot(p.x - me.x, p.y - me.y) < 120);
        abilityState = { visible: true, enabled: nearP, label: '📍 追跡' };
      } else if (me.role === 'teleporter') {
        abilityState = {
          visible: true,
          enabled: sim.teleportUsesLeft > 0 && sim.teleportCooldown <= 0,
          label: sim.teleportCooldown > 0 ? `✨ (${Math.ceil(sim.teleportCooldown)}s)` : `✨ (${sim.teleportUsesLeft})`
        };
      } else if (me.role === 'psychic') {
        abilityState = {
          visible: true,
          enabled: sim.psychicCooldown <= 0,
          label: sim.psychicCooldown > 0 ? `🔮 (${Math.ceil(sim.psychicCooldown)}s)` : '🔮 霊視'
        };
      } else if (me.role === 'phantom') {
        abilityState = {
          visible: true,
          enabled: sim.phantomCooldown <= 0,
          label: sim.phantomCooldown > 0 ? `👻 (${Math.ceil(sim.phantomCooldown)}s)` : '👻 透明化'
        };
      } else if (me.role === 'shapeshifter') {
        const nearP = Object.values(sim.players).some((p) => p.alive && p.id !== me.id && Math.hypot(p.x - me.x, p.y - me.y) < 200);
        abilityState = {
          visible: true,
          enabled: nearP && sim.disguiseCooldown <= 0,
          label: sim.disguiseCooldown > 0 ? `🎭 (${Math.ceil(sim.disguiseCooldown)}s)` : '🎭 変装'
        };
      }
    } else {
      const hasAliveThreat = Object.values(sim.players).some(
        (p) => p.alive && (isImpostorTeam(p.role) || p.role === 'jackal')
      );
      abilityState = {
        visible: true,
        enabled: sim.ghostHauntCooldown <= 0 && hasAliveThreat,
        label: sim.ghostHauntCooldown > 0 ? `👻 (${Math.ceil(sim.ghostHauntCooldown)}s)` : '👻 イタズラ'
      };
    }

    return {
      roomName,
      visionRadius,
      taskCompletedCount,
      taskTotalCount,
      gimmickStatusText,
      useState,
      reportState,
      killState,
      ventState,
      sabotageState,
      abilityState
    };
  }, [findNearestGimmick, mapDef, me, sim.abilityTraces, sim.bodies, sim.boostTimer, sim.cameraWatchTimer, sim.completedTasks, sim.crystalBeaconTimer, sim.disguiseCooldown, sim.doctorUsed, sim.douseCooldown, sim.emergencyCooldown, sim.ghostHauntCooldown, sim.gimmickCooldowns, sim.hauntedTimer, sim.killCooldown, sim.myTasks, sim.oiledPlayers, sim.phantomCooldown, sim.phase, sim.players, sim.psychicCooldown, sim.radarCooldown, sim.radarUsesLeft, sim.sabotage, sim.sabotageCooldown, sim.sandstormActive, sim.securityCooldown, sim.securityUsesLeft, sim.settings.taskCount, sim.steamActive, sim.survivorCooldown, sim.survivorUsesLeft, sim.teleportCooldown, sim.teleportUsesLeft, sim.ventUseCooldown]);

  const impostorPartners = useMemo(() => {
    if (!me || !isImpostorTeam(me.role)) return [];
    return Object.values(sim.players)
      .filter((p) => p.id !== me.id && isImpostorTeam(p.role))
      .map((p) => p.name);
  }, [me, sim.players]);

  const activeCameraFeeds = sim.cameraWatchGimmick?.feeds || [];
  const currentFeedLabel =
    activeCameraFeeds.length > 0
      ? activeCameraFeeds[sim.cameraFeedIndex % activeCameraFeeds.length].label
      : sim.cameraWatchGimmick?.label || '監視カメラ';

  return (
    <div className={`space-bg flex flex-col ${sim.phase === 'playing' ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
      {/* トースト通知 */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-2xl bg-slate-900/95 border border-cyan-400/70 text-cyan-200 font-bold text-xs sm:text-sm shadow-2xl pointer-events-none">
          {toastMsg}
        </div>
      )}

      {/* 常設ヘッダーバー */}
      <header className="w-full px-4 py-2 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/85 z-30 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/50 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <ellipse cx="12" cy="13" rx="9" ry="4.5" stroke="#38bdf8" strokeWidth="1.8" />
              <path d="M8 11C8 8 10 6 12 6C14 6 16 8 16 11" stroke="#e0f2fe" strokeWidth="1.8" />
              <circle cx="9" cy="13" r="1" fill="#38bdf8" />
              <circle cx="12" cy="13" r="1" fill="#38bdf8" />
              <circle cx="15" cy="13" r="1" fill="#38bdf8" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-orbitron font-black text-xs sm:text-sm tracking-wider text-white truncate">
              STARSHIP IMPOSTOR DELUXE
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowKeybindModal(true)}
            className="sf-btn px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-cyan-200"
          >
            キー設定
          </button>
          <button
            type="button"
            onClick={() => setShowNetConfig(true)}
            className={`sf-btn px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold ${netStatus.color}`}
          >
            {netStatus.label}
          </button>
          <button
            type="button"
            onClick={() => {
              sound.muted = !muted;
              setMuted(!muted);
            }}
            className="sf-btn w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200"
            aria-label="効果音切替"
          >
            {muted ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M22 9L16 15M16 9L22 15" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 6C21 8.8 21 15.2 18.5 18" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* フェーズ別メイン画面 */}
      {sim.phase === 'title' && (
        <TitleScreen
          myName={sim.myName}
          myColor={sim.myColor}
          myHat={sim.myHat}
          myPet={sim.myPet}
          myKillEffect={sim.myKillEffect}
          isPublicRoom={sim.isPublicRoom}
          publicRooms={publicRooms}
          onChangeName={(name) => {
            sim.myName = name;
            safeSessionSet('sid_name', name);
            forceUiUpdate();
          }}
          onChangeColor={(c) => {
            sim.myColor = c;
            safeSessionSet('sid_color', c);
            sound.playClick();
            forceUiUpdate();
          }}
          onChangeHat={(h) => {
            sim.myHat = h;
            safeSessionSet('sid_hat', h);
            sound.playClick();
            forceUiUpdate();
          }}
          onChangePet={(pt) => {
            sim.myPet = pt;
            safeSessionSet('sid_pet', pt);
            sound.playClick();
            forceUiUpdate();
          }}
          onChangeKillEffect={(ef) => {
            sim.myKillEffect = ef;
            safeSessionSet('sid_kill_effect', ef);
            sound.playClick();
            forceUiUpdate();
          }}
          onToggleVisibility={(pub) => {
            sim.isPublicRoom = pub;
            sound.playClick();
            forceUiUpdate();
          }}
          onCreateRoom={() => createRoom()}
          onJoinRoom={(code) => joinRoomByCode(code)}
          onQuickSoloStart={() => createRoom({ botCount: 4, autoStartMatch: true })}
          onRefreshPublicRooms={refreshPublicRooms}
        />
      )}

      {sim.phase === 'lobby' && (
        <LobbyScreen
          lobbyCanvasRef={lobbyCanvasRef}
          roomCode={sim.roomCode}
          isHost={sim.isHost}
          isPublicRoom={sim.isPublicRoom}
          myId={sim.myId}
          myName={sim.myName}
          myColor={sim.myColor}
          myHat={sim.myHat}
          myPet={sim.myPet}
          myKillEffect={sim.myKillEffect}
          players={sim.players}
          settings={sim.settings}
          chatHistory={sim.chatHistory}
          onCopyCode={() => {
            copyTextToClipboard(sim.roomCode);
            showToast(`ルームコード「${sim.roomCode}」をコピーしました`);
          }}
          onCopyInvite={() => {
            const base = customPublicUrl.trim() || window.location.href.split('?')[0];
            copyTextToClipboard(`${base}?room=${sim.roomCode}`);
            showToast('招待URLをコピーしました！');
          }}
          onToggleVis={() => {
            sim.isPublicRoom = !sim.isPublicRoom;
            publishRoomToDirectory(false);
            forceUiUpdate();
          }}
          onLeave={() => {
            if (sim.isHost) publishRoomToDirectory(true);
            try {
              peerRef.current?.destroy();
            } catch {
              // ignore
            }
            sim.isHost = false;
            sim.roomCode = '';
            setPhase('title');
          }}
          onAddBot={() => addBotHost(false)}
          onRemoveBot={(botId) => {
            delete sim.players[botId];
            broadcastRoomState();
            publishRoomToDirectory(false);
            forceUiUpdate();
          }}
          onCustomize={(name, color, hat, pet, killEffect) => {
            if (name) {
              sim.myName = name;
              safeSessionSet('sid_name', name);
            }
            if (color) {
              sim.myColor = color;
              safeSessionSet('sid_color', color);
            }
            if (hat) {
              sim.myHat = hat;
              safeSessionSet('sid_hat', hat);
            }
            if (pet) {
              sim.myPet = pet;
              safeSessionSet('sid_pet', pet);
            }
            if (killEffect) {
              sim.myKillEffect = killEffect;
              safeSessionSet('sid_kill_effect', killEffect);
            }
            const meLobby = sim.players[sim.myId];
            if (meLobby) {
              meLobby.name = sim.myName;
              meLobby.color = sim.myColor;
              meLobby.hat = sim.myHat;
              meLobby.pet = sim.myPet;
              meLobby.killEffect = sim.myKillEffect;
            }
            if (sim.isHost) {
              broadcastRoomState();
            } else {
              sendToHost({
                type: 'customize',
                playerId: sim.myId,
                name: sim.myName,
                color: sim.myColor,
                hat: sim.myHat,
                pet: sim.myPet,
                killEffect: sim.myKillEffect
              });
            }
            forceUiUpdate();
          }}
          onUpdateSettings={(patch) => {
            sim.settings = { ...sim.settings, ...patch };
            broadcastRoomState();
            publishRoomToDirectory(false);
            forceUiUpdate();
          }}
          onToggleRole={(rk) => {
            sim.settings.enabledRoles = {
              ...sim.settings.enabledRoles,
              [rk]: sim.settings.enabledRoles[rk] === false
            };
            broadcastRoomState();
            forceUiUpdate();
          }}
          onSetAllRoles={(enabled) => {
            const next: Record<string, boolean> = {};
            SPECIAL_ROLE_KEYS.forEach((rk) => {
              next[rk] = enabled;
            });
            sim.settings.enabledRoles = next;
            broadcastRoomState();
            forceUiUpdate();
          }}
          onOpenRolesGuide={() => setShowRolesGuide(true)}
          onSendChat={(text, stampId) => {
            const cObj = CREW_COLORS.find((c) => c.id === sim.myColor) || CREW_COLORS[0];
            if (sim.isHost) appendChat(sim.myName, text, cObj.hex, false, stampId);
            else sendToHost({ type: 'chat', playerId: sim.myId, text, isGhost: false, stampId });
          }}
          onStartGame={() => {
            if (Object.keys(sim.players).length < 4) {
              while (Object.keys(sim.players).length < 4) {
                addBotHost(true);
              }
              showToast('4人未満のためAIクルーを自動補充して開始します！');
            }
            startGameHost(false);
          }}
        />
      )}

      {(sim.phase === 'playing' || sim.phase === 'meeting' || sim.phase === 'gameover') && (
        <GameScreen
          gameCanvasRef={gameCanvasRef}
          me={me}
          mapDef={mapDef}
          roomName={hudDerived.roomName}
          visionRadius={hudDerived.visionRadius}
          taskCompletedCount={hudDerived.taskCompletedCount}
          taskTotalCount={hudDerived.taskTotalCount}
          sabotage={sim.sabotage}
          myTasks={sim.myTasks}
          completedTasks={sim.completedTasks}
          gimmickStatusText={hudDerived.gimmickStatusText}
          cameraWatchTimer={sim.cameraWatchTimer}
          cameraFeedLabel={currentFeedLabel}
          cameraFeedCount={activeCameraFeeds.length}
          cameraFeedIndex={sim.cameraFeedIndex}
          onSwitchCameraFeed={() => {
            if (activeCameraFeeds.length > 1) {
              sim.cameraFeedIndex = (sim.cameraFeedIndex + 1) % activeCameraFeeds.length;
              sound.playClick();
              forceUiUpdate();
            }
          }}
          onCloseCamera={() => {
            sim.cameraWatchTimer = 0;
            sim.cameraWatchGimmick = null;
            forceUiUpdate();
          }}
          currentVentIndex={sim.currentVentIndex}
          ventStayTimer={sim.ventStayTimer}
          onJumpToVent={jumpToVent}
          onExitVent={performVentAction}
          onOpenMap={() => setShowMiniMap(true)}
          useActionState={hudDerived.useState}
          reportActionState={hudDerived.reportState}
          killActionState={hudDerived.killState}
          ventActionState={hudDerived.ventState}
          sabotageActionState={hudDerived.sabotageState}
          abilityActionState={hudDerived.abilityState}
          onUse={performUseAction}
          onReport={performReportAction}
          onKill={performKillAction}
          onVent={performVentAction}
          onSabotage={() => setShowSabotageModal(true)}
          onAbility={performAbilityAction}
          onJoystickChange={(dx, dy) => {
            sim.joystick = { dx, dy };
          }}
          keybinds={keybinds}
        />
      )}

      {/* ゲーム中・共通モーダル群 */}
      <RolesGuideModal open={showRolesGuide} onClose={() => setShowRolesGuide(false)} />

      <KeybindModal
        open={showKeybindModal}
        keybinds={keybinds}
        listeningAction={listeningAction}
        onStartListen={(action) => setListeningAction(action)}
        onReset={() => {
          const def = { ...DEFAULT_KEYBINDS };
          setKeybinds(def);
          safeLocalSet(KEYBINDS_STORAGE_KEY, JSON.stringify(def));
          showToast('操作キーを初期設定に戻しました');
        }}
        onClose={() => {
          setListeningAction(null);
          setShowKeybindModal(false);
        }}
      />

      <NetConfigModal
        open={showNetConfig}
        customPublicUrl={customPublicUrl}
        onChangeUrl={(val) => setCustomPublicUrl(val)}
        onSaveUrl={() => {
          safeLocalSet('sid_public_url', customPublicUrl.trim());
          showToast('公開URLを保存しました');
        }}
        onSwitchP2P={() => {
          netModeRef.current = 'p2p';
          initNetwork();
          setShowNetConfig(false);
          showToast('P2Pオンラインモードへ切り替えました');
        }}
        onSwitchOffline={() => {
          netModeRef.current = 'offline';
          setNetStatus({ label: 'オフライン / AIソロモード', color: 'text-emerald-300' });
          setShowNetConfig(false);
          showToast('AIボット専用オフラインモードへ切り替えました');
        }}
        onClose={() => setShowNetConfig(false)}
      />

      <RoleRevealOverlay
        open={roleRevealOpen}
        mapName={mapDef.name}
        gimmickSummary={mapDef.gimmickSummary}
        roleId={me?.role || 'crewmate'}
        partners={impostorPartners}
        me={me}
        players={sim.players}
        impostorCount={Object.values(sim.players).filter((p) => isImpostorTeam(p.role)).length}
        onDismiss={() => {
          if (roleRevealTimerRef.current) window.clearTimeout(roleRevealTimerRef.current);
          setRoleRevealOpen(false);
        }}
      />

      <KillFlashOverlay flash={killFlash} />

      <ReportCutInOverlay
        open={Boolean(reportCutIn?.open)}
        reason={reportCutIn?.reason || 'emergency'}
        callerName={reportCutIn?.callerName || sim.meetingCaller}
        callerColor={reportCutIn?.callerColor || sim.meetingCallerColor}
        callerHat={reportCutIn?.callerHat || sim.meetingCallerHat}
        victimName={reportCutIn?.victimName}
        victimColor={reportCutIn?.victimColor}
      />

      <TaskModal
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onComplete={(task) => {
          setActiveTask(null);
          sim.completedTasks[task.id] = true;
          if (sim.isHost && me) {
            me.tasksDone = (me.tasksDone || 0) + 1;
            checkWinConditionsHost();
            broadcastRoomState();
          } else {
            sendToHost({ type: 'task_done', playerId: sim.myId, taskId: task.id });
          }
          showToast(`✅ タスク「${task.name}」を完了しました！`);
          forceUiUpdate();
        }}
      />

      <SabotageModal
        open={showSabotageModal}
        isMadScientist={me?.role === 'madscientist'}
        onClose={() => setShowSabotageModal(false)}
        onTrigger={(stype) => {
          setShowSabotageModal(false);
          sim.sabotageCooldown = 25;
          sound.playSabotageTrigger();
          if (sim.isHost) {
            sim.sabotage = { type: stype, timer: stype === 'reactor' ? 35 : 999 };
            broadcastRoomState();
          } else {
            sendToHost({ type: 'sabotage_req', playerId: sim.myId, sabotageType: stype });
          }
          showToast(stype === 'lights' ? '⚡ 停電サボタージュを発動しました！' : '☢️ 炉心メルトダウンを発動しました！');
        }}
      />

      <MiniMapModal
        open={showMiniMap}
        mapDef={mapDef}
        me={me}
        players={sim.players}
        myTasks={sim.myTasks}
        completedTasks={sim.completedTasks}
        sabotage={sim.sabotage}
        radarTimer={sim.radarTimer}
        trackedTargetId={sim.trackedTargetId}
        adminTimer={sim.adminTimer}
        onClose={() => setShowMiniMap(false)}
      />

      <GimmickInfoModal
        mode={gimmickModalMode}
        players={sim.players}
        doorLogs={sim.doorLogs}
        onClose={() => setGimmickModalMode(null)}
      />

      <MeetingModal
        open={sim.phase === 'meeting' && !reportCutIn?.open}
        reason={sim.meetingReason}
        callerName={sim.meetingCaller}
        timer={sim.meetingTimer}
        votes={sim.votes}
        me={me}
        players={sim.players}
        chatHistory={sim.chatHistory}
        onVote={(targetId) => {
          sound.playVote();
          if (sim.isHost) {
            sim.votes[sim.myId] = targetId;
            const aliveIds = Object.values(sim.players)
              .filter((p) => p.alive)
              .map((p) => p.id);
            if (aliveIds.every((id) => Boolean(sim.votes[id]))) {
              finishMeetingHost();
            } else {
              broadcastRoomState();
              forceUiUpdate();
            }
          } else {
            sim.votes[sim.myId] = targetId;
            sendToHost({ type: 'vote_cast', playerId: sim.myId, targetId });
            forceUiUpdate();
          }
        }}
        onSendChat={(text, stampId) => {
          const cObj = CREW_COLORS.find((c) => c.id === sim.myColor) || CREW_COLORS[0];
          const isGhost = Boolean(me && !me.alive);
          if (sim.isHost) appendChat(sim.myName, text, cObj.hex, isGhost, stampId);
          else sendToHost({ type: 'chat', playerId: sim.myId, text, isGhost, stampId });
        }}
      />

      <EjectionOverlay
        open={ejectionBanner.open}
        text={ejectionBanner.text}
        subtext={ejectionBanner.subtext}
        ejectedColor={ejectionBanner.ejectedColor}
        ejectedHat={ejectionBanner.ejectedHat}
      />

      <GameOverModal
        open={sim.phase === 'gameover'}
        winner={sim.winner}
        reason={sim.winReason}
        players={sim.players}
        killTimeline={sim.killTimeline}
        myId={sim.myId}
        isHost={sim.isHost}
        onBackToLobby={() => {
          if (sim.isHost) {
            setPhase('lobby');
            broadcastRoomState();
            publishRoomToDirectory(false);
          } else {
            setPhase('lobby');
          }
        }}
      />
    </div>
  );
}
