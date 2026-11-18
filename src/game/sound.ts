export class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  public init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public playTone(freq: number, type: OscillatorType, duration: number, vol = 0.14, delay = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  public playClick() {
    this.playTone(640, 'sine', 0.08, 0.1);
  }

  public playKeypadBeep(freq = 740) {
    this.playTone(freq, 'triangle', 0.075, 0.11);
  }

  public playWireConnect() {
    this.playTone(540, 'triangle', 0.07, 0.12, 0);
    this.playTone(810, 'sine', 0.09, 0.12, 0.045);
  }

  public playLaserShot() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playCardSwipe(ok: boolean) {
    if (ok) {
      this.playTone(587.33, 'sine', 0.09, 0.13, 0);
      this.playTone(880, 'triangle', 0.16, 0.15, 0.07);
    } else {
      this.playErrorBuzz();
    }
  }

  public playErrorBuzz() {
    this.playTone(210, 'sawtooth', 0.11, 0.12, 0);
    this.playTone(165, 'sawtooth', 0.14, 0.12, 0.11);
  }

  public playTaskVerifying() {
    this.playTone(480, 'sine', 0.06, 0.08, 0);
    this.playTone(620, 'sine', 0.07, 0.09, 0.12);
    this.playTone(760, 'sine', 0.08, 0.1, 0.24);
  }

  public playTaskDone() {
    this.playTone(523.25, 'triangle', 0.12, 0.15, 0);
    this.playTone(659.25, 'triangle', 0.12, 0.15, 0.08);
    this.playTone(783.99, 'triangle', 0.14, 0.16, 0.16);
    this.playTone(1046.5, 'sine', 0.34, 0.2, 0.24);
  }

  public playKill() {
    this.playTone(180, 'sawtooth', 0.16, 0.22, 0);
    this.playTone(95, 'sawtooth', 0.28, 0.25, 0.08);
  }

  public playShieldBlock() {
    this.playTone(440, 'sine', 0.1, 0.18, 0);
    this.playTone(880, 'triangle', 0.2, 0.2, 0.06);
  }

  public playAlarm() {
    this.playTone(880, 'square', 0.18, 0.16, 0);
    this.playTone(620, 'square', 0.18, 0.16, 0.2);
    this.playTone(880, 'square', 0.22, 0.16, 0.4);
  }

  public playVent() {
    this.playTone(260, 'sine', 0.15, 0.14, 0);
    this.playTone(140, 'sine', 0.18, 0.14, 0.08);
  }

  public playDoor() {
    this.playTone(190, 'square', 0.12, 0.12, 0);
    this.playTone(120, 'triangle', 0.18, 0.14, 0.07);
  }

  public playVote() {
    this.playTone(480, 'sine', 0.12, 0.12);
  }

  public playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.playTone(f, 'triangle', 0.28, 0.16, i * 0.11));
  }

  public playLose() {
    [329.63, 293.66, 246.94, 174.61].forEach((f, i) => this.playTone(f, 'sawtooth', 0.34, 0.15, i * 0.14));
  }

  public playRoleReveal(team: 'crew' | 'impostor' | 'neutral') {
    if (team === 'impostor') {
      this.playTone(92, 'sawtooth', 0.55, 0.22, 0);
      this.playTone(138.59, 'sawtooth', 0.48, 0.16, 0.04);
      this.playTone(185, 'triangle', 0.4, 0.14, 0.12);
    } else if (team === 'neutral') {
      this.playTone(110, 'triangle', 0.45, 0.18, 0);
      this.playTone(164.81, 'sine', 0.42, 0.16, 0.08);
      this.playTone(233.08, 'triangle', 0.4, 0.15, 0.16);
    } else {
      this.playTone(261.63, 'sine', 0.35, 0.16, 0);
      this.playTone(392.0, 'triangle', 0.42, 0.16, 0.07);
      this.playTone(523.25, 'sine', 0.48, 0.15, 0.14);
    }
  }

  public playBodyReport() {
    this.playTone(146.83, 'sawtooth', 0.36, 0.24, 0);
    this.playTone(73.42, 'sawtooth', 0.5, 0.24, 0.02);
    this.playTone(880, 'square', 0.16, 0.14, 0.1);
    this.playTone(698.46, 'square', 0.22, 0.14, 0.28);
  }

  public playEject() {
    this.playTone(320, 'sine', 0.22, 0.14, 0);
    this.playTone(220, 'triangle', 0.35, 0.12, 0.14);
    this.playTone(130, 'sine', 0.55, 0.1, 0.32);
  }

  public playSabotageTrigger() {
    this.playTone(520, 'sawtooth', 0.14, 0.14, 0);
    this.playTone(410, 'sawtooth', 0.18, 0.14, 0.16);
  }

  public playGhostHaunt() {
    this.playTone(340, 'sine', 0.2, 0.14, 0);
    this.playTone(255, 'triangle', 0.28, 0.14, 0.08);
    this.playTone(190, 'sine', 0.36, 0.12, 0.18);
  }
}

export const sound = new SoundEngine();
