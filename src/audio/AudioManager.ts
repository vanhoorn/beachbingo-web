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
  | "bonus"
  | "card_deal"
  | "card_draw"
  | "card_place"
  | "card_knock"
  | "card_select"
  | "card_feuer";

export type TrackId = "strandturm" | "pirates" | "worm" | "menu" | "bingo" | "pong" | "vier";

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

  card_deal: (ctx) => {
    // Soft paper rustle
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5) * 0.5;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3000; f.Q.value = 0.5;
    const g = ctx.createGain();
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    src.start(ctx.currentTime);
  },

  card_draw: (ctx) => {
    // Slide sound
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (i / d.length) * (1 - i / d.length) * 2;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2500; f.Q.value = 0.8;
    const g = ctx.createGain();
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    src.start(ctx.currentTime);
  },

  card_place: (ctx) => {
    // Soft thud on table
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
    // Paper layer
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.3;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g2 = ctx.createGain(); src.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.25, ctx.currentTime); src.start(ctx.currentTime);
  },

  card_knock: (ctx) => {
    // Table knock — two short thumps
    [0, 0.18].forEach(offset => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(160, ctx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + offset + 0.12);
      g.gain.setValueAtTime(0.45, ctx.currentTime + offset);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.14);
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.15);
    });
  },

  card_select: (ctx) => {
    // Soft tick
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.07);
  },

  card_feuer: (ctx) => {
    // Dramatic fanfare — Feuer/Blitz!
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.2);
    });
  },
};

// Note sequences: [frequency_hz, duration_seconds], 0 = rest
type Note = [number, number];

type TrackConfig = {
  notes: Note[];
  wave: OscillatorType;
  gain: number;
  bass?: { notes: Note[]; wave: OscillatorType; gain: number };
};

const TRACKS: Record<TrackId, TrackConfig> = {
  strandturm: {
    notes: [
      [659, 0.125], [784, 0.125], [659, 0.125], [784, 0.125],
      [659, 0.125], [587, 0.125], [659, 0.25],
      [0, 0.125],
      [523, 0.125], [659, 0.125], [784, 0.125], [523, 0.25],
      [0, 0.375],
      [440, 0.125], [523, 0.125], [659, 0.125], [440, 0.125],
      [392, 0.125], [440, 0.125], [494, 0.125], [0, 0.125],
      [523, 0.375], [0, 0.125],
      [392, 0.125], [440, 0.125], [494, 0.125], [523, 0.125],
      [587, 0.125], [659, 0.25],  [0, 0.125],
      [784, 0.125], [659, 0.125], [587, 0.125], [523, 0.125],
      [494, 0.125], [440, 0.25],  [0, 0.25],
    ],
    wave: "square",
    gain: 0.07,
    bass: {
      notes: [
        [130, 0.5], [0, 0.5], [146, 0.5], [0, 0.5],
        [130, 0.5], [0, 0.5], [130, 1.0],
      ],
      wave: "triangle",
      gain: 0.04,
    },
  },

  pirates: {
    notes: [
      [440, 0.15], [392, 0.15], [349, 0.15], [329, 0.3], [0, 0.15],
      [392, 0.15], [440, 0.15], [494, 0.15], [523, 0.3], [0, 0.15],
      [440, 0.15], [392, 0.15], [349, 0.15], [294, 0.15], [261, 0.45], [0, 0.15],
    ],
    wave: "square",
    gain: 0.07,
  },

  worm: {
    notes: [
      [329, 0.1], [370, 0.1], [392, 0.1], [440, 0.1],
      [392, 0.1], [370, 0.1], [329, 0.2], [0, 0.1],
      [261, 0.1], [293, 0.1], [329, 0.1], [349, 0.1],
      [392, 0.2], [0, 0.3],
    ],
    wave: "square",
    gain: 0.07,
  },

  menu: {
    notes: [
      [523, 0.2], [440, 0.2], [392, 0.2], [349, 0.4], [0, 0.2],
      [392, 0.2], [440, 0.2], [494, 0.2], [523, 0.4], [0, 0.4],
    ],
    wave: "square",
    gain: 0.07,
  },

  // Caribbean Calypso, F major, ~96 BPM — steel drum feel (sine melody + triangle bass)
  bingo: {
    notes: [
      [0, 0.31], [440, 0.31], [0, 0.31], [523.25, 0.63], [466.16, 0.31], [440, 0.63],
      [392, 0.31], [440, 0.31], [392, 0.63], [349.23, 1.25], [0, 0.31],
      [440, 0.31], [466.16, 0.31], [523.25, 0.63], [466.16, 0.31], [523.25, 0.31], [466.16, 0.63],
      [440, 0.31], [392, 0.31], [349.23, 1.88], [0, 0.63],
      [0, 0.31], [698.46, 0.31], [659.25, 0.31], [587.33, 0.31], [698.46, 0.63], [0, 0.31], [587.33, 0.31],
      [523.25, 0.31], [0, 0.31], [466.16, 0.63], [0, 0.31], [523.25, 0.31], [466.16, 0.63],
      [523.25, 0.31], [466.16, 0.31], [440, 0.31], [392, 0.31], [440, 0.31], [392, 0.31], [349.23, 0.63],
      [440, 0.31], [392, 0.31], [349.23, 2.5], [0, 0.63],
    ],
    wave: "sine",
    gain: 0.055,
    bass: {
      notes: [
        [174.61, 0.63], [0, 0.31], [130.81, 0.31], [174.61, 0.63], [0, 0.63],
        [196, 0.63], [0, 0.63], [174.61, 0.63], [0, 0.63],
        [174.61, 0.63], [0, 0.31], [233.08, 0.31], [174.61, 0.63], [220, 0.63], [0, 0.63],
        [130.81, 0.63], [0, 0.63], [174.61, 0.63], [130.81, 1.88], [0, 0.63],
        [174.61, 0.31], [0, 0.31], [174.61, 0.31], [0, 0.31], [174.61, 0.63], [0, 0.63],
        [233.08, 0.63], [220, 0.63], [196, 0.63], [0, 0.63],
        [174.61, 0.63], [0, 0.63], [196, 0.63], [0, 0.63],
        [130.81, 0.63], [174.61, 0.63], [130.81, 2.5], [0, 0.63],
      ],
      wave: "triangle",
      gain: 0.035,
    },
  },

  // Electronic Synthwave, D minor, ~128 BPM — driving arpeggios (square melody + square bass)
  pong: {
    notes: [
      [293.66, 0.23], [440, 0.23], [523.25, 0.23], [587.33, 0.23], [523.25, 0.47], [0, 0.23], [587.33, 0.23],
      [523.25, 0.23], [0, 0.23], [440, 0.47], [0, 0.23], [392, 0.23], [349.23, 0.47], [0, 0.23],
      [587.33, 0.23], [0, 0.23], [523.25, 0.47], [0, 0.23], [440, 0.47], [0, 0.23], [392, 0.23],
      [349.23, 0.23], [0, 0.23], [440, 0.23], [349.23, 0.47], [293.66, 0.47], [0, 0.47],
      [0, 0.23], [523.25, 0.23], [0, 0.23], [587.33, 0.47], [0, 0.23], [523.25, 0.23], [440, 0.23],
      [0, 0.23], [440, 0.23], [0, 0.23], [392, 0.47], [349.23, 0.47], [0, 0.47],
      [349.23, 0.23], [392, 0.23], [440, 0.23], [523.25, 0.23], [587.33, 0.23], [659.25, 0.23], [587.33, 0.47],
      [523.25, 0.23], [440, 0.23], [392, 0.23], [349.23, 0.23], [293.66, 0.94], [0, 0.47],
    ],
    wave: "square",
    gain: 0.055,
    bass: {
      notes: [
        [293.66, 0.23], [0, 0.23], [293.66, 0.47], [0, 0.23], [220, 0.47], [0, 0.23],
        [174.61, 0.23], [0, 0.23], [174.61, 0.47], [0, 0.23], [261.63, 0.47], [0, 0.23],
        [196, 0.23], [0, 0.23], [196, 0.47], [0, 0.23], [196, 0.47], [0, 0.23],
        [130.81, 0.47], [0, 0.23], [220, 0.47], [0, 0.23], [146.83, 0.47], [0, 0.23],
        [293.66, 0.23], [0, 0.23], [293.66, 0.47], [0, 0.23], [220, 0.47], [0, 0.23],
        [174.61, 0.23], [0, 0.23], [174.61, 0.47], [0, 0.23], [261.63, 0.47], [0, 0.23],
        [196, 0.23], [0, 0.23], [196, 0.23], [146.83, 0.23], [196, 0.23], [220, 0.23], [196, 0.47],
        [73.42, 0.94], [0, 0.47], [73.42, 0.47], [0, 0.47],
      ],
      wave: "square",
      gain: 0.035,
    },
  },

  // German folk / Wirtshaus, G major, ~104 BPM — singable melody (triangle + sine bass)
  vier: {
    notes: [
      [392, 0.58], [440, 0.29], [493.88, 0.29], [523.25, 0.58], [0, 0.58],
      [587.33, 0.29], [523.25, 0.29], [493.88, 0.58], [0, 0.29], [440, 0.29], [440, 0.58],
      [392, 0.29], [440, 0.29], [493.88, 0.58], [523.25, 0.29], [493.88, 0.29], [440, 0.58],
      [392, 1.15], [0, 0.58], [392, 0.58],
      [440, 0.29], [493.88, 0.29], [523.25, 0.29], [587.33, 0.29], [659.25, 0.58], [0, 0.58],
      [587.33, 0.29], [523.25, 0.29], [493.88, 0.58], [440, 0.29], [493.88, 0.29], [392, 0.58],
      [659.25, 0.29], [0, 0.29], [784, 0.29], [0, 0.29], [659.25, 0.29], [587.33, 0.29], [523.25, 0.58],
      [523.25, 0.29], [493.88, 0.29], [440, 0.29], [392, 0.29], [440, 0.58], [0, 0.29],
      [493.88, 0.58], [440, 0.58], [392, 1.15], [0, 1.15],
    ],
    wave: "triangle",
    gain: 0.06,
    bass: {
      notes: [
        [196, 0.58], [0, 0.58], [196, 0.58], [0, 0.58],
        [146.83, 0.58], [0, 0.58], [146.83, 0.58], [0, 0.58],
        [196, 0.58], [0, 0.29], [196, 0.29], [0, 0.29], [220, 0.29], [196, 0.58],
        [98, 1.15], [0, 0.58], [98, 0.58],
        [220, 0.58], [0, 0.58], [220, 0.58], [0, 0.58],
        [146.83, 0.58], [0, 0.58], [164.81, 0.58], [0, 0.58],
        [196, 0.29], [0, 0.29], [196, 0.29], [0, 0.29], [196, 0.58], [0, 0.58],
        [146.83, 0.29], [0, 0.29], [130.81, 0.29], [0, 0.29], [146.83, 0.29], [164.81, 0.29], [196, 0.58],
        [98, 1.15], [0, 1.15],
      ],
      wave: "sine",
      gain: 0.04,
    },
  },
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
      this.loopTimeoutId = setTimeout(() => this._loop(track), (duration - 0.05) * 1000);
    } catch { /* AudioContext unavailable */ }
  }

  private _schedule(ctx: AudioContext, track: TrackId): number {
    const config = TRACKS[track];
    const newOscs: OscillatorNode[] = [];
    let t = ctx.currentTime;

    for (const [freq, dur] of config.notes) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = config.wave;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(config.gain, t);
        g.gain.setValueAtTime(config.gain * 0.79, t + dur * 0.75);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
        newOscs.push(osc);
      }
      t += dur;
    }

    if (config.bass) {
      const bass = config.bass;
      let bt = ctx.currentTime;
      for (const [freq, dur] of bass.notes) {
        if (freq > 0) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.type = bass.wave;
          osc.frequency.value = freq;
          g.gain.setValueAtTime(bass.gain, bt);
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
