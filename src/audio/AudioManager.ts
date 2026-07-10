// Central audio system — one instance shared across all games.
// Games call audioManager.playSound(id) and audioManager.startMusic(track).
// Global toggles (soundEnabled / musicEnabled) live in Firestore users/{uid}
// and are loaded once at login by App.tsx via setSound() / setMusic().

export type SoundId =
  | "jump"
  | "land"
  | "climb"
  | "coconut_bounce"
  | "hit"
  | "life_lost"
  | "level_complete"
  | "game_over"
  | "timer_tick"
  | "bonus";

export type TrackId = "strandturm" | "pirates" | "worm" | "menu";

type SoundDef = (ctx: AudioContext) => void;

const SOUNDS: Record<SoundId, SoundDef> = {
  jump: (ctx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
  },

  land: (ctx) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.6;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 250;
    const g = ctx.createGain();
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    src.start(ctx.currentTime);
  },

  climb: (ctx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 900;
    g.gain.setValueAtTime(0.07, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.04);
  },

  coconut_bounce: (ctx) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.28, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.22);
  },

  hit: (ctx) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.35), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf; src.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.45, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    src.start(ctx.currentTime);

    const osc = ctx.createOscillator(); const g2 = ctx.createGain();
    osc.connect(g2); g2.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.5);
    g2.gain.setValueAtTime(0.25, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  },

  life_lost: (ctx) => {
    [400, 350, 300, 220].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
    });
  },

  level_complete: (ctx) => {
    [261, 329, 392, 523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
    });
  },

  game_over: (ctx) => {
    [440, 392, 349, 294, 261, 196].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t); osc.stop(t + 0.22);
    });
  },

  timer_tick: (ctx) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 1400;
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
  },

  bonus: (ctx) => {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.07;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    });
  },
};

// Note sequences: [frequency_hz, duration_seconds], 0 = rest
type Note = [number, number];

const MELODIES: Record<TrackId, Note[]> = {
  strandturm: [
    // Melody: upbeat beach platformer chiptune (C major, ~120bpm)
    [659, 0.125], [784, 0.125], [659, 0.125], [784, 0.125],
    [659, 0.125], [587, 0.125], [659, 0.25],
    [0, 0.125],
    [523, 0.125], [659, 0.125], [784, 0.125], [523, 0.25],
    [0, 0.375],
    [440, 0.125], [523, 0.125], [659, 0.125], [440, 0.125],
    [392, 0.125], [440, 0.125], [494, 0.125], [0, 0.125],
    [523, 0.375], [0, 0.125],
    // Bridge
    [392, 0.125], [440, 0.125], [494, 0.125], [523, 0.125],
    [587, 0.125], [659, 0.25],  [0, 0.125],
    [784, 0.125], [659, 0.125], [587, 0.125], [523, 0.125],
    [494, 0.125], [440, 0.25],  [0, 0.25],
  ],
  pirates: [
    [440, 0.15], [392, 0.15], [349, 0.15], [329, 0.3], [0, 0.15],
    [392, 0.15], [440, 0.15], [494, 0.15], [523, 0.3], [0, 0.15],
    [440, 0.15], [392, 0.15], [349, 0.15], [294, 0.15], [261, 0.45], [0, 0.15],
  ],
  worm: [
    [329, 0.1], [370, 0.1], [392, 0.1], [440, 0.1],
    [392, 0.1], [370, 0.1], [329, 0.2], [0, 0.1],
    [261, 0.1], [293, 0.1], [329, 0.1], [349, 0.1],
    [392, 0.2], [0, 0.3],
  ],
  menu: [
    [523, 0.2], [440, 0.2], [392, 0.2], [349, 0.4], [0, 0.2],
    [392, 0.2], [440, 0.2], [494, 0.2], [523, 0.4], [0, 0.4],
  ],
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private activeOscs: OscillatorNode[] = [];
  private loopTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentTrack: TrackId | null = null;

  soundEnabled = true;
  musicEnabled = true;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setSound(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusic();
    else if (this.currentTrack) this.startMusic(this.currentTrack);
  }

  playSound(id: SoundId) {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getCtx();
      SOUNDS[id](ctx);
    } catch { /* autoplay policy or suspended */ }
  }

  startMusic(track: TrackId) {
    this.currentTrack = track;
    if (!this.musicEnabled) return;
    this.stopMusic();
    this._loop(track);
  }

  stopMusic() {
    if (this.loopTimeoutId !== null) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    const t = this.ctx?.currentTime ?? 0;
    this.activeOscs.forEach((o) => { try { o.stop(t); } catch { /* already stopped */ } });
    this.activeOscs = [];
  }

  private _loop(track: TrackId) {
    if (!this.musicEnabled) return;
    try {
      const ctx = this.getCtx();
      const duration = this._schedule(ctx, track);
      // Restart 50ms before end to avoid gaps
      this.loopTimeoutId = setTimeout(() => this._loop(track), (duration - 0.05) * 1000);
    } catch { /* AudioContext unavailable */ }
  }

  private _schedule(ctx: AudioContext, track: TrackId): number {
    const notes = MELODIES[track];
    let t = ctx.currentTime;
    const newOscs: OscillatorNode[] = [];

    for (const [freq, dur] of notes) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.07, t);
        g.gain.setValueAtTime(0.055, t + dur * 0.75);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
        newOscs.push(osc);
      }
      t += dur;
    }

    // Also schedule simple bass (octave below melody root notes)
    if (track === "strandturm") {
      const bass: Note[] = [
        [130, 0.5], [0, 0.5], [146, 0.5], [0, 0.5],
        [130, 0.5], [0, 0.5], [130, 1.0],
      ];
      let bt = ctx.currentTime;
      for (const [freq, dur] of bass) {
        if (freq > 0) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.type = "triangle"; osc.frequency.value = freq;
          g.gain.setValueAtTime(0.04, bt);
          g.gain.exponentialRampToValueAtTime(0.001, bt + dur);
          osc.start(bt); osc.stop(bt + dur);
          newOscs.push(osc);
        }
        bt += dur;
      }
    }

    this.activeOscs = [...this.activeOscs, ...newOscs];
    return t - ctx.currentTime;
  }
}

export const audioManager = new AudioManager();
