/**
 * Syntetizované zvuky přes WebAudio – žádné soubory ke stažení.
 * Kontext se vytvoří až po interakci uživatele (omezení mobilních prohlížečů).
 * Vlastní nahrávky lze později vložit do public/assets/sounds a přehrávat zde.
 */
export type SfxName =
  | 'click'
  | 'select'
  | 'attack'
  | 'blocked'
  | 'shield'
  | 'water'
  | 'yelp'
  | 'shiver'
  | 'angry'
  | 'relief'
  | 'pop'
  | 'restore'
  | 'vacuum'
  | 'bump'
  | 'blare'
  | 'static'
  | 'jingle'
  | 'data'
  | 'rumble'
  | 'splash'
  | 'slip'
  | 'chime'
  | 'laugh'
  | 'creak'
  | 'beep'
  | 'buzz';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  sfxOn = true;
  private musicOn = false;
  private musicTimer: number | null = null;
  private noiseBuf: AudioBuffer | null = null;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; slide?: number; delay?: number } = {}) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, freq: number, vol = 0.15, q = 1, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    g.gain.setValueAtTime(vol, t + Math.max(0.09, dur - 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.sfxOn || !this.ctx) return;
    switch (name) {
      case 'click':
        this.tone(1400, 0.05, { type: 'square', vol: 0.05 });
        break;
      case 'select':
        this.tone(660, 0.08, { vol: 0.12 });
        this.tone(990, 0.1, { vol: 0.1, delay: 0.05 });
        break;
      case 'pop':
        this.tone(500, 0.12, { vol: 0.15, slide: 2.2 });
        break;
      case 'attack':
        this.tone(220, 0.18, { type: 'sawtooth', vol: 0.08, slide: 0.5 });
        this.tone(880, 0.06, { type: 'square', vol: 0.05, delay: 0.05 });
        this.tone(660, 0.06, { type: 'square', vol: 0.05, delay: 0.12 });
        break;
      case 'blocked':
        this.tone(300, 0.15, { type: 'triangle', vol: 0.15, slide: 0.6 });
        this.tone(520, 0.25, { type: 'sine', vol: 0.15, delay: 0.12 });
        break;
      case 'shield':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { vol: 0.1, delay: i * 0.08 }));
        break;
      case 'restore':
        this.tone(440, 0.15, { vol: 0.1, slide: 1.5 });
        break;
      case 'water':
        this.noise(2.6, 3000, 0.07, 0.6);
        break;
      case 'yelp':
        this.tone(700, 0.25, { type: 'triangle', vol: 0.18, slide: 1.8 });
        break;
      case 'shiver':
        for (let i = 0; i < 6; i++) this.tone(180 + (i % 2) * 40, 0.05, { type: 'square', vol: 0.04, delay: i * 0.07 });
        break;
      case 'angry':
        this.tone(160, 0.25, { type: 'sawtooth', vol: 0.07, slide: 0.8 });
        break;
      case 'relief':
        this.tone(392, 0.2, { vol: 0.12 });
        this.tone(523, 0.35, { vol: 0.12, delay: 0.12 });
        break;
      case 'vacuum':
        this.noise(1.6, 900, 0.05, 0.8);
        this.tone(140, 1.5, { type: 'sawtooth', vol: 0.025, slide: 1.3 });
        break;
      case 'bump':
        this.tone(130, 0.14, { type: 'triangle', vol: 0.22, slide: 0.6 });
        this.noise(0.18, 400, 0.08, 1.5);
        break;
      case 'blare':
        [220, 277, 330, 440].forEach((f, i) => this.tone(f, 1.1, { type: 'sawtooth', vol: 0.05, delay: i * 0.01 }));
        this.noise(1.1, 1800, 0.06, 0.5);
        break;
      case 'static':
        this.noise(0.9, 4200, 0.07, 0.3);
        break;
      case 'jingle':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, { type: 'square', vol: 0.045, delay: i * 0.09 }));
        break;
      case 'data':
        for (let i = 0; i < 8; i++) this.tone(1200 + Math.random() * 1400, 0.04, { type: 'square', vol: 0.03, delay: i * 0.06 });
        break;
      case 'rumble':
        this.noise(2.4, 160, 0.14, 2);
        this.tone(55, 2.3, { type: 'sawtooth', vol: 0.04 });
        break;
      case 'splash':
        this.noise(0.9, 1800, 0.12, 0.7);
        this.tone(500, 0.3, { vol: 0.06, slide: 0.4 });
        break;
      case 'slip':
        this.tone(620, 0.28, { type: 'triangle', vol: 0.14, slide: 0.25 });
        this.tone(85, 0.22, { type: 'sine', vol: 0.3, delay: 0.3, slide: 0.7 });
        this.noise(0.2, 300, 0.1, 1.2, 0.3);
        break;
      case 'chime':
        this.tone(880, 0.18, { vol: 0.1 });
        this.tone(1320, 0.3, { vol: 0.08, delay: 0.1 });
        break;
      case 'laugh':
        for (let i = 0; i < 5; i++) this.tone(320 - i * 22, 0.16, { type: 'triangle', vol: 0.11, delay: i * 0.2, slide: 0.85 });
        break;
      case 'creak':
        this.tone(95, 0.9, { type: 'sawtooth', vol: 0.04, slide: 1.6 });
        this.noise(0.9, 700, 0.03, 4);
        break;
      case 'beep':
        this.tone(1800, 0.06, { type: 'square', vol: 0.05 });
        this.tone(1800, 0.06, { type: 'square', vol: 0.05, delay: 0.1 });
        break;
      case 'buzz':
        this.tone(140, 0.35, { type: 'square', vol: 0.06 });
        break;
    }
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    const chords = [[0, 2, 4], [3, 5, 0], [4, 6, 2], [2, 4, 6]];
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      const chord = chords[Math.floor(step / 8) % chords.length];
      const idx = chord[step % 3] + (step % 4 === 3 ? 1 : 0);
      const f = scale[idx % scale.length] * (step % 8 < 4 ? 1 : 0.5);
      this.tone(f, 0.9, { type: 'triangle', vol: 0.035 });
      if (step % 8 === 0) this.tone(scale[chord[0]] / 2, 2.2, { vol: 0.03 });
      step++;
    }, 420);
  }

  private stopMusic() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new AudioEngine();
