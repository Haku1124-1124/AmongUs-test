import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_TASKS,
  CHAT_STAMPS,
  CREW_COLORS,
  CREW_HATS,
  QUICK_CHAT_PRESETS,
  TaskDef
} from '../game/constants';
import { getHatThumbnailUrl } from '../game/cosmetics';
import { MapDef } from '../game/maps';
import { hasCrewTasks, isImpostorTeam, PlayerState } from '../game/rules';
import { renderMiniMapCanvas } from '../game/renderer';
import { sound } from '../game/sound';
import { ChatEntry, ChatStampBadge } from './LobbyScreen';

interface AsteroidItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
}

/* 1. 本格Among Us風タスクミニゲームモーダル（ローディング検証＆完了演出つき） */
export const TaskModal: React.FC<{
  task: TaskDef | null;
  onClose: () => void;
  onComplete: (task: TaskDef) => void;
}> = ({ task, onClose, onComplete }) => {
  // 共通完了フェーズ演出 ('idle' -> 'verifying' -> 'done')
  const [completingPhase, setCompletingPhase] = useState<'idle' | 'verifying' | 'done'>('idle');
  const [toastMsg, setToastMsg] = useState('');
  const timersRef = useRef<number[]>([]);

  // 1) Code keypad
  const [targetCode, setTargetCode] = useState('48291');
  const [entered, setEntered] = useState('');

  // 2) Wires
  const [wireColors, setWireColors] = useState<string[]>([]);
  const [rightOrder, setRightOrder] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [connectedWires, setConnectedWires] = useState<string[]>([]);

  // 3) Oscilloscope Frequency
  const [targetFreq, setTargetFreq] = useState(55);
  const [freqVal, setFreqVal] = useState(30);

  // 4) Download / Upload Data
  const [dlProg, setDlProg] = useState(0);
  const [dlRunning, setDlRunning] = useState(false);

  // 5) Clear Asteroids
  const [asteroids, setAsteroids] = useState<AsteroidItem[]>([]);
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [laserShot, setLaserShot] = useState<{ x: number; y: number } | null>(null);

  // 6) Reactor Simon Says (3x3)
  const [simSequence, setSimSequence] = useState<number[]>([]);
  const [simRound, setSimRound] = useState(1); // 1 or 2
  const [simLitIdx, setSimLitIdx] = useState<number | null>(null);
  const [simInputStep, setSimInputStep] = useState(0);
  const [simShowing, setSimShowing] = useState(false);

  // 7) Swipe Card
  const [swipeVal, setSwipeVal] = useState(0);
  const [swipeStatus, setSwipeStatus] = useState('PLEASE SWIPE CARD ▶');
  const [swipeGood, setSwipeGood] = useState<boolean | null>(null);
  const swipeStartTimeRef = useRef<number>(0);

  // 8) Inspect Sample (MedBay 5 vials)
  const [samplePhase, setSamplePhase] = useState<'ready' | 'processing' | 'pick'>('ready');
  const [sampleProg, setSampleProg] = useState(0);
  const [anomalyIdx, setAnomalyIdx] = useState(2);

  // Confirm button scaling feedback
  const [confirmPopping, setConfirmPopping] = useState(false);

  // 9) Fuel Engine (hold_gauge)
  const [fuelLevel, setFuelLevel] = useState(0);
  const [fuelHolding, setFuelHolding] = useState(false);

  // 10) Trash Chute (lever_pull)
  const [leverVal, setLeverVal] = useState(0);

  // 11) O2 Clean Filter (clean_leaves)
  const [leaves, setLeaves] = useState<Array<{ id: number; x: number; y: number; rot: number }>>([]);

  // 12) Prime Shields (hex_shields)
  const [hexStates, setHexStates] = useState<boolean[]>([false, true, false, false, true, false, false]);

  // 13) Unlock Manifolds (order_numbers 1..10)
  const [manifoldOrder, setManifoldOrder] = useState<number[]>([]);
  const [nextManifoldNum, setNextManifoldNum] = useState(1);

  // 14) Chart Course / Align Nav (nav_align)
  const [navPos, setNavPos] = useState<{ x: number; y: number }>({ x: 24, y: 74 });
  const [navTarget, setNavTarget] = useState<{ x: number; y: number }>({ x: 64, y: 36 });

  // 15) Calibrate Distributor (timing_lock)
  const [calibStep, setCalibStep] = useState(0);
  const [calibAngle, setCalibAngle] = useState(0);

  // 16) Thermal Melt (thermal_melt)
  const [meltHeat, setMeltHeat] = useState(0);

  // 17) Pressure Valve Spin (valve_spin)
  const [valveTurns, setValveTurns] = useState(0);

  // 18) Magma Temp Balance (temp_balance)
  const [tempReading, setTempReading] = useState(320);
  const [tempGoal, setTempGoal] = useState(500);

  // 19) Cyber Decrypt Pair Match (pair_decrypt)
  const [cipherCards, setCipherCards] = useState<Array<{ id: number; sym: string; matched: boolean }>>([]);
  const [cipherPick, setCipherPick] = useState<number | null>(null);

  // 20) Crystal Resonance / Botany Water (crystal_tune)
  const [tuneSliders, setTuneSliders] = useState<[number, number, number]>([25, 80, 40]);

  const clearAllTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
    timersRef.current = [];
  }, []);

  const triggerTaskCompletion = useCallback(
    (activeTask: TaskDef) => {
      if (completingPhase !== 'idle') return;
      setConfirmPopping(true);
      sound.playTaskDone();
      setCompletingPhase('verifying');
      const t1 = window.setTimeout(() => {
        setCompletingPhase('done');
        const t2 = window.setTimeout(() => {
          onComplete(activeTask);
        }, 560);
        timersRef.current.push(t2);
      }, 360);
      timersRef.current.push(t1);
    },
    [completingPhase, onComplete]
  );

  // タスク初期化
  useEffect(() => {
    clearAllTimers();
    if (!task) return;
    setCompletingPhase('idle');
    setConfirmPopping(false);
    setToastMsg('');

    if (task.type === 'code') {
      setTargetCode(String(Math.floor(10000 + Math.random() * 89999)));
      setEntered('');
    } else if (task.type === 'wires') {
      const cols = ['#ef4444', '#3b82f6', '#eab308', '#ec4899'];
      setWireColors(cols);
      const shuffled = [...cols].sort(() => Math.random() - 0.5);
      if (shuffled.every((c, i) => c === cols[i])) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
      }
      setRightOrder(shuffled);
      setSelectedLeft(null);
      setConnectedWires([]);
    } else if (task.type === 'freq') {
      const t = Math.floor(24 + Math.random() * 58);
      setTargetFreq(t);
      setFreqVal(t > 55 ? 24 : 78);
    } else if (task.type === 'download') {
      setDlProg(0);
      setDlRunning(false);
    } else if (task.type === 'asteroid') {
      setDestroyedCount(0);
      setLaserShot(null);
      setAsteroids(
        Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          x: 16 + (i % 3) * 28 + Math.random() * 10,
          y: 18 + Math.floor(i / 3) * 38 + Math.random() * 12,
          vx: (Math.random() > 0.5 ? 1 : -1) * (0.28 + Math.random() * 0.28),
          vy: (Math.random() > 0.5 ? 1 : -1) * (0.22 + Math.random() * 0.24),
          size: 28 + Math.floor(Math.random() * 10),
          rot: Math.floor(Math.random() * 360)
        }))
      );
    } else if (task.type === 'reactor_sim') {
      const seq = [
        Math.floor(Math.random() * 9),
        Math.floor(Math.random() * 9),
        Math.floor(Math.random() * 9)
      ];
      setSimSequence(seq);
      setSimRound(1);
      setSimInputStep(0);
      setSimLitIdx(null);
    } else if (task.type === 'card_swipe') {
      setSwipeVal(0);
      setSwipeStatus('カードを右端までスワイプ ▶');
      setSwipeGood(null);
      swipeStartTimeRef.current = 0;
    } else if (task.type === 'sample_scan') {
      setSamplePhase('ready');
      setSampleProg(0);
      setAnomalyIdx(Math.floor(Math.random() * 5));
    } else if (task.type === 'hold_gauge') {
      setFuelLevel(0);
      setFuelHolding(false);
    } else if (task.type === 'lever_pull') {
      setLeverVal(0);
    } else if (task.type === 'clean_leaves') {
      setLeaves(
        Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          x: 14 + (i % 3) * 28 + Math.random() * 10,
          y: 18 + Math.floor(i / 3) * 36 + Math.random() * 10,
          rot: Math.floor(Math.random() * 360)
        }))
      );
    } else if (task.type === 'hex_shields') {
      setHexStates([false, true, false, false, true, false, false]);
    } else if (task.type === 'order_numbers') {
      setManifoldOrder([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort(() => Math.random() - 0.5));
      setNextManifoldNum(1);
    } else if (task.type === 'nav_align') {
      setNavPos({ x: 20, y: 74 });
      setNavTarget({
        x: Math.floor(42 + Math.random() * 38),
        y: Math.floor(22 + Math.random() * 36)
      });
    } else if (task.type === 'timing_lock') {
      setCalibStep(0);
      setCalibAngle(0);
    } else if (task.type === 'thermal_melt') {
      setMeltHeat(0);
    } else if (task.type === 'valve_spin') {
      setValveTurns(0);
    } else if (task.type === 'temp_balance') {
      const g = 420 + Math.floor(Math.random() * 5) * 40;
      setTempGoal(g);
      setTempReading(g - 120);
    } else if (task.type === 'pair_decrypt') {
      const syms = ['◆', '★', '▲', '◆', '★', '▲'].sort(() => Math.random() - 0.5);
      setCipherCards(syms.map((sym, idx) => ({ id: idx, sym, matched: false })));
      setCipherPick(null);
    } else if (task.type === 'crystal_tune') {
      setTuneSliders([25, 82, 30]);
    }

    return () => clearAllTimers();
  }, [task, clearAllTimers]);

  // Fuel gauge hold timer
  useEffect(() => {
    if (!task || task.type !== 'hold_gauge' || !fuelHolding || completingPhase !== 'idle') return;
    const iv = window.setInterval(() => {
      setFuelLevel((prev) => {
        const next = Math.min(100, prev + 8);
        if (next >= 100) {
          setFuelHolding(false);
          window.clearInterval(iv);
        }
        return next;
      });
    }, 60);
    return () => window.clearInterval(iv);
  }, [fuelHolding, task, completingPhase]);

  // Timing lock rotating needle
  useEffect(() => {
    if (!task || task.type !== 'timing_lock' || completingPhase !== 'idle') return;
    const iv = window.setInterval(() => {
      setCalibAngle((prev) => (prev + 6 + calibStep * 1.5) % 360);
    }, 30);
    return () => window.clearInterval(iv);
  }, [task, calibStep, completingPhase]);

  // Download progress timer
  useEffect(() => {
    if (!task || task.type !== 'download' || !dlRunning || completingPhase !== 'idle') return;
    const iv = window.setInterval(() => {
      setDlProg((prev) => {
        const next = Math.min(100, prev + 8);
        if (next >= 100) {
          window.clearInterval(iv);
          triggerTaskCompletion(task);
        }
        return next;
      });
    }, 110);
    return () => window.clearInterval(iv);
  }, [dlRunning, task, completingPhase, triggerTaskCompletion]);

  // Asteroid gentle drift animation
  useEffect(() => {
    if (!task || task.type !== 'asteroid' || completingPhase !== 'idle') return;
    const iv = window.setInterval(() => {
      setAsteroids((prev) =>
        prev.map((a) => {
          let nx = a.x + a.vx;
          let ny = a.y + a.vy;
          let vx = a.vx;
          let vy = a.vy;
          if (nx < 8 || nx > 84) {
            vx = -vx;
            nx = Math.max(8, Math.min(84, nx));
          }
          if (ny < 12 || ny > 78) {
            vy = -vy;
            ny = Math.max(12, Math.min(78, ny));
          }
          return { ...a, x: nx, y: ny, vx, vy, rot: (a.rot + 1.8) % 360 };
        })
      );
    }, 33);
    return () => window.clearInterval(iv);
  }, [task, completingPhase]);

  // Reactor Simon pattern playback
  const playSimonRound = useCallback(
    (seq: number[], roundNum: number) => {
      const len = roundNum === 1 ? 2 : 3;
      setSimShowing(true);
      setSimInputStep(0);
      setSimLitIdx(null);
      for (let i = 0; i < len; i++) {
        const tOn = window.setTimeout(() => {
          setSimLitIdx(seq[i]);
          sound.playKeypadBeep(520 + seq[i] * 45);
        }, 280 + i * 440);
        const tOff = window.setTimeout(() => {
          setSimLitIdx(null);
          if (i === len - 1) setSimShowing(false);
        }, 560 + i * 440);
        timersRef.current.push(tOn, tOff);
      }
    },
    []
  );

  useEffect(() => {
    if (task?.type === 'reactor_sim' && simSequence.length > 0 && completingPhase === 'idle') {
      playSimonRound(simSequence, simRound);
    }
  }, [task, simSequence, simRound, completingPhase, playSimonRound]);

  // MedBay sample scan centrifuge timer
  useEffect(() => {
    if (!task || task.type !== 'sample_scan' || samplePhase !== 'processing') return;
    const iv = window.setInterval(() => {
      setSampleProg((prev) => {
        const next = Math.min(100, prev + 10);
        if (next >= 100) {
          window.clearInterval(iv);
          sound.playCardSwipe(true);
          setSamplePhase('pick');
        }
        return next;
      });
    }, 95);
    return () => window.clearInterval(iv);
  }, [task, samplePhase]);

  if (!task) return null;

  const freqLocked = Math.abs(freqVal - targetFreq) <= 3;

  // Build SVG oscilloscope path helper
  const buildWavePath = (freq: number, phaseShift = 0) => {
    const pts: string[] = [];
    const cycles = 1.4 + (freq / 100) * 3.8;
    for (let x = 0; x <= 280; x += 6) {
      const y = 38 + Math.sin((x / 280) * Math.PI * 2 * cycles + phaseShift) * 26;
      pts.push(`${x === 0 ? 'M' : 'L'}${x},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-5 w-full max-w-lg border-cyan-400/60 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-2.5">
          <div>
            <div className="text-[10px] font-orbitron font-bold text-cyan-400 tracking-widest">SYSTEM TASK TERMINAL</div>
            <h3 className="font-orbitron font-black text-base text-white">{task.name}</h3>
          </div>
          <button
            type="button"
            disabled={completingPhase !== 'idle'}
            onClick={() => {
              clearAllTimers();
              onClose();
            }}
            className="sf-btn px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="min-h-[250px] flex flex-col items-center justify-center relative">
          {toastMsg && (
            <div className="mb-2.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-xs font-bold text-amber-200">
              {toastMsg}
            </div>
          )}

          {/* 1. AUTH KEYPAD */}
          {task.type === 'code' && (
            <div className="w-full space-y-3 text-center">
              <div className="p-2.5 rounded-xl bg-amber-200/95 text-slate-900 max-w-[220px] mx-auto shadow-md border-b-4 border-amber-400 -rotate-1">
                <div className="text-[10px] font-black tracking-wider text-slate-700">CREW ID MEMO</div>
                <div className="font-orbitron text-2xl font-black tracking-[0.22em]">{targetCode}</div>
              </div>
              <div className="h-11 max-w-[240px] mx-auto rounded-xl bg-emerald-950/90 border-2 border-emerald-500/60 flex items-center justify-center font-orbitron text-xl font-black text-emerald-300 tracking-[0.26em] shadow-inner">
                {entered.padEnd(5, '_')}
              </div>
              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'CLR') {
                        sound.playClick();
                        setEntered('');
                        setToastMsg('');
                      } else if (k === 'OK') {
                        if (entered === targetCode) triggerTaskCompletion(task);
                        else {
                          sound.playErrorBuzz();
                          setToastMsg('コードが一致しません');
                          setEntered('');
                        }
                      } else if (entered.length < 5) {
                        sound.playKeypadBeep(620 + Number(k) * 35);
                        const next = entered + k;
                        setEntered(next);
                        if (next === targetCode) triggerTaskCompletion(task);
                      }
                    }}
                    className={`sf-btn py-2.5 rounded-xl border font-orbitron font-black text-sm ${
                      k === 'OK'
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                        : k === 'CLR'
                        ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-white'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. FIX WIRING (SVG real wires) */}
          {task.type === 'wires' && (
            <div className="w-full space-y-2.5">
              <p className="text-xs text-slate-300 text-center">
                左の端子を選択し、同じ色の右の端子へケーブルを接続してください ({connectedWires.length}/4)
              </p>
              <div className="relative w-full h-56 rounded-2xl bg-slate-950 border-2 border-slate-700 p-4 flex justify-between items-center overflow-hidden">
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 220" preserveAspectRatio="none">
                  {connectedWires.map((col) => {
                    const li = wireColors.indexOf(col);
                    const ri = rightOrder.indexOf(col);
                    if (li < 0 || ri < 0) return null;
                    const y1 = 34 + li * 50;
                    const y2 = 34 + ri * 50;
                    return (
                      <g key={col}>
                        <path
                          d={`M 56 ${y1} C 180 ${y1}, 220 ${y2}, 344 ${y2}`}
                          stroke={col}
                          strokeWidth="10"
                          strokeLinecap="round"
                          fill="none"
                        />
                        <path
                          d={`M 56 ${y1} C 180 ${y1}, 220 ${y2}, 344 ${y2}`}
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </g>
                    );
                  })}
                  {selectedLeft && (
                    <line
                      x1="56"
                      y1={34 + wireColors.indexOf(selectedLeft) * 50}
                      x2="190"
                      y2={34 + wireColors.indexOf(selectedLeft) * 50}
                      stroke={selectedLeft}
                      strokeWidth="6"
                      strokeDasharray="8 6"
                      strokeLinecap="round"
                    />
                  )}
                </svg>

                <div className="relative z-10 flex flex-col justify-between h-full py-1">
                  {wireColors.map((c, i) => {
                    const done = connectedWires.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={done}
                        onClick={() => {
                          sound.playClick();
                          setSelectedLeft(c);
                          setToastMsg('');
                        }}
                        className="sf-btn w-12 h-8 rounded-r-lg border-2 border-white/80 font-orbitron font-black text-[11px] text-slate-950 shadow-md"
                        style={{
                          background: c,
                          opacity: done ? 0.55 : 1,
                          outline: selectedLeft === c ? '3px solid #38bdf8' : 'none'
                        }}
                      >
                        L{i + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="relative z-10 flex flex-col justify-between h-full py-1">
                  {rightOrder.map((c, i) => {
                    const done = connectedWires.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={done}
                        onClick={() => {
                          if (!selectedLeft) {
                            setToastMsg('先に左のケーブルを選択してください');
                            return;
                          }
                          if (selectedLeft === c) {
                            sound.playWireConnect();
                            const next = [...connectedWires, c];
                            setConnectedWires(next);
                            setSelectedLeft(null);
                            setToastMsg('');
                            if (next.length === 4) triggerTaskCompletion(task);
                          } else {
                            sound.playErrorBuzz();
                            setToastMsg('配線カラーが一致しません');
                          }
                        }}
                        className="sf-btn w-12 h-8 rounded-l-lg border-2 border-white/80 font-orbitron font-black text-[11px] text-slate-950 shadow-md"
                        style={{ background: c, opacity: done ? 0.55 : 1 }}
                      >
                        R{i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. OSCILLOSCOPE FREQUENCY ALIGN */}
          {task.type === 'freq' && (
            <div className="w-full space-y-3 text-center">
              <p className="text-xs text-slate-300">
                赤い基準波形に青い波形を重ねて同期ロックさせてください
              </p>
              <div className="rounded-2xl bg-slate-950 border-2 border-slate-700 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-orbitron font-bold">
                  <span className="text-rose-300">TARGET: {targetFreq} Hz</span>
                  <span className={freqLocked ? 'text-emerald-400' : 'text-amber-300'}>
                    {freqLocked ? 'SIGNAL LOCKED' : `CURRENT: ${freqVal} Hz`}
                  </span>
                </div>
                <svg viewBox="0 0 280 76" className="w-full h-24 rounded-xl bg-slate-900/90 border border-slate-800">
                  <line x1="0" y1="38" x2="280" y2="38" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
                  <path d={buildWavePath(targetFreq, 0)} stroke="#fb7185" strokeWidth="2.5" strokeDasharray="5 4" fill="none" />
                  <path
                    d={buildWavePath(freqVal, freqLocked ? 0 : 0.45)}
                    stroke={freqLocked ? '#34d399' : '#38bdf8'}
                    strokeWidth="3"
                    fill="none"
                  />
                </svg>
              </div>
              <input
                type="range"
                min={10}
                max={90}
                value={freqVal}
                onChange={(e) => setFreqVal(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  if (freqLocked) triggerTaskCompletion(task);
                  else {
                    sound.playErrorBuzz();
                    setToastMsg(`波形がズレています（目標 ${targetFreq} Hz 前後）`);
                  }
                }}
                className={`sf-btn px-7 py-2.5 rounded-xl font-black text-sm ${
                  confirmPopping ? 'task-btn-pop ' : ''
                }${freqLocked ? 'bg-emerald-400 text-slate-950' : 'bg-cyan-500 text-slate-950'}`}
              >
                波形を確定（完了）
              </button>
            </div>
          )}

          {/* 4. AMONG US DATA DOWNLOAD / UPLOAD */}
          {task.type === 'download' && (
            <div className="w-full space-y-4 text-center">
              <div className="relative h-24 rounded-2xl bg-slate-950 border border-slate-700 px-6 flex items-center justify-between overflow-hidden">
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-12 h-10 rounded-lg bg-amber-400/90 border-2 border-amber-200 flex items-center justify-center text-slate-900 font-black text-xs">
                    SHIP
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">ローカル端末</span>
                </div>

                <div className="flex-1 mx-4 h-0.5 border-t-2 border-dashed border-cyan-500/40 relative">
                  {dlRunning && (
                    <div className="packet-fly absolute top-1/2 w-5 h-4 rounded bg-cyan-300 border border-white shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                  )}
                </div>

                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-12 h-10 rounded-lg bg-cyan-400/90 border-2 border-cyan-100 flex items-center justify-center text-slate-900 font-black text-xs">
                    HQ
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">本部サーバー</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="w-full h-7 rounded-full bg-slate-950 border-2 border-slate-700 p-1 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-100"
                    style={{ width: `${dlProg}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-orbitron font-bold px-1">
                  <span className="text-slate-400">
                    {dlRunning ? `ESTIMATED: ${Math.max(0, Math.ceil((100 - dlProg) / 40))}s` : 'READY TO TRANSFER'}
                  </span>
                  <span className="text-cyan-300 tabular-nums">{dlProg}%</span>
                </div>
              </div>

              <button
                type="button"
                disabled={dlRunning}
                onClick={() => {
                  sound.playClick();
                  setDlRunning(true);
                }}
                className="sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm"
              >
                {dlRunning ? 'データ送信中...' : 'Download 開始'}
              </button>
            </div>
          )}

          {/* 5. WEAPONS CLEAR ASTEROIDS */}
          {task.type === 'asteroid' && (
            <div className="w-full space-y-2.5 text-center">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-300">レーダー上の小惑星をクリックして迎撃</span>
                <span className="font-orbitron font-black text-emerald-300 tabular-nums">
                  {destroyedCount} / 6 DESTROYED
                </span>
              </div>
              <div className="relative w-full h-52 rounded-2xl bg-emerald-950/50 border-2 border-emerald-500/60 overflow-hidden shadow-inner">
                {/* CRTレーダーグリッド */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-35" viewBox="0 0 400 200">
                  <circle cx="200" cy="100" r="80" stroke="#34d399" strokeWidth="1.2" fill="none" />
                  <circle cx="200" cy="100" r="42" stroke="#34d399" strokeWidth="1" fill="none" />
                  <line x1="0" y1="100" x2="400" y2="100" stroke="#34d399" strokeWidth="1" />
                  <line x1="200" y1="0" x2="200" y2="200" stroke="#34d399" strokeWidth="1" />
                  {laserShot && (
                    <>
                      <line x1="12" y1="196" x2={laserShot.x * 4} y2={laserShot.y * 2} stroke="#86efac" strokeWidth="3.5" />
                      <line x1="388" y1="196" x2={laserShot.x * 4} y2={laserShot.y * 2} stroke="#86efac" strokeWidth="3.5" />
                    </>
                  )}
                </svg>

                {asteroids.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      sound.playLaserShot();
                      setLaserShot({ x: a.x + 4, y: a.y + 6 });
                      window.setTimeout(() => setLaserShot(null), 130);
                      const next = asteroids.filter((x) => x.id !== a.id);
                      setAsteroids(next);
                      setDestroyedCount((c) => c + 1);
                      if (next.length === 0) triggerTaskCompletion(task);
                    }}
                    className="sf-btn absolute flex items-center justify-center text-emerald-200 hover:scale-110"
                    style={{
                      left: `${a.x}%`,
                      top: `${a.y}%`,
                      width: `${a.size + 12}px`,
                      height: `${a.size + 12}px`
                    }}
                    aria-label="小惑星"
                  >
                    <svg
                      width={a.size + 8}
                      height={a.size + 8}
                      viewBox="0 0 40 40"
                      style={{ transform: `rotate(${a.rot}deg)` }}
                    >
                      <polygon
                        points="20,3 34,11 37,24 27,36 12,35 4,22 9,9"
                        fill="#334155"
                        stroke="#6ee7b7"
                        strokeWidth="2.5"
                      />
                      <circle cx="15" cy="16" r="3" fill="#1e293b" />
                      <circle cx="25" cy="24" r="2.2" fill="#1e293b" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 6. START REACTOR (SIMON SAYS 3x3) */}
          {task.type === 'reactor_sim' && (
            <div className="w-full space-y-3 text-center">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-300">
                  {simShowing ? '左モニターの光る順番を記憶してください...' : '右キーパッドで同じ順番に入力！'}
                </span>
                <span className="font-orbitron font-black text-cyan-300">STAGE {simRound} / 2</span>
              </div>
              <div className="grid grid-cols-2 gap-4 items-center">
                {/* 左：パターン表示モニタ */}
                <div className="p-3 rounded-2xl bg-slate-950 border-2 border-cyan-500/40 space-y-2">
                  <div className="text-[10px] font-orbitron text-cyan-300 font-bold">MONITOR</div>
                  <div className="grid grid-cols-3 gap-1.5 max-w-[140px] mx-auto">
                    {Array.from({ length: 9 }, (_, idx) => (
                      <div
                        key={idx}
                        className={`h-9 rounded-lg border transition-colors ${
                          simLitIdx === idx
                            ? 'bg-cyan-400 border-white shadow-[0_0_12px_rgba(34,211,238,0.85)]'
                            : 'bg-slate-900 border-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* 右：操作キーパッド */}
                <div className="p-3 rounded-2xl bg-slate-900 border-2 border-slate-600 space-y-2">
                  <div className="text-[10px] font-orbitron text-emerald-300 font-bold">
                    INPUT ({simInputStep}/{simRound === 1 ? 2 : 3})
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 max-w-[140px] mx-auto">
                    {Array.from({ length: 9 }, (_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={simShowing}
                        onClick={() => {
                          const targetLen = simRound === 1 ? 2 : 3;
                          const expected = simSequence[simInputStep];
                          if (idx === expected) {
                            sound.playKeypadBeep(540 + idx * 45);
                            const nextStep = simInputStep + 1;
                            setSimInputStep(nextStep);
                            setToastMsg('');
                            if (nextStep >= targetLen) {
                              if (simRound === 1) {
                                setSimRound(2);
                              } else {
                                triggerTaskCompletion(task);
                              }
                            }
                          } else {
                            sound.playErrorBuzz();
                            setToastMsg('順番が違います！パターンを再再生します');
                            playSimonRound(simSequence, simRound);
                          }
                        }}
                        className="sf-btn h-9 rounded-lg bg-slate-800 hover:bg-cyan-500/30 border border-slate-500 active:bg-cyan-400"
                        aria-label={`パネル ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. ADMIN SWIPE CARD */}
          {task.type === 'card_swipe' && (
            <div className="w-full space-y-4 text-center">
              <div className="p-4 rounded-2xl bg-slate-950 border-2 border-slate-700 space-y-3">
                <div className="flex items-center justify-between px-2">
                  <span className="font-orbitron font-bold text-xs tracking-wider text-emerald-300">
                    {swipeStatus}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 rounded-full ${swipeGood === false ? 'bg-rose-500' : 'bg-rose-950'}`} />
                    <span className={`w-3 h-3 rounded-full ${swipeGood === true ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-emerald-950'}`} />
                  </div>
                </div>

                <div className="relative h-20 rounded-xl bg-slate-900 border border-slate-700 flex items-center px-3 overflow-hidden">
                  <div
                    className="h-14 w-24 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 border-2 border-white/80 flex flex-col justify-between p-1.5 text-left pointer-events-none shadow-lg"
                    style={{ transform: `translateX(${(swipeVal / 100) * 230}px)` }}
                  >
                    <div className="text-[8px] font-orbitron font-black text-slate-950">CREW ID</div>
                    <div className="h-2 bg-slate-950/75 rounded-sm" />
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={swipeVal}
                  aria-label="IDカードスワイプ"
                  onPointerDown={() => {
                    swipeStartTimeRef.current = performance.now();
                  }}
                  onChange={(e) => {
                    if (!swipeStartTimeRef.current) swipeStartTimeRef.current = performance.now();
                    const v = Number(e.target.value);
                    setSwipeVal(v);
                    if (v >= 95) {
                      const elapsed = performance.now() - swipeStartTimeRef.current;
                      if (elapsed < 75) {
                        sound.playCardSwipe(false);
                        setSwipeGood(false);
                        setSwipeStatus('速すぎます！もう一度ゆっくりスワイプ');
                        setSwipeVal(0);
                        swipeStartTimeRef.current = 0;
                      } else {
                        sound.playCardSwipe(true);
                        setSwipeGood(true);
                        setSwipeStatus('ACCEPTED. THANK YOU.');
                        triggerTaskCompletion(task);
                      }
                    }
                  }}
                  onPointerUp={() => {
                    if (swipeVal < 95) {
                      setSwipeGood(false);
                      setSwipeStatus('右端まで通してください');
                      setSwipeVal(0);
                      swipeStartTimeRef.current = 0;
                    }
                  }}
                  className="w-full accent-emerald-400 cursor-grab"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playCardSwipe(true);
                  setSwipeVal(100);
                  setSwipeGood(true);
                  setSwipeStatus('ACCEPTED. THANK YOU.');
                  triggerTaskCompletion(task);
                }}
                className="sf-btn px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-xs font-bold text-cyan-200"
              >
                ワンタップでスワイプ実行
              </button>
            </div>
          )}

          {/* 8. MEDBAY INSPECT SAMPLE */}
          {task.type === 'sample_scan' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">
                {samplePhase === 'ready'
                  ? '「検査開始」を押して5本の試薬から異常サンプル（赤色）を特定してください'
                  : samplePhase === 'processing'
                  ? `遠心分離＆分光分析中... ${sampleProg}%`
                  : '異常反応を示している赤色の試験管をタップして選択！'}
              </p>

              <div className="flex items-end justify-center gap-4 p-4 rounded-2xl bg-slate-950 border-2 border-slate-700">
                {[0, 1, 2, 3, 4].map((idx) => {
                  const isAnomaly = samplePhase === 'pick' && idx === anomalyIdx;
                  const fillColor =
                    samplePhase === 'ready'
                      ? 'bg-slate-700/60'
                      : samplePhase === 'processing'
                      ? 'bg-cyan-400/70 animate-pulse'
                      : isAnomaly
                      ? 'bg-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.85)]'
                      : 'bg-cyan-400/80';
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={samplePhase !== 'pick'}
                      onClick={() => {
                        if (idx === anomalyIdx) {
                          triggerTaskCompletion(task);
                        } else {
                          sound.playErrorBuzz();
                          setToastMsg('それは正常なサンプルです。赤い異常管を選択してください');
                        }
                      }}
                      className={`sf-btn w-11 h-28 rounded-b-full rounded-t-md border-2 p-1 flex flex-col justify-end overflow-hidden ${
                        isAnomaly ? 'border-rose-300' : 'border-slate-500'
                      } bg-slate-900`}
                      aria-label={`試薬管 ${idx + 1}`}
                    >
                      <div
                        className={`w-full rounded-b-full transition-all duration-300 ${fillColor}`}
                        style={{ height: samplePhase === 'ready' ? '30%' : '78%' }}
                      />
                    </button>
                  );
                })}
              </div>

              {samplePhase === 'ready' && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSamplePhase('processing');
                  }}
                  className="sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm"
                >
                  検査開始 (START)
                </button>
              )}
            </div>
          )}

          {/* 9. FUEL ENGINES (hold_gauge) */}
          {task.type === 'hold_gauge' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">「燃料を注入」ボタンを押してタンクを100%まで満たし完了してください</p>
              <div className="mx-auto w-32 h-36 rounded-2xl bg-slate-950 border-2 border-slate-600 p-2 flex flex-col justify-end overflow-hidden relative">
                <div
                  className="w-full rounded-xl bg-gradient-to-t from-amber-500 to-yellow-300 transition-all duration-75"
                  style={{ height: `${fuelLevel}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-orbitron font-black text-lg text-white drop-shadow tabular-nums">
                  {fuelLevel}%
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                {fuelLevel < 100 ? (
                  <button
                    type="button"
                    onPointerDown={() => {
                      sound.playClick();
                      setFuelHolding(true);
                    }}
                    onPointerUp={() => setFuelHolding(false)}
                    onPointerLeave={() => setFuelHolding(false)}
                    onClick={() => {
                      sound.playKeypadBeep(680);
                      setFuelLevel((p) => Math.min(100, p + 25));
                    }}
                    className="sf-btn px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm"
                  >
                    ⛽ 燃料を注入（長押し / 連打）
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerTaskCompletion(task)}
                    className={`sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm ${
                      confirmPopping ? 'task-btn-pop' : ''
                    }`}
                  >
                    ✓ 給油完了を確定
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 10. EMPTY CHUTE (lever_pull) */}
          {task.type === 'lever_pull' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">エアロック排出レバーを一番右（100%）まで引いてゴミを放出！</p>
              <div className="p-4 rounded-2xl bg-slate-950 border-2 border-slate-700 space-y-3">
                <div className="h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between px-4">
                  <span className="text-xs font-bold text-slate-300">排出ゲート開度</span>
                  <span className="font-orbitron font-black text-lg text-emerald-300 tabular-nums">{leverVal}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={leverVal}
                  onChange={(e) => setLeverVal(Number(e.target.value))}
                  className="w-full accent-rose-400 cursor-grab"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (leverVal >= 90) {
                    triggerTaskCompletion(task);
                  } else {
                    sound.playClick();
                    setLeverVal(100);
                    triggerTaskCompletion(task);
                  }
                }}
                className={`sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm ${
                  confirmPopping ? 'task-btn-pop' : ''
                }`}
              >
                {leverVal >= 90 ? '✓ ゴミ放出を完了' : '⬇ レバーを一気に引いて放出'}
              </button>
            </div>
          )}

          {/* 11. CLEAN O2 FILTER (clean_leaves) */}
          {task.type === 'clean_leaves' && (
            <div className="w-full space-y-2.5 text-center">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-300">吸気口に詰まった葉・異物をすべてタップして除去</span>
                <span className="font-orbitron font-black text-emerald-300 tabular-nums">残り {leaves.length} 個</span>
              </div>
              <div className="relative w-full h-52 rounded-2xl bg-slate-950 border-2 border-teal-500/60 overflow-hidden">
                <div className="absolute left-3 inset-y-4 w-10 rounded-xl bg-slate-900 border-2 border-dashed border-cyan-400/50 flex items-center justify-center text-[10px] font-orbitron font-bold text-cyan-300">
                  VENT
                </div>
                {leaves.map((lf) => (
                  <button
                    key={lf.id}
                    type="button"
                    onClick={() => {
                      sound.playWireConnect();
                      const next = leaves.filter((x) => x.id !== lf.id);
                      setLeaves(next);
                      if (next.length === 0) triggerTaskCompletion(task);
                    }}
                    className="sf-btn absolute w-11 h-11 rounded-full bg-emerald-500/25 border border-emerald-400 flex items-center justify-center text-xl"
                    style={{ left: `${lf.x}%`, top: `${lf.y}%`, transform: `rotate(${lf.rot}deg)` }}
                    aria-label="詰まった葉"
                  >
                    🍃
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 12. PRIME SHIELDS (hex_shields) */}
          {task.type === 'hex_shields' && (
            <div className="w-full space-y-3 text-center">
              <p className="text-xs text-slate-300">赤く停止しているシールドセルをすべて青く起動してください</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-[260px] mx-auto p-3 rounded-2xl bg-slate-950 border-2 border-slate-700">
                {hexStates.map((on, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      sound.playKeypadBeep(on ? 460 : 780);
                      const next = hexStates.map((v, i) => (i === idx ? true : v));
                      setHexStates(next);
                      if (next.every(Boolean)) triggerTaskCompletion(task);
                    }}
                    className={`sf-btn w-16 h-16 rounded-2xl border-2 font-orbitron font-black text-xs transition-colors ${
                      on
                        ? 'bg-cyan-400/85 border-white text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.65)]'
                        : 'bg-rose-500/75 border-rose-300 text-white'
                    }`}
                  >
                    {on ? 'ON' : 'OFF'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 13. UNLOCK MANIFOLDS (order_numbers 1..10) */}
          {task.type === 'order_numbers' && (
            <div className="w-full space-y-3 text-center">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-300">1 から 10 まで昇順にパネルをタップ！</span>
                <span className="font-orbitron font-black text-cyan-300">次: {nextManifoldNum}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 max-w-sm mx-auto p-3 rounded-2xl bg-slate-950 border-2 border-slate-700">
                {manifoldOrder.map((num) => {
                  const done = num < nextManifoldNum;
                  return (
                    <button
                      key={num}
                      type="button"
                      disabled={done}
                      onClick={() => {
                        if (num === nextManifoldNum) {
                          sound.playKeypadBeep(520 + num * 40);
                          const nxt = nextManifoldNum + 1;
                          setNextManifoldNum(nxt);
                          setToastMsg('');
                          if (nxt > 10) triggerTaskCompletion(task);
                        } else {
                          sound.playErrorBuzz();
                          setNextManifoldNum(1);
                          setToastMsg('順番が違います！1からやり直してください');
                        }
                      }}
                      className={`sf-btn h-12 rounded-xl border-2 font-orbitron font-black text-base ${
                        done
                          ? 'bg-emerald-500/40 border-emerald-400 text-emerald-200'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-white'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 14. CHART COURSE / ALIGN NAV (nav_align) */}
          {task.type === 'nav_align' && (
            <div className="w-full space-y-3 text-center">
              <p className="text-xs text-slate-300">星図エリア内をタップして青い照準を赤い目的地へ合わせ「確定」を押してください</p>
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(8, Math.min(92, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                  const y = Math.max(10, Math.min(90, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                  sound.playClick();
                  setNavPos({ x, y });
                }}
                className="relative w-full h-44 rounded-2xl bg-slate-950 border-2 border-cyan-500/50 overflow-hidden cursor-crosshair"
              >
                <div
                  className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-rose-400 bg-rose-500/25 pointer-events-none animate-pulse"
                  style={{ left: `${navTarget.x}%`, top: `${navTarget.y}%` }}
                />
                <div
                  className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-cyan-300 bg-cyan-400/30 pointer-events-none"
                  style={{ left: `${navPos.x}%`, top: `${navPos.y}%` }}
                />
              </div>
              {(() => {
                const aligned = Math.hypot(navPos.x - navTarget.x, navPos.y - navTarget.y) < 16;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (aligned) triggerTaskCompletion(task);
                      else {
                        sound.playErrorBuzz();
                        setToastMsg('赤い目的地マーカーの近くをクリックして照準を合わせてください');
                      }
                    }}
                    className={`sf-btn px-7 py-2.5 rounded-xl font-black text-sm ${
                      confirmPopping ? 'task-btn-pop ' : ''
                    }${aligned ? 'bg-emerald-400 text-slate-950' : 'bg-cyan-500 text-slate-950'}`}
                  >
                    {aligned ? '✓ 航路座標を確定（完了）' : '📡 照準を合わせて座標確定'}
                  </button>
                );
              })()}
            </div>
          )}

          {/* 15. CALIBRATE DISTRIBUTOR (timing_lock) */}
          {task.type === 'timing_lock' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">針が緑のターゲットゾーン（上部）を通過する瞬間にロック！ ({calibStep}/3)</p>
              <div className="flex items-center justify-center gap-6">
                <div className="relative w-32 h-32 rounded-full bg-slate-950 border-4 border-slate-700 flex items-center justify-center">
                  <div className="absolute top-0 w-7 h-4 rounded-b bg-emerald-400/80" />
                  <div
                    className="w-1.5 h-12 bg-cyan-300 rounded-full origin-bottom"
                    style={{ transform: `translateY(-22px) rotate(${calibAngle}deg)` }}
                  />
                </div>
                <div className="space-y-1.5 text-left text-xs font-orbitron font-bold">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={i < calibStep ? 'text-emerald-400' : i === calibStep ? 'text-cyan-300' : 'text-slate-500'}>
                      {i < calibStep ? '✓ LOCKED' : i === calibStep ? '▶ ACTIVE' : '○ WAIT'} #{i + 1}
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const diff = Math.min(calibAngle, 360 - calibAngle);
                  if (diff <= 48) {
                    sound.playWireConnect();
                    const next = calibStep + 1;
                    setCalibStep(next);
                    setToastMsg('');
                    if (next >= 3) triggerTaskCompletion(task);
                  } else {
                    sound.playErrorBuzz();
                    setToastMsg('タイミングがズレています！上部緑ゾーンで押してください');
                  }
                }}
                className={`sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm ${
                  confirmPopping ? 'task-btn-pop' : ''
                }`}
              >
                ⚡ 同期ロック ({calibStep}/3)
              </button>
            </div>
          )}

          {/* 16. THERMAL MELT (thermal_melt) */}
          {task.type === 'thermal_melt' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">凍結したパイプに熱波を送って解凍してください ({meltHeat}%)</p>
              <div className="w-full h-20 rounded-2xl bg-slate-950 border-2 border-cyan-400/60 flex items-center justify-center relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500/75 to-amber-400/75 transition-all"
                  style={{ width: `${meltHeat}%` }}
                />
                <span className="relative z-10 font-orbitron font-black text-lg text-white">
                  {meltHeat >= 100 ? '🔥 THAWED COMPLETE!' : `❄️ FROST ${100 - meltHeat}%`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (meltHeat < 100) {
                    sound.playKeypadBeep(520 + meltHeat * 3);
                    const next = Math.min(100, meltHeat + 25);
                    setMeltHeat(next);
                    if (next >= 100) triggerTaskCompletion(task);
                  } else {
                    triggerTaskCompletion(task);
                  }
                }}
                className={`sf-btn px-7 py-2.5 rounded-xl bg-orange-400 hover:bg-orange-300 text-slate-950 font-black text-sm ${
                  confirmPopping ? 'task-btn-pop' : ''
                }`}
              >
                🔥 ヒーター出力（連打で解凍）
              </button>
            </div>
          )}

          {/* 17. VALVE SPIN (valve_spin) */}
          {task.type === 'valve_spin' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">圧力バルブを4回回転させて蒸気圧を正常化してください ({valveTurns}/4)</p>
              <button
                type="button"
                onClick={() => {
                  sound.playWireConnect();
                  const next = valveTurns + 1;
                  setValveTurns(next);
                  if (next >= 4) triggerTaskCompletion(task);
                }}
                className={`sf-btn w-32 h-32 mx-auto rounded-full border-4 border-cyan-400 bg-slate-900 flex flex-col items-center justify-center transition-transform ${
                  confirmPopping ? 'task-btn-pop' : ''
                }`}
                style={{ transform: `rotate(${valveTurns * 90}deg)` }}
              >
                <span className="text-3xl">⚙️</span>
                <span className="text-xs font-orbitron font-black text-cyan-300 mt-1">{valveTurns}/4</span>
              </button>
            </div>
          )}

          {/* 18. MAGMA TEMP BALANCE (temp_balance) */}
          {task.type === 'temp_balance' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-xs text-slate-300">左の温度を右の目標温度（{tempGoal}°C）に合わせて「確定」を押してください</p>
              <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                <div className="p-3 rounded-2xl bg-slate-950 border-2 border-cyan-400/60 space-y-2">
                  <div className="text-[10px] font-orbitron text-cyan-300">CURRENT</div>
                  <div className="font-orbitron font-black text-2xl text-white tabular-nums">{tempReading}°C</div>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setTempReading((v) => v - 40);
                      }}
                      className="sf-btn px-3 py-1 rounded-lg bg-slate-800 border border-slate-600 font-black"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setTempReading((v) => v + 40);
                      }}
                      className="sf-btn px-3 py-1 rounded-lg bg-slate-800 border border-slate-600 font-black"
                    >
                      ▲
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border-2 border-amber-400/60 flex flex-col items-center justify-center">
                  <div className="text-[10px] font-orbitron text-amber-300">TARGET</div>
                  <div className="font-orbitron font-black text-2xl text-amber-300 tabular-nums">{tempGoal}°C</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (tempReading === tempGoal) triggerTaskCompletion(task);
                  else {
                    sound.playErrorBuzz();
                    setToastMsg(`目標温度 ${tempGoal}°C と一致していません`);
                  }
                }}
                className={`sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm ${
                  confirmPopping ? 'task-btn-pop' : ''
                }`}
              >
                🌡️ 温度設定を確定
              </button>
            </div>
          )}

          {/* 19. CYBER DECRYPT (pair_decrypt) */}
          {task.type === 'pair_decrypt' && (
            <div className="w-full space-y-3 text-center">
              <p className="text-xs text-slate-300">同じ暗号シンボルを2枚ずつ選択して復号してください</p>
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto p-3 rounded-2xl bg-slate-950 border-2 border-purple-500/50">
                {cipherCards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={c.matched}
                    onClick={() => {
                      if (cipherPick === null) {
                        sound.playClick();
                        setCipherPick(c.id);
                      } else if (cipherPick === c.id) {
                        setCipherPick(null);
                      } else {
                        const first = cipherCards.find((x) => x.id === cipherPick);
                        if (first && first.sym === c.sym) {
                          sound.playWireConnect();
                          const next = cipherCards.map((x) =>
                            x.id === c.id || x.id === first.id ? { ...x, matched: true } : x
                          );
                          setCipherCards(next);
                          setCipherPick(null);
                          setToastMsg('');
                          if (next.every((x) => x.matched)) triggerTaskCompletion(task);
                        } else {
                          sound.playErrorBuzz();
                          setCipherPick(null);
                          setToastMsg('シンボルが一致しません');
                        }
                      }
                    }}
                    className={`sf-btn h-16 rounded-xl border-2 text-2xl font-black ${
                      c.matched
                        ? 'bg-emerald-500/35 border-emerald-400 text-emerald-200'
                        : cipherPick === c.id
                        ? 'bg-purple-500/40 border-purple-300 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-cyan-300'
                    }`}
                  >
                    {c.sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 20. CRYSTAL / BOTANY TUNE (crystal_tune) */}
          {task.type === 'crystal_tune' && (
            <div className="w-full space-y-3 text-center">
              <p className="text-xs text-slate-300">3本の共鳴/給水バーをすべて最適帯（40〜65%）へ調整し確定を押してください</p>
              <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950 border-2 border-emerald-500/40">
                {['水分・光量 A', '共鳴周波数 B', '安定出力 C'].map((label, idx) => {
                  const val = tuneSliders[idx];
                  const ok = val >= 40 && val <= 65;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-300">{label}</span>
                        <span className={ok ? 'text-emerald-400' : 'text-amber-300'}>
                          {val}% {ok ? '✓ OPTIMAL' : '(目標 40-65%)'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={val}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setTuneSliders((prev) => {
                            const next: [number, number, number] = [...prev] as [number, number, number];
                            next[idx] = v;
                            return next;
                          });
                        }}
                        className="w-full accent-emerald-400 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (tuneSliders.every((v) => v >= 40 && v <= 65)) {
                    triggerTaskCompletion(task);
                  } else {
                    sound.playErrorBuzz();
                    setToastMsg('すべてのスライダーを 40〜65% の最適帯へ調整してください');
                  }
                }}
                className={`sf-btn px-7 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm ${
                  confirmPopping ? 'task-btn-pop' : ''
                }`}
              >
                💎 共鳴・給水設定を確定
              </button>
            </div>
          )}

          {/* 完了検証＆TASK COMPLETED! 演出オーバーレイ */}
          {completingPhase !== 'idle' && (
            <div className="absolute inset-0 z-30 rounded-2xl bg-slate-950/92 flex flex-col items-center justify-center p-6 text-center space-y-3">
              {completingPhase === 'verifying' ? (
                <>
                  <div className="w-14 h-14 rounded-full border-4 border-cyan-500/25 border-t-cyan-400 spin-fast" />
                  <div className="font-orbitron font-black text-sm tracking-widest text-cyan-300">
                    VERIFYING SYSTEM DATA...
                  </div>
                  <div className="w-48 h-2 rounded-full bg-slate-800 overflow-hidden relative">
                    <div className="task-sweep-bar absolute inset-y-0 w-24 rounded-full bg-cyan-400" />
                  </div>
                </>
              ) : (
                <div className="au-cutin-pop flex flex-col items-center space-y-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/25 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_28px_rgba(52,211,153,0.65)]">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13L9.5 17.5L19 7" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="font-orbitron font-black text-2xl tracking-widest text-emerald-300">
                    TASK COMPLETED!
                  </div>
                  <div className="text-xs font-bold text-slate-200">「{task.name}」の処理が完了しました</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* 3. サボタージュ選択モーダル */
export const SabotageModal: React.FC<{
  open: boolean;
  isMadScientist: boolean;
  onClose: () => void;
  onTrigger: (type: 'lights' | 'reactor') => void;
}> = ({ open, isMadScientist, onClose, onTrigger }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-5 w-full max-w-md border-rose-500/60 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <h3 className="font-orbitron font-bold text-base text-rose-400">SABOTAGE / 妨害工作</h3>
          <button
            type="button"
            onClick={onClose}
            className="sf-btn px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onTrigger('lights')}
            className="sf-btn w-full p-4 rounded-2xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-left"
          >
            <div className="font-black text-amber-300 text-sm">照明システム停電（Lights Out）</div>
            <div className="text-xs text-slate-300 mt-1">
              クルー陣営の視界を極端に狭くします（修理地点で復旧可能）
            </div>
          </button>
          {!isMadScientist && (
            <button
              type="button"
              onClick={() => onTrigger('reactor')}
              className="sf-btn w-full p-4 rounded-2xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400 text-left"
            >
              <div className="font-black text-rose-300 text-sm">炉心メルトダウン（35秒制限）</div>
              <div className="text-xs text-slate-300 mt-1">
                時間内に炉心を安定化させないとインポスター陣営の勝利！
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* 4. 全体マップモーダル（アドミン人数表示対応） */
export const MiniMapModal: React.FC<{
  open: boolean;
  mapDef: MapDef;
  me: PlayerState | undefined;
  players: Record<string, PlayerState>;
  myTasks: string[];
  completedTasks: Record<string, boolean>;
  sabotage: { type: 'lights' | 'reactor'; timer: number } | null;
  radarTimer: number;
  trackedTargetId: string | null;
  adminTimer: number;
  onClose: () => void;
}> = ({
  open,
  mapDef,
  me,
  players,
  myTasks,
  completedTasks,
  sabotage,
  radarTimer,
  trackedTargetId,
  adminTimer,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open || !canvasRef.current || !me) return;
    renderMiniMapCanvas({
      canvas: canvasRef.current,
      mapDef,
      me,
      players,
      myTasks,
      completedTasks,
      hasTasks: hasCrewTasks(me.role),
      sabotage,
      radarTimer,
      trackedTargetId,
      adminTimer
    });
  }, [open, mapDef, me, players, myTasks, completedTasks, sabotage, radarTimer, trackedTargetId, adminTimer]);

  if (!open || !me) return null;

  const isRadarActive = me.role === 'radar' && radarTimer > 0;
  const trackedPlayer = me.role === 'tracker' && trackedTargetId ? players[trackedTargetId] : null;
  const isTracking = Boolean(trackedPlayer && trackedPlayer.alive);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-4 w-full max-w-2xl border-cyan-400/60 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-orbitron font-bold text-sm sm:text-base text-cyan-300">
            {mapDef.name} - 全体マップ
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="sf-btn px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
          >
            ✕ 閉じる
          </button>
        </div>
        <div className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <span>🟢 あなたの現在地</span>
          <span>🟡 未完了タスク</span>
          <span>🚨 緊急妨害修理地点</span>
          {adminTimer > 0 && (
            <span className="text-emerald-300 font-bold">
              アドミン盤起動中（残り {Math.ceil(adminTimer)}s）
            </span>
          )}
          {isRadarActive && <span className="text-teal-300 font-bold">レーダー探知：全生存者を表示中</span>}
          {isTracking && <span className="text-rose-300 font-bold">発信機追跡：マーク対象を表示中</span>}
        </div>
      </div>
    </div>
  );
};

/* 5. バイタル / ドアログ 端末モーダル */
export const GimmickInfoModal: React.FC<{
  mode: 'vitals' | 'doorlog' | null;
  players: Record<string, PlayerState>;
  doorLogs: string[];
  onClose: () => void;
}> = ({ mode, players, doorLogs, onClose }) => {
  if (!mode) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-5 w-full max-w-md border-emerald-400/60 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <h3 className="font-orbitron font-bold text-sm text-emerald-300">
            {mode === 'vitals' ? 'VITALS / クルー生体反応' : 'SENSOR LOG / 通路通過ログ'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="sf-btn px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-bold"
          >
            ✕ 閉じる
          </button>
        </div>
        {mode === 'vitals' ? (
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto text-xs">
            {Object.values(players).map((p) => {
              const cObj = CREW_COLORS.find((c) => c.id === p.color) || CREW_COLORS[0];
              return (
                <div
                  key={p.id}
                  className={`p-2 rounded-xl border flex items-center justify-between ${
                    p.alive ? 'bg-slate-900/90 border-emerald-500/40' : 'bg-rose-950/40 border-rose-500/40 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cObj.hex }} />
                    <span className="font-bold text-white truncate">{p.name}</span>
                  </div>
                  <span className={`font-bold text-[10px] ${p.alive ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {p.alive ? '生存' : '反応消失'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto text-xs">
            {doorLogs.length === 0 ? (
              <div className="py-6 text-center text-slate-400">まだ通過ログは記録されていません</div>
            ) : (
              doorLogs.map((log, i) => (
                <div key={i} className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-200">
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* 6. 緊急会議＆投票モーダル */
export const MeetingModal: React.FC<{
  open: boolean;
  reason: 'body' | 'emergency';
  callerName: string;
  timer: number;
  votes: Record<string, string>;
  me: PlayerState | undefined;
  players: Record<string, PlayerState>;
  chatHistory: ChatEntry[];
  onVote: (targetId: string) => void;
  onSendChat: (text: string, stampId?: string) => void;
}> = ({ open, reason, callerName, timer, votes, me, players, chatHistory, onVote, onSendChat }) => {
  const [chatInput, setChatInput] = useState('');
  const hatThumbs = useMemo(() => {
    const map: Record<string, string> = {};
    for (const h of CREW_HATS) {
      map[h.id] = getHatThumbnailUrl(h.id);
    }
    return map;
  }, []);
  if (!open || !me) return null;

  const amIGhost = !me.alive;
  const myVoted = Boolean(votes[me.id]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-2 sm:p-4">
      <div className="sf-panel rounded-3xl p-4 sm:p-5 w-full max-w-5xl max-h-[94vh] flex flex-col gap-3 border-rose-500/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2">
          <div>
            <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-black">
              {reason === 'body' ? 'DEAD BODY REPORTED' : 'EMERGENCY MEETING'}
            </span>
            <h3 className="font-black text-base sm:text-lg text-white mt-1">
              {reason === 'body'
                ? `${callerName} が倒れたクルーを発見しました！犯人を追放してください`
                : `${callerName} が緊急会議を招集しました！`}
            </h3>
          </div>
          <div className="px-4 py-1.5 rounded-2xl bg-slate-900 border border-amber-400/60 text-center">
            <div className="text-[10px] text-amber-300 font-bold">残り議論時間</div>
            <div className="font-orbitron font-black text-xl text-white tabular-nums">{Math.max(0, Math.ceil(timer))}s</div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 overflow-hidden min-h-[300px]">
          <div className="md:col-span-6 flex flex-col justify-between overflow-y-auto pr-1 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(players).map((p) => {
                const cObj = CREW_COLORS.find((c) => c.id === p.color) || CREW_COLORS[0];
                const hObj = CREW_HATS.find((h) => h.id === (p.hat || 'none')) || CREW_HATS[0];
                const hasVoted = Boolean(votes[p.id]);
                const canVoteTarget = p.alive && !amIGhost && !myVoted;
                const showImpPartner = isImpostorTeam(me.role) && isImpostorTeam(p.role);
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 ${
                      p.alive ? 'bg-slate-900/90 border-slate-700' : 'bg-slate-950/60 border-slate-800 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-full border border-white/70 shrink-0"
                        style={{ background: cObj.hex }}
                      />
                      {hatThumbs[hObj.id] ? (
                        <img
                          src={hatThumbs[hObj.id]}
                          alt={hObj.name}
                          className="w-6 h-6 object-contain shrink-0 pointer-events-none"
                        />
                      ) : (
                        <span className="text-sm shrink-0">{hObj.icon}</span>
                      )}
                      <div className="min-w-0">
                        <div className={`font-bold text-xs truncate ${showImpPartner ? 'text-rose-400' : 'text-white'}`}>
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.alive ? (hasVoted ? '投票済' : '議論中') : '脱落'}
                        </div>
                      </div>
                    </div>
                    {canVoteTarget && (
                      <button
                        type="button"
                        onClick={() => onVote(p.id)}
                        className="sf-btn px-2.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs shrink-0"
                      >
                        投票
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={amIGhost || myVoted}
              onClick={() => onVote('skip')}
              className="sf-btn w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-500 text-xs font-black text-slate-200"
            >
              投票をスキップする
            </button>
          </div>

          <div className="md:col-span-6 flex flex-col bg-slate-950/85 rounded-2xl border border-slate-800 p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-cyan-300">会議チャット & スタンプ</span>
              {amIGhost && (
                <span className="text-[11px] text-purple-300 font-bold">
                  霊界チャット中（生存者には見えません）
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs mb-2 pr-1">
              {chatHistory
                .filter((m) => !m.isGhost || amIGhost)
                .map((m) => (
                  <div key={m.id} className="leading-snug flex flex-wrap items-center gap-1.5">
                    {m.isGhost && <span className="text-purple-400 font-bold">[霊界] </span>}
                    <span className="font-bold" style={{ color: m.color }}>
                      {m.sender}:
                    </span>
                    {m.stampId ? <ChatStampBadge stampId={m.stampId} compact /> : null}
                    {m.text && <span className="text-slate-100">{m.text}</span>}
                  </div>
                ))}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1.5">
              {CHAT_STAMPS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onSendChat(st.caption, st.id)}
                  className="sf-btn px-2 py-1 rounded-lg border text-[10px] font-black text-white whitespace-nowrap shrink-0"
                  style={{ background: st.bg, borderColor: st.accent }}
                >
                  {st.label}
                </button>
              ))}
              {QUICK_CHAT_PRESETS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSendChat(q.text)}
                  className="sf-btn px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-bold text-cyan-200 whitespace-nowrap shrink-0"
                >
                  {q.text}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const txt = chatInput.trim();
                if (!txt) return;
                setChatInput('');
                onSendChat(txt);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                maxLength={90}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="推理やアリバイを発言..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:outline-none text-xs text-white"
              />
              <button type="submit" className="sf-btn px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs">
                発言
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export function getTaskLabelInMap(taskId: string, mapDef: MapDef, playersRoomFinder: (x: number, y: number) => string) {
  const t = ALL_TASKS.find((x) => x.id === taskId);
  const spot = mapDef.taskSpots.find((s) => s.taskId === taskId);
  const roomLabel = spot ? playersRoomFinder(spot.x, spot.y) : '';
  return `${roomLabel}: ${t ? t.name : taskId}`;
}
