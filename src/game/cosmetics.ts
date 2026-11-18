import { CREW_COLORS } from './constants';

const hatThumbnailCache = new Map<string, string>();

/**
 * クルーメイトの頭に装着する40種類の高品質装飾品（シェーディング・ハイライト・微細ディテール・アニメーション対応）
 */
export function drawHat(
  ctx: CanvasRenderingContext2D,
  hatId: string,
  bodyHex: string,
  nowMs = 0
) {
  if (!hatId || hatId === 'none') return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 2.1;

  const pulse = Math.sin(nowMs * 0.005);
  const floatY = Math.sin(nowMs * 0.004) * 1.4;

  switch (hatId) {
    case 'crown': {
      const grad = ctx.createLinearGradient(0, -37, 0, -21);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.55, '#facc15');
      grad.addColorStop(1, '#ca8a04');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-12, -21);
      ctx.lineTo(-13, -34);
      ctx.lineTo(-5, -27);
      ctx.lineTo(0, -37);
      ctx.lineTo(5, -27);
      ctx.lineTo(13, -34);
      ctx.lineTo(12, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 下部ベロア帯と宝石
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(-10.5, -24.5, 21, 3.2);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -28.5, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-7.5, -27.5, 1.7, 0, Math.PI * 2);
      ctx.arc(7.5, -27.5, 1.7, 0, Math.PI * 2);
      ctx.fill();
      // 王冠先端の丸玉
      ctx.fillStyle = '#fef9c3';
      for (const [px, py] of [[-13, -34], [0, -37], [13, -34]]) {
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'cat': {
      // 外耳
      ctx.fillStyle = bodyHex;
      ctx.beginPath();
      ctx.moveTo(-13, -18);
      ctx.lineTo(-10, -35);
      ctx.lineTo(-1, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(1, -22);
      ctx.lineTo(10, -35);
      ctx.lineTo(13, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 内耳ピンク＋フサ毛
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.moveTo(-10.5, -21);
      ctx.lineTo(-9, -31.5);
      ctx.lineTo(-3.5, -23);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(3.5, -23);
      ctx.lineTo(9, -31.5);
      ctx.lineTo(10.5, -21);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'halo': {
      const hy = -32 + floatY * 0.8;
      ctx.save();
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.38 + 0.16 * pulse})`;
      ctx.lineWidth = 6.5;
      ctx.beginPath();
      ctx.ellipse(0, hy, 14, 4.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, hy, 14, 4.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-2, hy - 0.8, 7, 1.6, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'sprout': {
      const sway = Math.sin(nowMs * 0.004) * 1.6;
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.quadraticCurveTo(sway * 0.6, -28, sway, -34);
      ctx.stroke();

      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(sway - 6.5, -34, 6.2, 3.3, -0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(sway + 6.5, -34, 6.2, 3.3, 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 葉脈ハイライト
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(sway - 2, -33.5);
      ctx.lineTo(sway - 9.5, -35);
      ctx.moveTo(sway + 2, -33.5);
      ctx.lineTo(sway + 9.5, -35);
      ctx.stroke();
      break;
    }

    case 'antenna': {
      // 台座
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-7, -25, 14, 5, 2.5);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -37);
      ctx.stroke();

      // 電波リング
      if (pulse > 0) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${pulse * 0.65})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -39, 7 + pulse * 3, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.fillStyle = pulse > 0 ? '#7dd3fc' : '#0284c7';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -39, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'devil': {
      const grad = ctx.createLinearGradient(0, -37, 0, -20);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.5, '#dc2626');
      grad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = grad;

      // 左角（湾曲）
      ctx.beginPath();
      ctx.moveTo(-11, -20);
      ctx.quadraticCurveTo(-17, -29, -12, -37);
      ctx.quadraticCurveTo(-8, -28, -3, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 右角（湾曲）
      ctx.beginPath();
      ctx.moveTo(11, -20);
      ctx.quadraticCurveTo(17, -29, 12, -37);
      ctx.quadraticCurveTo(8, -28, 3, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // リッジ光沢
      ctx.strokeStyle = 'rgba(254, 202, 202, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-11, -25);
      ctx.quadraticCurveTo(-13, -30, -11.5, -34);
      ctx.moveTo(11, -25);
      ctx.quadraticCurveTo(13, -30, 11.5, -34);
      ctx.stroke();
      break;
    }

    case 'cap': {
      const capGrad = ctx.createLinearGradient(-12, -33, 12, -20);
      capGrad.addColorStop(0, '#3b82f6');
      capGrad.addColorStop(1, '#1d4ed8');
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.arc(0, -20, 13.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // クラウンステッチ＆天ボタン
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(0, -34, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // ツバ
      ctx.fillStyle = '#1e40af';
      ctx.beginPath();
      ctx.roundRect(1, -23.5, 16.5, 4.6, 2.3);
      ctx.fill();
      ctx.stroke();

      // 前面エンブレム
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(6.5, -26.5, 2.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'party': {
      const pGrad = ctx.createLinearGradient(-10, -21, 10, -39);
      pGrad.addColorStop(0, '#ec4899');
      pGrad.addColorStop(0.5, '#a855f7');
      pGrad.addColorStop(1, '#f43f5e');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.moveTo(-10.5, -21);
      ctx.lineTo(0, -40);
      ctx.lineTo(10.5, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 斜めストライプ
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-6, -24);
      ctx.lineTo(4, -30);
      ctx.moveTo(-3.5, -31);
      ctx.lineTo(2, -34.5);
      ctx.stroke();

      // ポンポン
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -41, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'tophat': {
      // 本体シルク質感
      const hatGrad = ctx.createLinearGradient(-10, -41, 10, -23);
      hatGrad.addColorStop(0, '#334155');
      hatGrad.addColorStop(0.55, '#1e293b');
      hatGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = hatGrad;
      ctx.beginPath();
      ctx.roundRect(-10, -41, 20, 17, [4, 4, 1, 1]);
      ctx.fill();
      ctx.stroke();

      // リボン帯
      ctx.fillStyle = '#e11d48';
      ctx.fillRect(-9.5, -29, 19, 3.8);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(3, -29, 3.5, 3.8);

      // ツバ
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-15, -25.5, 30, 4.2, 2.1);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'viking': {
      const steel = ctx.createLinearGradient(-13, -34, 13, -20);
      steel.addColorStop(0, '#94a3b8');
      steel.addColorStop(0.5, '#64748b');
      steel.addColorStop(1, '#334155');
      ctx.fillStyle = steel;
      ctx.beginPath();
      ctx.arc(0, -20.5, 13.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 真鍮リムバンド
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.roundRect(-14, -23.5, 28, 4, 2);
      ctx.fill();
      ctx.stroke();

      // 左右の象牙ホーン
      const hornGrad = ctx.createLinearGradient(0, -40, 0, -24);
      hornGrad.addColorStop(0, '#ffffff');
      hornGrad.addColorStop(1, '#fde68a');
      ctx.fillStyle = hornGrad;
      ctx.beginPath();
      ctx.moveTo(-11.5, -23.5);
      ctx.quadraticCurveTo(-22, -29, -17, -39);
      ctx.quadraticCurveTo(-13, -32, -9, -26.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(11.5, -23.5);
      ctx.quadraticCurveTo(22, -29, 17, -39);
      ctx.quadraticCurveTo(13, -32, 9, -26.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'bunny': {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(-5.5, -34, 4.2, 12, -0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(5.5, -34, 4.2, 12, 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(-5.5, -34, 2.0, 8.2, -0.14, 0, Math.PI * 2);
      ctx.ellipse(5.5, -34, 2.0, 8.2, 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'chef': {
      ctx.fillStyle = '#f1f5f9';
      // 膨らみコック帽本体
      ctx.beginPath();
      ctx.arc(-7.5, -32, 6.2, 0, Math.PI * 2);
      ctx.arc(0, -34.5, 7.8, 0, Math.PI * 2);
      ctx.arc(7.5, -32, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 内部塗りつぶし補強
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10, -33, 20, 9);

      // プリーツ線
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-4, -31);
      ctx.lineTo(-4, -26);
      ctx.moveTo(0, -32);
      ctx.lineTo(0, -26);
      ctx.moveTo(4, -31);
      ctx.lineTo(4, -26);
      ctx.stroke();

      // バンド
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(-10.5, -26.5, 21, 5.5, 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'pirate': {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-17.5, -21);
      ctx.quadraticCurveTo(-10, -39, 0, -36);
      ctx.quadraticCurveTo(10, -39, 17.5, -21);
      ctx.quadraticCurveTo(0, -24.5, -17.5, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // ゴールド縁取り
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-15.5, -22.5);
      ctx.quadraticCurveTo(0, -37.5, 15.5, -22.5);
      ctx.stroke();

      // スカル章
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, -28.5, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-2, -26.5, 4, 2);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-1.5, -29, 1, 1);
      ctx.fillRect(0.6, -29, 1, 1);
      break;
    }

    case 'headphones': {
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 6.2;
      ctx.beginPath();
      ctx.arc(0, -13, 15.8, Math.PI * 1.05, Math.PI * -0.05);
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, -13, 15.8, Math.PI * 1.05, Math.PI * -0.05);
      ctx.stroke();

      // イヤーカップ＋発光リング
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-18.5, -17, 6.5, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(12, -17, 6.5, 12, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(-16.5, -14.5, 2.2, 7);
      ctx.fillRect(14.3, -14.5, 2.2, 7);
      break;
    }

    case 'flower': {
      // 葉
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(13, -21, 5, 2.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 花びら5枚グラデーション風
      for (let a = 0; a < 5; a++) {
        const ang = (a / 5) * Math.PI * 2 - 0.3;
        ctx.fillStyle = a % 2 === 0 ? '#fb7185' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(9 + Math.cos(ang) * 4.5, -24 + Math.sin(ang) * 4.5, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(9, -24, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'wizard': {
      const wGrad = ctx.createLinearGradient(-15, -22, 6, -42);
      wGrad.addColorStop(0, '#5b21b6');
      wGrad.addColorStop(0.6, '#7c3aed');
      wGrad.addColorStop(1, '#312e81');
      ctx.fillStyle = wGrad;
      ctx.beginPath();
      ctx.moveTo(-12, -23);
      ctx.quadraticCurveTo(-4, -36, 4, -43);
      ctx.quadraticCurveTo(7, -33, 12, -23);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 広ツバ
      ctx.fillStyle = '#4c1d95';
      ctx.beginPath();
      ctx.ellipse(0, -22, 16.5, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 金帯と星マーク
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-10.5, -25, 21, 2.6);
      ctx.beginPath();
      ctx.arc(1.5, -32.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-3, -28.5, 1.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'cowboy': {
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(0, -22, 18.5, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(-10, -22.5);
      ctx.lineTo(-8, -33.5);
      ctx.quadraticCurveTo(-3, -31.5, 0, -33);
      ctx.quadraticCurveTo(3, -31.5, 8, -33.5);
      ctx.lineTo(10, -22.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // レザーベルト＆真鍮バックル
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-9.5, -25.5, 19, 3.2);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(2, -26, 4, 4);
      break;
    }

    case 'ribbon': {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(0, -24.5);
      ctx.lineTo(-12.5, -33);
      ctx.quadraticCurveTo(-14, -25, -12, -18.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -24.5);
      ctx.lineTo(12.5, -33);
      ctx.quadraticCurveTo(14, -25, 12, -18.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 内側折り目
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(0, -24.5, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'ufo': {
      const uy = -31 + floatY;
      // 淡いトラクタービーム光線
      ctx.save();
      const beam = ctx.createLinearGradient(0, uy + 2, 0, -16);
      beam.addColorStop(0, `rgba(56, 189, 248, ${0.32 + 0.1 * pulse})`);
      beam.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-6, uy + 2);
      ctx.lineTo(-11, -16);
      ctx.lineTo(11, -16);
      ctx.lineTo(6, uy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 円盤金属体
      const uGrad = ctx.createLinearGradient(-14, uy, 14, uy);
      uGrad.addColorStop(0, '#64748b');
      uGrad.addColorStop(0.5, '#cbd5e1');
      uGrad.addColorStop(1, '#475569');
      ctx.fillStyle = uGrad;
      ctx.beginPath();
      ctx.ellipse(0, uy, 14.5, 4.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // ガラスドーム
      ctx.fillStyle = 'rgba(125, 211, 252, 0.88)';
      ctx.beginPath();
      ctx.arc(0, uy - 1.5, 6.8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // ドームランプ
      ctx.fillStyle = pulse > 0 ? '#fde047' : '#38bdf8';
      for (const lx of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.arc(lx, uy + 0.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'samurai': {
      // 吹き返し＆鉢
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.arc(0, -20.5, 13.8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // しころ（防具プレート）
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.roundRect(-15.5, -22.5, 31, 4.5, 2);
      ctx.fill();
      ctx.stroke();

      // 金の鍬形（クワガタ）
      const gold = ctx.createLinearGradient(0, -40, 0, -24);
      gold.addColorStop(0, '#fef08a');
      gold.addColorStop(1, '#d97706');
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.moveTo(0, -25.5);
      ctx.lineTo(-13.5, -40);
      ctx.lineTo(-6, -34);
      ctx.lineTo(-2.5, -28);
      ctx.lineTo(2.5, -28);
      ctx.lineTo(6, -34);
      ctx.lineTo(13.5, -40);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -26, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'ninja': {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-13.5, -23.5, 27, 7, 2);
      ctx.fill();
      ctx.stroke();

      // なびく帯紐
      ctx.beginPath();
      ctx.moveTo(-13, -21);
      ctx.lineTo(-20, -25);
      ctx.lineTo(-18, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 額当て金属プレート＋紋章
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.roundRect(-7, -22.5, 14, 5, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -20, 1.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'visor_hud': {
      // ツルとホログラムゴーグル
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-10, -16.5, 12, 3);
      const vGrad = ctx.createLinearGradient(-1, -17.5, 18.5, -10.5);
      vGrad.addColorStop(0, 'rgba(34, 211, 238, 0.92)');
      vGrad.addColorStop(1, 'rgba(56, 189, 248, 0.55)');
      ctx.fillStyle = vGrad;
      ctx.strokeStyle = '#cffafe';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-1, -17.5, 19.5, 7.2, 2.5);
      ctx.fill();
      ctx.stroke();

      // 走査線ハイライト
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, -15);
      ctx.lineTo(14, -15);
      ctx.stroke();
      break;
    }

    case 'captain': {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, -27.5, 15, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(-11.5, -24, 23, 5, 2);
      ctx.fill();
      ctx.stroke();

      // ツバ
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.roundRect(1, -21.5, 14, 3.2, 1.5);
      ctx.fill();
      ctx.stroke();

      // 金章・ウイング紋
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(2, -27.5, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-3.5, -28, 11, 1.3);
      break;
    }

    case 'bear': {
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(-9.5, -24.5, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(9.5, -24.5, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(-9.5, -24.5, 3.1, 0, Math.PI * 2);
      ctx.arc(9.5, -24.5, 3.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'fox_mask': {
      // 斜め掛けのキツネお面
      ctx.save();
      ctx.translate(2, -26);
      ctx.rotate(0.14);
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.lineTo(-8, -11.5);
      ctx.lineTo(-2.5, -5.5);
      ctx.lineTo(2.5, -5.5);
      ctx.lineTo(8, -11.5);
      ctx.lineTo(10, -2);
      ctx.quadraticCurveTo(0, 7.5, -10, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 朱の隈取りと狐目
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-7.5, -9);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-3.5, -4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7.5, -9);
      ctx.lineTo(6, -4);
      ctx.lineTo(3.5, -4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5.5, -1.5);
      ctx.lineTo(-2, -0.5);
      ctx.moveTo(5.5, -1.5);
      ctx.lineTo(2, -0.5);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'goggles': {
      // レザーベルト
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect(-14, -25, 28, 5.2, 2);
      ctx.fill();
      ctx.stroke();

      // 真鍮フレーム＋ブルーレンズ
      for (const lx of [-3.5, 6.5]) {
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(lx, -22.5, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(lx, -22.5, 3.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.arc(lx - 1.2, -23.8, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'pumpkin': {
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.ellipse(0, -26.5, 13.5, 8.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // かぼちゃ筋
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, -26.5, 6, 8.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // ヘタと光るジャック・オー・ランタン顔
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.roundRect(-2.5, -39, 5, 5.5, 1.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-5, -28); ctx.lineTo(-2, -28); ctx.lineTo(-3.5, -30.5); ctx.closePath();
      ctx.moveTo(2, -28); ctx.lineTo(5, -28); ctx.lineTo(3.5, -30.5); ctx.closePath();
      ctx.fill();
      ctx.fillRect(-5, -24, 10, 2);
      break;
    }

    case 'graduation': {
      // 土台キャップ
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-9, -27, 18, 6);
      ctx.strokeRect(-9, -27, 18, 6);

      // ボード
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, -36);
      ctx.lineTo(17.5, -29);
      ctx.lineTo(0, -22);
      ctx.lineTo(-17.5, -29);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 金タッセル
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -29);
      ctx.lineTo(13, -27.5);
      ctx.lineTo(14.5, -19.5);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -29, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'crystal': {
      const cGrad = ctx.createLinearGradient(0, -39, 0, -21);
      cGrad.addColorStop(0, '#cffafe');
      cGrad.addColorStop(0.5, '#22d3ee');
      cGrad.addColorStop(1, '#0e7490');
      ctx.fillStyle = cGrad;

      // 多面結晶群
      ctx.beginPath();
      ctx.moveTo(-9, -21);
      ctx.lineTo(-11, -33);
      ctx.lineTo(-5, -28);
      ctx.lineTo(-1, -40);
      ctx.lineTo(4, -29);
      ctx.lineTo(10.5, -35);
      ctx.lineTo(9, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // ファセットハイライト線
      ctx.strokeStyle = '#ecfeff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-1, -39);
      ctx.lineTo(-1, -22);
      ctx.moveTo(9, -34);
      ctx.lineTo(5, -22);
      ctx.stroke();
      break;
    }

    case 'satellite_dish': {
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, -32, 11.5, 0.15, Math.PI - 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(0, -40);
      ctx.stroke();

      ctx.fillStyle = pulse > 0 ? '#fda4af' : '#e11d48';
      ctx.beginPath();
      ctx.arc(0, -40.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'angel_wings': {
      const wy = floatY * 1.1;
      ctx.fillStyle = '#ffffff';
      // 左翼3段フェザー
      ctx.beginPath();
      ctx.ellipse(-16, -21 + wy, 9.5, 4.2, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-14.5, -16 + wy, 7.5, 3.2, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 右翼3段フェザー
      ctx.beginPath();
      ctx.ellipse(16, -21 + wy, 9.5, 4.2, 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(14.5, -16 + wy, 7.5, 3.2, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 中央金の紋章
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -23, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dragon_horns': {
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(-10, -21);
      ctx.quadraticCurveTo(-20, -34, -8.5, -42);
      ctx.quadraticCurveTo(-11, -32, -4, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(10, -21);
      ctx.quadraticCurveTo(20, -34, 8.5, -42);
      ctx.quadraticCurveTo(11, -32, 4, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 溶岩ルーンライン
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-9, -24);
      ctx.quadraticCurveTo(-13, -32, -9.5, -38);
      ctx.moveTo(9, -24);
      ctx.quadraticCurveTo(13, -32, 9.5, -38);
      ctx.stroke();
      break;
    }

    case 'knight_helm': {
      // 羽根飾り（後ろ）
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.moveTo(-3, -34);
      ctx.quadraticCurveTo(-14, -44, -18, -32);
      ctx.quadraticCurveTo(-10, -31, -2, -31);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 鋼鉄兜
      const kGrad = ctx.createLinearGradient(-13, -34, 13, -20);
      kGrad.addColorStop(0, '#cbd5e1');
      kGrad.addColorStop(0.55, '#94a3b8');
      kGrad.addColorStop(1, '#475569');
      ctx.fillStyle = kGrad;
      ctx.beginPath();
      ctx.arc(0, -20.5, 13.8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // スリットバイザー金縁
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-10, -23.5, 20, 2.5);
      break;
    }

    case 'cyber_ears': {
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-12, -20);
      ctx.lineTo(-9, -36.5);
      ctx.lineTo(-2, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(2, -22);
      ctx.lineTo(9, -36.5);
      ctx.lineTo(12, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 内側ネオン回路
      ctx.fillStyle = pulse > 0 ? '#7dd3fc' : '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(-9.5, -22);
      ctx.lineTo(-8.5, -31);
      ctx.lineTo(-4.5, -23);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(4.5, -23);
      ctx.lineTo(8.5, -31);
      ctx.lineTo(9.5, -22);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'fried_egg': {
      // トースト土台
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.roundRect(-12, -24, 24, 5, 2);
      ctx.fill();
      ctx.stroke();

      // 白身波型
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -24.5, 12.5, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 黄身＋ツヤ
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(1, -25.5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-0.5, -27, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dino_hood': {
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(0, -21, 13.8, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 背びれトゲ
      ctx.fillStyle = '#facc15';
      for (const [sx, sy] of [[-5, -34], [1, -36], [7, -33]]) {
        ctx.beginPath();
        ctx.moveTo(sx - 3, sy + 3);
        ctx.lineTo(sx, sy - 4);
        ctx.lineTo(sx + 3, sy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    case 'neon_mohawk': {
      const mGrad = ctx.createLinearGradient(0, -41, 0, -21);
      mGrad.addColorStop(0, '#fef08a');
      mGrad.addColorStop(0.4, '#f43f5e');
      mGrad.addColorStop(1, '#9f1239');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.moveTo(-7, -21);
      ctx.lineTo(-9, -35);
      ctx.lineTo(-4, -32);
      ctx.lineTo(-1, -41);
      ctx.lineTo(3, -33);
      ctx.lineTo(8, -38);
      ctx.lineTo(7, -21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'alien_buddy': {
      const ay = -28 + floatY * 0.7;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(0, ay, 10, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 触角
      ctx.strokeStyle = '#16a34a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, ay - 6);
      ctx.lineTo(-6, ay - 12);
      ctx.moveTo(4, ay - 6);
      ctx.lineTo(6, ay - 12);
      ctx.stroke();
      ctx.fillStyle = '#bef264';
      ctx.beginPath();
      ctx.arc(-6, ay - 12.5, 2, 0, Math.PI * 2);
      ctx.arc(6, ay - 12.5, 2, 0, Math.PI * 2);
      ctx.fill();

      // 3つ目
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(-4, ay, 1.8, 0, Math.PI * 2);
      ctx.arc(0, ay - 2.2, 2.1, 0, Math.PI * 2);
      ctx.arc(4, ay, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'laurel_wreath': {
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, -21, 13.5, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= 6; i++) {
        const ang = Math.PI * (1.12 + i * 0.125);
        const lx = Math.cos(ang) * 14;
        const ly = -21 + Math.sin(ang) * 14;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 4.2, 2.2, ang + 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

/**
 * タイトル画面・ロビーの帽子セレクター用に高精細プレビュー画像（DataURL）を生成＆キャッシュ
 */
export function getHatThumbnailUrl(hatId: string): string {
  if (typeof document === 'undefined') return '';
  const cached = hatThumbnailCache.get(hatId);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 微細なステージスポットライト背景
  const bg = ctx.createRadialGradient(32, 30, 4, 32, 32, 30);
  bg.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
  bg.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 64, 64);

  if (hatId === 'none') {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(21, 43);
    ctx.lineTo(43, 21);
    ctx.stroke();
  } else {
    // 頭頂シルエットを薄く敷いて装着イメージを分かりやすくする
    ctx.save();
    ctx.translate(32, 54);
    ctx.scale(1.22, 1.22);

    const previewColor = CREW_COLORS[1].hex;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -13, 13.5, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    drawHat(ctx, hatId, previewColor, 0);
    ctx.restore();
  }

  const url = canvas.toDataURL('image/png');
  hatThumbnailCache.set(hatId, url);
  return url;
}

const petThumbnailCache = new Map<string, string>();

export interface KillEffectBurst {
  id: string;
  x: number;
  y: number;
  effectId: string;
  colorHex: string;
  startedAt: number;
  durationMs: number;
}

/**
 * プレイヤーの背後についてくるミニペットの高精細Canvas描画
 */
export function drawPetSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  petId: string,
  suitColorId: string,
  facing = 1,
  isWalking = false,
  nowMs = 0
) {
  if (!petId || petId === 'none') return;
  const cObj = CREW_COLORS.find((c) => c.id === suitColorId) || CREW_COLORS[0];
  const bob = isWalking ? Math.abs(Math.sin(nowMs * 0.015)) * 4.2 : Math.sin(nowMs * 0.005) * 1.6;
  const hover = Math.sin(nowMs * 0.006) * 3.5;

  ctx.save();
  ctx.translate(x, y);

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 10.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(facing, 1);

  switch (petId) {
    case 'mini_crew': {
      ctx.translate(0, -bob);
      ctx.fillStyle = cObj.dark;
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-10.5, -5, 5, 11, 2.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = cObj.hex;
      ctx.beginPath();
      ctx.roundRect(-7, -11, 14, 18, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillRect(-6, 5, 4.5, 5.5);
      ctx.strokeRect(-6, 5, 4.5, 5.5);
      ctx.fillRect(1.5, 5, 4.5, 5.5);
      ctx.strokeRect(1.5, 5, 4.5, 5.5);

      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.roundRect(-1, -7, 9, 5.5, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(4.5, -5.5, 2.4, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'alien': {
      ctx.translate(0, -bob);
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.8;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Antenna
      ctx.strokeStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, -16);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -17, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // 3 eyes
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(-3.2, -2, 1.5, 0, Math.PI * 2);
      ctx.arc(1.2, -3.8, 1.8, 0, Math.PI * 2);
      ctx.arc(4.8, -1.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'robot': {
      ctx.translate(0, -4 + hover);
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-9.5, -9, 19, 15, 5);
      ctx.fill();
      ctx.stroke();

      // Screen face
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.roundRect(-6.5, -6, 13, 8.5, 3);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-3.5, -3.5, 2.5, 3.5);
      ctx.fillRect(2, -3.5, 2.5, 3.5);

      // Jet flame
      ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.lineTo(0, 12 + (hover > 0 ? 2 : 0));
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'cat_pet': {
      ctx.translate(0, -bob);
      ctx.fillStyle = '#fb923c';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      // Ears
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.lineTo(-9, -13);
      ctx.lineTo(-2, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(8, -13);
      ctx.lineTo(7, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Body/Head
      ctx.beginPath();
      ctx.ellipse(0, 0, 9.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Helmet ring
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -1, 11.2, 0, Math.PI * 2);
      ctx.stroke();

      // Cute eyes
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(-2, -1, 1.5, 0, Math.PI * 2);
      ctx.arc(4.5, -1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'dog_pet': {
      ctx.translate(0, -bob);
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.8;
      // Body
      ctx.beginPath();
      ctx.roundRect(-10, -2, 18, 10, 4);
      ctx.fill();
      ctx.stroke();
      // Head
      ctx.beginPath();
      ctx.roundRect(0, -11, 11, 10, 4);
      ctx.fill();
      ctx.stroke();
      // Floppy ear
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect(-1, -10, 4, 7, 2);
      ctx.fill();
      ctx.stroke();
      // Eye + nose
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(6.5, -7, 1.4, 0, Math.PI * 2);
      ctx.arc(10.5, -4.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'slime': {
      const squash = Math.sin(nowMs * 0.01) * 1.4;
      ctx.translate(0, -bob);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.strokeStyle = '#083344';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 2, 10.5 + squash, 8.5 - squash * 0.5, 0, Math.PI, 0);
      ctx.lineTo(10.5 + squash, 7);
      ctx.quadraticCurveTo(0, 10, -10.5 - squash, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(-2, 0, 1.4, 0, Math.PI * 2);
      ctx.arc(4, 0, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-4.5, -3.5, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'ufo_pet': {
      ctx.translate(0, -6 + hover);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.82)';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -3, 6.5, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(0, -1, 13, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = Math.floor(nowMs / 220) % 2 === 0 ? '#facc15' : '#38bdf8';
      for (const lx of [-7, 0, 7]) {
        ctx.beginPath();
        ctx.arc(lx, -1, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'ghost_pet': {
      ctx.translate(0, -5 + hover);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.88)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -3, 8.5, Math.PI, 0);
      ctx.lineTo(8.5, 7);
      ctx.lineTo(4, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-8.5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#312e81';
      ctx.beginPath();
      ctx.arc(-2.5, -3, 1.5, 0, Math.PI * 2);
      ctx.arc(3.5, -3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    default:
      break;
  }

  ctx.restore();
}

/**
 * ロビー＆タイトル画面用ペットプレビュー画像（DataURL）生成
 */
export function getPetThumbnailUrl(petId: string, suitColorId = 'cyan'): string {
  if (typeof document === 'undefined') return '';
  const cacheKey = `${petId}_${petId === 'mini_crew' ? suitColorId : 'std'}`;
  const cached = petThumbnailCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bg = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  bg.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  bg.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 64, 64);

  if (petId === 'none') {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(21, 43);
    ctx.lineTo(43, 21);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(32, 36);
    ctx.scale(1.55, 1.55);
    drawPetSprite(ctx, 0, 0, petId, suitColorId, 1, false, 0);
    ctx.restore();
  }

  const url = canvas.toDataURL('image/png');
  petThumbnailCache.set(cacheKey, url);
  return url;
}

/**
 * 特殊キル・やられエフェクト描画（Canvas2Dワールド座標）
 */
export function drawKillEffectBurst(
  ctx: CanvasRenderingContext2D,
  burst: KillEffectBurst,
  nowMs: number
) {
  const t = Math.max(0, Math.min(1, (nowMs - burst.startedAt) / burst.durationMs));
  if (t >= 1) return;
  const inv = 1 - t;

  ctx.save();
  ctx.translate(burst.x, burst.y);
  ctx.globalAlpha = inv;

  if (burst.effectId === 'glitch') {
    // デジタルピクセル崩壊
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + (i % 2) * 0.4;
      const dist = 12 + t * (45 + (i % 4) * 14);
      const px = Math.cos(ang) * dist;
      const py = Math.sin(ang) * dist;
      ctx.fillStyle = i % 3 === 0 ? '#e879f9' : i % 3 === 1 ? '#22d3ee' : burst.colorHex;
      ctx.fillRect(px - 4, py - 4, 8 * inv + 2, 8 * inv + 2);
    }
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-22 - t * 20, -22 - t * 20, 44 + t * 40, 44 + t * 40);
  } else if (burst.effectId === 'supernova') {
    // 超新星バースト
    const rad = 16 + t * 72;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, rad);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#fbbf24');
    grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t * 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      ctx.lineTo(Math.cos(a) * (24 + t * 56), Math.sin(a) * (24 + t * 56));
      ctx.stroke();
    }
  } else if (burst.effectId === 'freeze') {
    // 氷結クリスタル粉砕
    ctx.strokeStyle = '#bae6fd';
    ctx.fillStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = 10 + t * 54;
      ctx.save();
      ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
      ctx.rotate(a + t * 3);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (burst.effectId === 'void') {
    // ブラックホール渦崩壊
    const outerR = Math.max(4, 58 * (1 - t * 0.65));
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, outerR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    for (let s = 0; s < 3; s++) {
      const startA = t * 9 + (s * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, startA, startA + 1.4);
      ctx.stroke();
    }
  } else if (burst.effectId === 'thunder') {
    // プラズマ落雷スラッシュ
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2 + 0.3;
      const r1 = 18 + t * 20;
      const r2 = 38 + t * 42;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a + 0.25) * r1, Math.sin(a + 0.25) * r1);
      ctx.lineTo(Math.cos(a - 0.15) * r2, Math.sin(a - 0.15) * r2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + t * 48, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // classic 斬撃＆ショックウェーブ
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 5 * inv + 1;
    ctx.beginPath();
    ctx.moveTo(-30 - t * 18, -26 - t * 18);
    ctx.lineTo(30 + t * 18, 26 + t * 18);
    ctx.moveTo(30 + t * 18, -26 - t * 18);
    ctx.lineTo(-30 - t * 18, 26 + t * 18);
    ctx.stroke();

    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + t * 44, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
