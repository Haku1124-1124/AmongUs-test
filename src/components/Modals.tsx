import React from 'react';
import { DEFAULT_KEYBINDS, KEYBIND_LABELS, ROLES_DEF } from '../game/constants';
import { formatKeyCodeLabel } from '../game/storage';

interface RolesGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const RolesGuideModal: React.FC<RolesGuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto border-purple-400/60 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-700">
          <div>
            <h3 className="font-orbitron text-base font-bold text-purple-300">
              📖 全20役職一覧＆強さバランス調整ガイド
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              クルー陣営11種・インポスター陣営5種・第三陣営4種の全20役職（クール・回数・視界調整済み）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="役職ガイドを閉じる"
            className="sf-btn px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {Object.values(ROLES_DEF).map((r) => {
            const teamLabel =
              r.team === 'crew' ? 'クルー陣営' : r.team === 'impostor' ? 'インポスター陣営' : '第三陣営';
            return (
              <div key={r.id} className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-orbitron font-black text-xs" style={{ color: r.color }}>
                    {r.jp} ({r.name})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                    {teamLabel}
                  </span>
                </div>
                <div className="text-[10px] font-bold text-emerald-300">⚖️ {r.balance}</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{r.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface KeybindModalProps {
  open: boolean;
  keybinds: Record<string, string>;
  listeningAction: string | null;
  onStartListen: (action: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export const KeybindModal: React.FC<KeybindModalProps> = ({
  open,
  keybinds,
  listeningAction,
  onStartListen,
  onReset,
  onClose
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto border-cyan-400/60 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-700">
          <h3 className="font-orbitron text-base font-bold text-cyan-300">⌨️ KEY BINDINGS / 操作キー設定</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="キー設定を閉じる"
            className="sf-btn px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-slate-300">
          変更したい項目のボタンをクリックし、割り当てたいキーボードのキーを押してください。
        </p>
        <div className="space-y-2 text-xs">
          {Object.keys(KEYBIND_LABELS).map((action) => {
            const isListening = listeningAction === action;
            const code = keybinds[action] || DEFAULT_KEYBINDS[action];
            return (
              <div
                key={action}
                className="px-3 py-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2"
              >
                <span className="font-bold text-slate-200">{KEYBIND_LABELS[action]}</span>
                <button
                  type="button"
                  onClick={() => onStartListen(action)}
                  className={`sf-btn px-3.5 py-1.5 rounded-lg font-orbitron font-black text-xs min-w-[100px] ${
                    isListening
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-cyan-200'
                  }`}
                >
                  {isListening ? 'キーを押して待機...' : formatKeyCodeLabel(code)}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onReset}
            className="sf-btn px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
          >
            ↺ 初期設定に戻す
          </button>
          <button
            type="button"
            onClick={onClose}
            className="sf-btn px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};

interface NetConfigModalProps {
  open: boolean;
  customPublicUrl: string;
  onChangeUrl: (val: string) => void;
  onSaveUrl: () => void;
  onSwitchP2P: () => void;
  onSwitchOffline: () => void;
  onClose: () => void;
}

export const NetConfigModal: React.FC<NetConfigModalProps> = ({
  open,
  customPublicUrl,
  onChangeUrl,
  onSaveUrl,
  onSwitchP2P,
  onSwitchOffline,
  onClose
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="sf-panel rounded-3xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto border-cyan-400/60 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-700">
          <h3 className="font-orbitron text-base font-bold text-cyan-300">🌐 オンライン通信設定</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="通信設定を閉じる"
            className="sf-btn px-3 py-1 rounded-xl bg-slate-800 text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/40 space-y-2">
            <div className="font-bold text-cyan-300">1. P2Pリアルタイム通信（サーバー不要・推奨）</div>
            <p className="text-slate-300 leading-relaxed">
              PC・スマホ間で5桁コードを使ってリアルタイム対戦できます。
            </p>
            <button
              type="button"
              onClick={onSwitchP2P}
              className="sf-btn w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black"
            >
              🌐 P2Pオンラインモードに接続
            </button>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-2">
            <div className="font-bold text-emerald-300">2. 公開サイトURL設定</div>
            <input
              type="url"
              value={customPublicUrl}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
            />
            <button
              type="button"
              onClick={onSaveUrl}
              className="sf-btn w-full py-2 rounded-xl bg-emerald-500 text-slate-950 font-black"
            >
              URLを保存
            </button>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-2">
            <div className="font-bold text-slate-300">3. オフラインソロ練習モード</div>
            <button
              type="button"
              onClick={onSwitchOffline}
              className="sf-btn w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold"
            >
              🤖 AIボット専用オフラインモードへ切替
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
