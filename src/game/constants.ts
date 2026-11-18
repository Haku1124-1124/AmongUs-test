export interface CrewColor {
  id: string;
  name: string;
  hex: string;
  dark: string;
}

export interface CrewHat {
  id: string;
  name: string;
  icon: string;
}

export type RoleTeam = 'crew' | 'impostor' | 'neutral';

export interface RoleDef {
  id: string;
  name: string;
  jp: string;
  team: RoleTeam;
  color: string;
  balance: string;
  desc: string;
}

export type TaskMechanicType =
  | 'wires'
  | 'code'
  | 'freq'
  | 'download'
  | 'asteroid'
  | 'reactor_sim'
  | 'card_swipe'
  | 'sample_scan'
  | 'hold_gauge'
  | 'lever_pull'
  | 'clean_leaves'
  | 'hex_shields'
  | 'order_numbers'
  | 'nav_align'
  | 'timing_lock'
  | 'thermal_melt'
  | 'valve_spin'
  | 'temp_balance'
  | 'pair_decrypt'
  | 'crystal_tune';

export interface TaskDef {
  id: string;
  name: string;
  type: TaskMechanicType;
  themeTag?: string;
}

export interface CrewPet {
  id: string;
  name: string;
  desc: string;
}

export interface KillEffectDef {
  id: string;
  name: string;
  accent: string;
}

export interface ChatStampDef {
  id: string;
  label: string;
  caption: string;
  bg: string;
  accent: string;
}

export const CREW_COLORS: CrewColor[] = [
  { id: 'red', name: 'レッド', hex: '#ef4444', dark: '#991b1b' },
  { id: 'cyan', name: 'シアン', hex: '#06b6d4', dark: '#155e75' },
  { id: 'lime', name: 'ライム', hex: '#84cc16', dark: '#3f6212' },
  { id: 'amber', name: 'イエロー', hex: '#f59e0b', dark: '#92400e' },
  { id: 'purple', name: 'パープル', hex: '#a855f7', dark: '#581c87' },
  { id: 'pink', name: 'ピンク', hex: '#ec4899', dark: '#9d174d' },
  { id: 'white', name: 'ホワイト', hex: '#f1f5f9', dark: '#64748b' },
  { id: 'orange', name: 'オレンジ', hex: '#f97316', dark: '#9a3412' },
  { id: 'blue', name: 'ブルー', hex: '#2563eb', dark: '#1e3a8a' },
  { id: 'emerald', name: 'エメラルド', hex: '#10b981', dark: '#065f46' },
  { id: 'black', name: 'ブラック', hex: '#334155', dark: '#090d16' },
  { id: 'brown', name: 'ブラウン', hex: '#92400e', dark: '#451a03' },
  { id: 'coral', name: 'コーラル', hex: '#fb7185', dark: '#9f1239' },
  { id: 'gold', name: 'ゴールド', hex: '#eab308', dark: '#713f12' },
  { id: 'indigo', name: 'インディゴ', hex: '#6366f1', dark: '#312e81' }
];

export const CREW_HATS: CrewHat[] = [
  { id: 'none', name: 'なし', icon: '🚫' },
  { id: 'crown', name: '黄金の王冠', icon: '👑' },
  { id: 'cat', name: 'ネコミミ', icon: '🐱' },
  { id: 'halo', name: '天使の輪', icon: '😇' },
  { id: 'sprout', name: 'ふたば', icon: '🌱' },
  { id: 'antenna', name: '宇宙アンテナ', icon: '📡' },
  { id: 'devil', name: 'デビルホーン', icon: '😈' },
  { id: 'cap', name: 'ベースボール帽', icon: '🧢' },
  { id: 'party', name: 'パーティー帽', icon: '🎉' },
  { id: 'tophat', name: 'シルクハット', icon: '🎩' },
  { id: 'viking', name: 'バイキング兜', icon: '⚔️' },
  { id: 'bunny', name: 'ウサミミ', icon: '🐰' },
  { id: 'chef', name: 'コック帽', icon: '👨‍🍳' },
  { id: 'pirate', name: '海賊帽', icon: '🏴‍☠️' },
  { id: 'headphones', name: 'ヘッドホン', icon: '🎧' },
  { id: 'flower', name: 'ハイビスカス', icon: '🌺' },
  { id: 'wizard', name: '魔法使い帽', icon: '🧙' },
  { id: 'cowboy', name: 'カウボーイ帽', icon: '🤠' },
  { id: 'ribbon', name: '大きなリボン', icon: '🎀' },
  { id: 'ufo', name: 'ミニUFO', icon: '🛸' },
  { id: 'samurai', name: '戦国武将兜', icon: '⛩️' },
  { id: 'ninja', name: '忍者額当て', icon: '🥷' },
  { id: 'visor_hud', name: 'サイバーバイザー', icon: '🕶️' },
  { id: 'captain', name: '宇宙艦長制帽', icon: '🎖️' },
  { id: 'bear', name: 'クマミミ', icon: '🐻' },
  { id: 'fox_mask', name: 'キツネお面', icon: '🦊' },
  { id: 'goggles', name: '飛行士ゴーグル', icon: '🥽' },
  { id: 'pumpkin', name: 'パンプキン帽', icon: '🎃' },
  { id: 'graduation', name: '卒業角帽', icon: '🎓' },
  { id: 'crystal', name: 'クリスタル王冠', icon: '💎' },
  { id: 'satellite_dish', name: '探査パラボラ', icon: '🛰️' },
  { id: 'angel_wings', name: 'セラフィム翼飾り', icon: '🪽' },
  { id: 'dragon_horns', name: '黒龍の双角', icon: '🐉' },
  { id: 'knight_helm', name: '聖騎士の羽根兜', icon: '🛡️' },
  { id: 'cyber_ears', name: '電脳ネコミミ', icon: '⚡' },
  { id: 'fried_egg', name: '目玉焼き＆パン', icon: '🍳' },
  { id: 'dino_hood', name: 'ティラノフード', icon: '🦖' },
  { id: 'neon_mohawk', name: 'プラズマモヒカン', icon: '🔥' },
  { id: 'alien_buddy', name: '寄生エイリアン', icon: '👾' },
  { id: 'laurel_wreath', name: '黄金の月桂冠', icon: '🌿' }
];

export const ROLES_DEF: Record<string, RoleDef> = {
  crewmate: {
    id: 'crewmate', name: 'CREWMATE', jp: 'クルーメイト', team: 'crew', color: '#38bdf8',
    balance: '標準視界295px / 基本タスク数',
    desc: 'すべての施設タスクを完了するか、緊急会議でインポスターを追放してください！'
  },
  impostor: {
    id: 'impostor', name: 'IMPOSTOR', jp: 'インポスター', team: 'impostor', color: '#f43f5e',
    balance: '広視界410px / 標準キルクール / ベント無制限',
    desc: '妨害工作と隠密キルでクルー陣営を制圧してください！'
  },
  sheriff: {
    id: 'sheriff', name: 'SHERIFF', jp: 'シェリフ', team: 'crew', color: '#facc15',
    balance: '調整: キルCD+3秒 / 悪人(インポスター・ジャッカル・アーソニスト)成敗可',
    desc: 'キルボタンでインポスターやジャッカル・アーソニストを成敗できます。善良なクルーや無害な第三陣営を撃つと自滅します！'
  },
  engineer: {
    id: 'engineer', name: 'ENGINEER', jp: 'エンジニア', team: 'crew', color: '#34d399',
    balance: '調整: ベント潜伏最大12秒制限 / 退出後CD15秒',
    desc: 'ベント（通気口）を使って施設内を素早く移動できる技師です（安全バランス調整のため1回の潜伏は最大12秒まで）！'
  },
  doctor: {
    id: 'doctor', name: 'DOCTOR', jp: 'ドクター', team: 'crew', color: '#60a5fa',
    balance: '調整: 1試合1回蘇生 / 蘇生対象に3秒無敵付与・自身は3.5秒治療硬直',
    desc: '死体の近くで「🩺 蘇生」スキルを使うと、1試合に1回だけ仲間を蘇生できます（蘇生された仲間は3秒間無敵保護）！'
  },
  detective: {
    id: 'detective', name: 'DETECTIVE', jp: '探偵', team: 'crew', color: '#a78bfa',
    balance: '強化: 犯人の服カラー＋殺害経過秒数の両方を特定可能',
    desc: '死体の近くで「🔍 調査」スキルを使うと、犯人の宇宙服カラーと殺害からの経過時間を特定できます！'
  },
  radar: {
    id: 'radar', name: 'RADAR TECH', jp: 'レーダー技師', team: 'crew', color: '#2dd4bf',
    balance: '調整: バッテリー制(最大3回・各6秒間・CD20秒)で全体マップ探知',
    desc: '「📡 レーダー」スキルを起動すると6秒間、全体マップに全生存者の現在位置がリアルタイム表示されます（最大3回）！'
  },
  mayor: {
    id: 'mayor', name: 'MAYOR', jp: 'メイヤー', team: 'crew', color: '#fbbf24',
    balance: '調整: 会議投票2票分 / 代償として個人タスク数+1個',
    desc: '緊急会議での投票が2票分としてカウントされる指導者です（バランス調整のため個人タスクが+1個増えます）！'
  },
  security: {
    id: 'security', name: 'SECURITY', jp: 'セキュリティ', team: 'crew', color: '#38bdf8',
    balance: '新役職: 広視界335px / バリア2回(6秒間キル無効＆速度+15%・CD22秒)',
    desc: '「🛡️ シールド」スキルで6秒間キル攻撃を1回防ぐ個人バリアを展開できます（1試合2回まで・視界も広め）！'
  },
  tracker: {
    id: 'tracker', name: 'TRACKER', jp: 'トラッカー', team: 'crew', color: '#4ade80',
    balance: '新役職: 対象1人に発信機装着(CD20秒) / 全体マップで常時追跡',
    desc: '近くのプレイヤーに「📍 発信機」を取り付けると、全体マップ上でその対象1人の位置を赤いピンで常時追跡できます！'
  },
  teleporter: {
    id: 'teleporter', name: 'TELEPORTER', jp: 'テレポーター', team: 'crew', color: '#818cf8',
    balance: '新役職: 中央緊急テーブルへ即ワープ(最大2回・CD35秒)',
    desc: '「🌀 緊急帰還」スキルでどこにいても中央の緊急テーブルへ瞬時にワープ帰還できます（1試合2回まで）！'
  },
  psychic: {
    id: 'psychic', name: 'PSYCHIC', jp: 'サイキック', team: 'crew', color: '#c084fc',
    balance: '新役職: 霊視パルス5秒間(CD25秒)で未発見死体＆能力残滓を感知',
    desc: '「🔮 霊視パルス」スキルで5秒間、未発見の死体の位置と直近4秒以内に能力・キルが使われた現場の残滓を感知します！'
  },
  phantom: {
    id: 'phantom', name: 'PHANTOM', jp: 'ファントム', team: 'impostor', color: '#fb7185',
    balance: '調整: 透明化6秒(CD22秒) / 透明化中は直接キル不可',
    desc: '「👻 透明化」スキルで6秒間姿を消して移動できるインポスターです（バランス調整のため透明化中はキル不可）！'
  },
  madscientist: {
    id: 'madscientist', name: 'MAD SCIENTIST', jp: 'マッドサイエンティスト', team: 'impostor', color: '#e879f9',
    balance: '強化: タスクなし / ベント無制限＋遠隔「照明停電」妨害が可能',
    desc: 'タスクを持たずベント移動と照明停電妨害でインポスターを支援する狂気の科学者です（キルは不可）！'
  },
  viper: {
    id: 'viper', name: 'VIPER', jp: 'ヴァイパー', team: 'impostor', color: '#f43f5e',
    balance: '新役職: キルした死体が12秒後に完全溶解 / 代償にキルCD+5秒',
    desc: '倒した獲物の死体が12秒後に溶解して消滅する毒殺インポスターです（強力能力のためキルCD+5秒）！'
  },
  shapeshifter: {
    id: 'shapeshifter', name: 'SHAPESHIFTER', jp: 'シェイプシフター', team: 'impostor', color: '#ec4899',
    balance: '新役職: 周囲の生存者へ10秒間変装(CD25秒) / キル時に変装解除',
    desc: '「🎭 変装」スキルで近くの生存者の姿に10秒間なりすまし、別のクルーに濡れ衣を着せられるインポスターです！'
  },
  jester: {
    id: 'jester', name: 'JESTER', jp: 'ジェスター', team: 'neutral', color: '#f472b6',
    balance: '強化: ベント使用可能(退出後CD15秒) / 会議追放で単独勝利',
    desc: '第三陣営：ベントを使ってわざと怪しく振る舞い、緊急会議の投票で自分が追放されると単独勝利します！'
  },
  jackal: {
    id: 'jackal', name: 'JACKAL', jp: 'ジャッカル', team: 'neutral', color: '#fb923c',
    balance: '強化: 広視界385px / キルCD-2秒短縮 / ベント無制限',
    desc: '第三陣営：短縮キルクールとベントを使いこなし、最後の生存者になれば単独勝利します！'
  },
  arsonist: {
    id: 'arsonist', name: 'ARSONIST', jp: 'アーソニスト', team: 'neutral', color: '#f97316',
    balance: '新役職: オイル塗布(CD16秒)→生存者全員塗布後に「一斉点火」で単独勝利',
    desc: '第三陣営：近くの生存者に「🛢️ オイル塗布」を行い、生存者全員に塗り終えて「🔥 一斉点火」すると単独勝利します！'
  },
  survivor: {
    id: 'survivor', name: 'SURVIVOR', jp: 'サバイバー', team: 'neutral', color: '#a3e635',
    balance: '新役職: 防弾ベスト3回(7秒間キル無効・CD20秒) / 決着時生存で追加勝利',
    desc: '第三陣営：キルもタスクも持ちませんが、「🦺 防弾ベスト」で身を守り試合終了時まで生き残れば追加勝者となります！'
  }
};

export const SPECIAL_ROLE_KEYS = [
  'sheriff', 'engineer', 'doctor', 'detective', 'radar', 'mayor',
  'security', 'tracker', 'teleporter', 'psychic',
  'phantom', 'madscientist', 'viper', 'shapeshifter',
  'jester', 'jackal', 'arsonist', 'survivor'
];

export const IMPOSTOR_TEAM_ROLES = ['impostor', 'phantom', 'madscientist', 'viper', 'shapeshifter'];
export const IMPOSTOR_KILL_ROLES = ['impostor', 'phantom', 'viper', 'shapeshifter'];

export const BOT_NAMES = [
  'NOVA', 'ORION', 'VEGA', 'LYRA', 'SIRIUS', 'ALTAIR',
  'RIGEL', 'DENEB', 'ANTARES', 'SPICA', 'PROCYON', 'POLLUX'
];

export const ALL_TASKS: TaskDef[] = [
  { id: 't_wires', name: '配線修理', type: 'wires' },
  { id: 't_code', name: '認証コード入力', type: 'code' },
  { id: 't_freq', name: '通信周波数調整', type: 'freq' },
  { id: 't_download', name: 'データ転送', type: 'download' },
  { id: 't_asteroid', name: '小惑星迎撃スキャン', type: 'asteroid' },
  { id: 't_reactor_align', name: '原子炉パターン起動', type: 'reactor_sim' },
  { id: 't_security_pass', name: 'カードキー認証', type: 'card_swipe' },
  { id: 't_sample_scan', name: '生体サンプル検査', type: 'sample_scan' },
  { id: 't_fuel_engine', name: 'エンジン燃料補給', type: 'hold_gauge' },
  { id: 't_trash_chute', name: 'エアロックゴミ排出', type: 'lever_pull' },
  { id: 't_o2_filter', name: '酸素フィルター清掃', type: 'clean_leaves' },
  { id: 't_shield_prime', name: '偏向シールド充填', type: 'hex_shields' },
  { id: 't_manifold_num', name: '冷却バルブ順序開放', type: 'order_numbers' },
  { id: 't_nav_chart', name: '星図航路ロック', type: 'nav_align' },
  { id: 't_calibrate_dist', name: '配電位相キャリブレーション', type: 'timing_lock' },
  { id: 't_ice_melt', name: '凍結コア除氷レーザー', type: 'thermal_melt', themeTag: '極地・月面専用' },
  { id: 't_pressure_valve', name: '高圧バルブ調圧', type: 'valve_spin', themeTag: '深海・遺跡専用' },
  { id: 't_magma_vent', name: '炉心冷却バランス制御', type: 'temp_balance', themeTag: '溶岩・反物質専用' },
  { id: 't_cyber_decrypt', name: '暗号プロトコル解読', type: 'pair_decrypt', themeTag: '電脳・量子専用' },
  { id: 't_botany_water', name: '共鳴エネルギー給水同調', type: 'crystal_tune', themeTag: '生態・水晶・神殿専用' }
];

export const CREW_PETS: CrewPet[] = [
  { id: 'none', name: 'ペットなし', desc: '同行ペットを連れない' },
  { id: 'mini_crew', name: 'ミニメイト', desc: '同じ宇宙服の小さなお供' },
  { id: 'alien', name: 'ベビーエイリアン', desc: '星雲から来た好奇心旺盛な相棒' },
  { id: 'robot', name: 'ホバーロボ', desc: '浮遊する小型補助ドローン' },
  { id: 'cat_pet', name: '宇宙ネコ', desc: 'ヘルメット付きのスペースキャット' },
  { id: 'dog_pet', name: 'サイバー犬', desc: '忠実な探査ロボドッグ' },
  { id: 'slime', name: 'スタースライム', desc: 'ぷるんと跳ねる発光スライム' },
  { id: 'ufo_pet', name: 'ちびUFO', desc: 'クルーの後ろを追尾するミニ円盤' },
  { id: 'ghost_pet', name: 'コダマゴースト', desc: '小さな守護精霊ユニット' }
];

export const KILL_EFFECTS: KillEffectDef[] = [
  { id: 'classic', name: 'クラシック斬撃', accent: '#f43f5e' },
  { id: 'glitch', name: 'ピクセル崩壊', accent: '#e879f9' },
  { id: 'supernova', name: '超新星バースト', accent: '#fbbf24' },
  { id: 'freeze', name: '氷結粉砕', accent: '#7dd3fc' },
  { id: 'void', name: 'ブラックホール', accent: '#818cf8' },
  { id: 'thunder', name: 'プラズマ落雷', accent: '#22d3ee' }
];

export const QUICK_CHAT_PRESETS: Array<{ id: string; text: string }> = [
  { id: 'qc_where', text: 'どこで発見しましたか？' },
  { id: 'qc_clear', text: '異常なし！タスク中です' },
  { id: 'qc_sus', text: '怪しい動きを見ました' },
  { id: 'qc_skip', text: '情報がないのでスキップ推奨' },
  { id: 'qc_group', text: '一緒に行動しましょう！' },
  { id: 'qc_hi', text: 'よろしくお願いします！' }
];

export const CHAT_STAMPS: ChatStampDef[] = [
  { id: 'stamp_sus', label: 'SUS?!', caption: '怪しい！', bg: '#4c0519', accent: '#fb7185' },
  { id: 'stamp_nice', label: 'NICE!', caption: 'ナイス！', bg: '#064e3b', accent: '#34d399' },
  { id: 'stamp_alibi', label: 'ALIBI', caption: 'アリバイあり', bg: '#0c4a6e', accent: '#38bdf8' },
  { id: 'stamp_help', label: 'HELP!', caption: '救援要請', bg: '#7c2d12', accent: '#fb923c' },
  { id: 'stamp_skip', label: 'SKIP', caption: '様子見', bg: '#1e293b', accent: '#cbd5e1' },
  { id: 'stamp_ok', label: 'ROGER', caption: '了解！', bg: '#3b0764', accent: '#c084fc' }
];

export const DEFAULT_KEYBINDS: Record<string, string> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  use: 'KeyE',
  report: 'KeyR',
  kill: 'KeyQ',
  vent: 'KeyV',
  sabotage: 'KeyF',
  ability: 'KeyC',
  map: 'KeyM'
};

export const KEYBIND_LABELS: Record<string, string> = {
  moveUp: '⬆️ 上へ移動',
  moveDown: '⬇️ 下へ移動',
  moveLeft: '⬅️ 左へ移動',
  moveRight: '➡️ 右へ移動',
  use: '🔧 実行 / 修理 / 緊急ボタン',
  report: '📢 死体通報',
  kill: '🔪 キル / 成敗 / オイル塗布',
  vent: '🕳️ ベント潜伏 / 退出',
  sabotage: '⚡ サボタージュ（妨害）',
  ability: '✨ 特殊能力（蘇生/調査/透明化/イタズラ等）',
  map: '🗺️ 全体マップ表示切替'
};
