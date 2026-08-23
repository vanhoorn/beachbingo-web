// Central audio system — one instance shared across all games.
// Music: Howler.js loads /audio/music/{trackId}.mp3 (or .ogg).
//   If the file is missing, falls back automatically to Web Audio API synthesis.
// SFX:  Web Audio API synthesis (instant, no files needed).
// Drop real audio files into /public/audio/music/ to activate Howler playback.

import { Howl } from "howler";

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
  | "card_feuer"
  | "card_shuffle"
  | "pair_discard"
  | "turn_ping"
  | "sp_gameover"
  // Sonnenrad
  | "sr_reveal"
  | "sr_step_up"
  | "sr_secure"
  | "sr_tick";

export type TrackId = "strandturm" | "pirates" | "worm" | "menu" | "bingo" | "pong" | "vier" | "brandung" | "strandraeuber" | "mahjong" | "meermau" | "sonnenrad" | "perlentaucher" | "raetsel" | "kuestenkrieg" | "klontausch";

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
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.3;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g2 = ctx.createGain(); src.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.25, ctx.currentTime); src.start(ctx.currentTime);
  },

  card_knock: (ctx) => {
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
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.07);
  },

  card_feuer: (ctx) => {
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

  card_shuffle: (ctx) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.4;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain();
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    src.start(ctx.currentTime);
  },

  pair_discard: (ctx) => {
    [523, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "triangle"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t); osc.stop(t + 0.35);
    });
  },

  turn_ping: (ctx) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
  },

  sp_gameover: (ctx) => {
    [440, 392, 349, 294, 261, 196, 146].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "square"; osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.22);
    });
  },

  // ── Sonnenrad ──────────────────────────────────────────────────────────────
  sr_reveal: (ctx) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 660;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.10);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.10);
  },

  sr_step_up: (ctx) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 784;
    g.gain.setValueAtTime(0.20, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
  },

  sr_secure: (ctx) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 988;
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.20);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.20);
  },

  sr_tick: (ctx) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = "square"; osc.frequency.value = 440;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
  },
};

// ── Synthesis fallback tracks ─────────────────────────────────────────────────
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

  brandung: {
    notes: [
      [659, 0.31], [587, 0.31], [523, 0.63], [440, 0.63], [0, 0.31],
      [440, 0.31], [494, 0.31], [523, 0.31], [587, 0.63], [0, 0.31],
      [659, 0.63], [587, 0.31], [523, 0.31], [494, 0.63], [440, 0.31], [0, 0.31],
      [440, 1.25], [0, 0.63],
      [698, 0.31], [659, 0.31], [587, 0.31], [523, 0.31], [494, 0.63], [0, 0.31],
      [523, 0.31], [587, 0.31], [659, 0.63], [587, 0.31], [0, 0.31],
      [440, 0.31], [494, 0.31], [523, 0.31], [659, 0.31], [587, 0.63], [523, 0.31], [0, 0.31],
      [440, 1.88], [0, 0.63],
    ],
    wave: "sine",
    gain: 0.055,
    bass: {
      notes: [
        [110, 0.63], [0, 0.31], [110, 0.31], [0, 0.31], [130, 0.63], [0, 0.63],
        [110, 0.63], [0, 0.31], [98, 0.31], [0, 0.31], [82, 0.63], [0, 0.63],
        [110, 1.25], [0, 0.63],
        [147, 0.63], [0, 0.31], [130, 0.31], [0, 0.31], [147, 0.63], [0, 0.31],
        [165, 0.31], [0, 0.31], [110, 0.63], [0, 0.31], [110, 0.31], [0, 0.31],
        [110, 1.88], [0, 0.63],
      ],
      wave: "triangle",
      gain: 0.035,
    },
  },

  strandraeuber: {
    notes: [
      [440, 0.14], [0, 0.09], [466, 0.14], [0, 0.09], [440, 0.14], [0, 0.09], [415, 0.14], [0, 0.09],
      [440, 0.28], [0, 0.18],
      [392, 0.14], [0, 0.09], [349, 0.14], [0, 0.09], [330, 0.14], [0, 0.09],
      [349, 0.14], [0, 0.09], [392, 0.28], [0, 0.18],
      [440, 0.14], [0, 0.09], [523, 0.14], [0, 0.09], [494, 0.14], [0, 0.09], [466, 0.28], [0, 0.18],
      [440, 0.14], [0, 0.09], [415, 0.14], [0, 0.09], [392, 0.14], [0, 0.09], [349, 0.56], [0, 0.28],
      [330, 0.14], [0, 0.09], [349, 0.14], [0, 0.09], [370, 0.14], [0, 0.09], [392, 0.14], [0, 0.09],
      [415, 0.14], [0, 0.09], [440, 0.42], [0, 0.28],
    ],
    wave: "triangle",
    gain: 0.045,
    bass: {
      notes: [
        [110, 0.56], [0, 0.28], [165, 0.28], [0, 0.28],
        [130, 0.28], [0, 0.28], [146, 0.28], [0, 0.28],
        [110, 0.56], [0, 0.28], [98,  0.28], [0, 0.28],
        [82,  0.28], [0, 0.28], [110, 0.84], [0, 0.28],
        [147, 0.56], [0, 0.28], [165, 0.28], [0, 0.28],
        [130, 0.28], [0, 0.28], [117, 0.28], [0, 0.28],
        [110, 0.84], [0, 0.28],
        [98,  0.28], [0, 0.28], [110, 0.28], [0, 0.28],
        [82,  0.56], [0, 0.56],
      ],
      wave: "sine",
      gain: 0.030,
    },
  },

  mahjong: {
    notes: [
      [392, 0.38], [440, 0.38], [523, 0.75], [440, 0.38], [0, 0.38],
      [392, 0.38], [329, 0.38], [392, 0.75], [0, 0.75],
      [440, 0.38], [523, 0.38], [587, 0.75], [523, 0.38], [440, 0.38],
      [392, 1.50], [0, 0.38],
      [523, 0.38], [440, 0.38], [392, 0.38], [329, 0.38], [293, 0.75], [0, 0.38],
      [329, 0.38], [392, 0.38], [440, 0.38], [392, 0.38], [329, 0.75], [0, 0.38],
      [261, 0.38], [293, 0.38], [329, 0.38], [392, 0.38], [440, 0.38], [392, 0.38], [329, 0.75],
      [261, 1.50], [0, 0.75],
    ],
    wave: "sine",
    gain: 0.05,
    bass: {
      notes: [
        [130, 0.75], [0, 0.38], [196, 0.38], [0, 0.75],
        [130, 0.75], [0, 0.38], [110, 0.38], [0, 0.75],
        [130, 0.75], [0, 0.38], [146, 0.38], [0, 0.75],
        [130, 1.50], [0, 0.75],
        [130, 0.75], [0, 0.38], [196, 0.38], [0, 0.75],
        [98, 0.75], [0, 0.38], [110, 0.38], [0, 0.75],
        [130, 0.75], [0, 0.38], [98, 0.38], [0, 0.75],
        [130, 1.50], [0, 0.75],
      ],
      wave: "triangle",
      gain: 0.03,
    },
  },

  // ── Neue Tracks (Stufe A) ────────────────────────────────────────────────

  // MeerMau — Fröhlicher Kartenspiel-Marsch in C-Dur, ~88 BPM
  meermau: {
    notes: [
      [659, 0.25], [659, 0.25], [587, 0.25], [523, 0.25],
      [587, 0.50], [0, 0.25],
      [659, 0.25], [784, 0.25], [784, 0.25],
      [880, 0.50], [0, 0.25],
      [784, 0.25], [698, 0.25], [659, 0.25], [587, 0.25],
      [659, 0.75], [0, 0.25],
      [523, 0.25], [659, 0.25], [784, 0.25],
      [784, 0.75], [0, 0.50],
      [880, 0.25], [784, 0.25], [698, 0.25], [659, 0.25],
      [587, 0.50], [0, 0.25],
      [523, 0.25], [659, 0.25], [784, 0.25],
      [698, 0.25], [659, 0.25], [523, 0.75], [0, 0.50],
    ] as [number, number][],
    wave: "sine" as OscillatorType,
    gain: 0.042,
    bass: {
      notes: [
        [130, 0.50], [0, 0.25], [196, 0.50], [0, 0.25],
        [130, 0.50], [0, 0.25],
        [130, 0.50], [0, 0.25], [196, 0.50], [0, 0.25],
        [147, 0.50], [0, 0.25], [165, 0.50], [0, 0.25],
        [130, 0.75], [0, 0.25],
        [130, 0.50], [0, 0.25], [130, 0.75], [0, 0.50],
        [165, 0.50], [0, 0.25], [196, 0.50], [0, 0.25],
        [130, 0.50], [0, 0.25],
        [130, 0.50], [0, 0.25], [196, 0.50], [0, 0.25],
        [147, 0.75], [0, 0.25], [130, 1.00], [0, 0.50],
      ] as [number, number][],
      wave: "triangle" as OscillatorType,
      gain: 0.026,
    },
  },

  // Sonnenrad — Festliche Tages-Fanfare in C-Dur, ~112 BPM
  sonnenrad: {
    notes: [
      [523, 0.14], [659, 0.14], [784, 0.27], [659, 0.14], [0, 0.14],
      [784, 0.14], [880, 0.14], [784, 0.27], [0, 0.27],
      [659, 0.14], [698, 0.14], [784, 0.27], [659, 0.14], [523, 0.14],
      [587, 0.27], [523, 0.54], [0, 0.27],
      [880, 0.14], [784, 0.14], [698, 0.14], [659, 0.14],
      [784, 0.27], [0, 0.27],
      [659, 0.14], [587, 0.14], [523, 0.14], [440, 0.14],
      [523, 0.54], [0, 0.27],
    ] as [number, number][],
    wave: "sine" as OscillatorType,
    gain: 0.035,
    bass: {
      notes: [
        [131, 0.27], [0, 0.27], [196, 0.27], [0, 0.27],
        [131, 0.27], [0, 0.27], [175, 0.27], [0, 0.27],
        [131, 0.27], [0, 0.27], [196, 0.27], [0, 0.27],
        [131, 0.54], [0, 0.54],
        [131, 0.27], [0, 0.27], [165, 0.27], [0, 0.27],
        [147, 0.27], [0, 0.27], [131, 0.27], [0, 0.27],
        [131, 0.27], [0, 0.27], [196, 0.27], [0, 0.27],
        [131, 0.81], [0, 0.27],
      ] as [number, number][],
      wave: "triangle" as OscillatorType,
      gain: 0.022,
    },
  },

  // Perlentaucher — Ozeanisches Match-3-Thema, ~100 BPM
  perlentaucher: {
    notes: [
      [523, 0.30], [659, 0.15], [784, 0.45], [659, 0.30], [523, 0.30], [0, 0.30],
      [392, 0.30], [523, 0.15], [659, 0.45], [523, 0.30], [392, 0.30], [0, 0.30],
      [440, 0.30], [554, 0.15], [659, 0.45], [784, 0.30], [659, 0.30], [0, 0.30],
      [523, 0.60], [392, 0.60], [0, 0.60],
      [330, 0.30], [440, 0.30], [523, 0.30], [659, 0.30], [784, 0.60], [0, 0.30],
      [659, 0.30], [523, 0.30], [440, 0.30], [392, 0.30], [330, 0.60], [0, 0.30],
      [523, 0.30], [659, 0.30], [784, 0.30], [1047, 0.60], [784, 0.30], [0, 0.30],
      [659, 0.45], [523, 0.45], [392, 0.90], [0, 0.60],
    ] as [number, number][],
    wave: "sine" as OscillatorType,
    gain: 0.030,
    bass: {
      notes: [
        [130, 0.60], [0, 0.30], [196, 0.30], [0, 0.60],
        [98,  0.60], [0, 0.30], [130, 0.30], [0, 0.60],
        [110, 0.60], [0, 0.30], [146, 0.30], [0, 0.60],
        [130, 1.20], [0, 0.60],
        [130, 0.60], [0, 0.30], [164, 0.30], [0, 0.60],
        [98,  0.60], [0, 0.30], [130, 0.30], [0, 0.60],
        [110, 0.60], [0, 0.30], [130, 0.30], [0, 0.60],
        [130, 1.50], [0, 0.60],
      ] as [number, number][],
      wave: "triangle" as OscillatorType,
      gain: 0.022,
    },
  },

  // Rätsel — Ruhige Fokus-Melodie in G-Dur, ~72 BPM
  raetsel: {
    notes: [
      [392, 0.42], [440, 0.42], [523, 0.84], [0, 0.42],
      [494, 0.42], [440, 0.42], [392, 0.84], [0, 0.42],
      [523, 0.42], [587, 0.42], [659, 0.84], [0, 0.42],
      [587, 0.42], [523, 0.42], [440, 0.84], [0, 0.42],
      [392, 0.42], [440, 0.42], [494, 0.42], [523, 0.42],
      [587, 0.84], [0, 0.42],
      [392, 0.42], [440, 0.42], [392, 1.26], [0, 0.84],
    ] as [number, number][],
    wave: "sine" as OscillatorType,
    gain: 0.028,
    bass: {
      notes: [
        [196, 0.84], [0, 0.42], [247, 0.42], [0, 0.42],
        [196, 0.84], [0, 0.42],
        [147, 0.84], [0, 0.42], [196, 0.42], [0, 0.42],
        [196, 0.84], [0, 0.42],
        [131, 0.84], [0, 0.42], [196, 0.42], [0, 0.42],
        [147, 0.84], [0, 0.42],
        [196, 1.68], [0, 0.84],
      ] as [number, number][],
      wave: "triangle" as OscillatorType,
      gain: 0.018,
    },
  },

  // Küstenkrieg — Seemanns-Marsch in D-Moll, ~80 BPM
  kuestenkrieg: {
    notes: [
      [294, 0.19], [0, 0.09], [330, 0.19], [0, 0.09],
      [349, 0.38], [0, 0.19],
      [392, 0.38], [440, 0.38], [0, 0.19],
      [466, 0.19], [0, 0.09], [440, 0.19], [0, 0.09],
      [392, 0.38], [0, 0.19],
      [349, 0.38], [330, 0.19], [294, 0.57], [0, 0.28],
      [523, 0.19], [0, 0.09], [494, 0.19], [0, 0.09],
      [466, 0.38], [0, 0.19],
      [440, 0.38], [392, 0.38], [0, 0.19],
      [349, 0.19], [0, 0.09], [392, 0.19], [0, 0.09],
      [440, 0.38], [0, 0.19],
      [392, 0.19], [349, 0.19], [294, 0.75], [0, 0.38],
    ] as [number, number][],
    wave: "triangle" as OscillatorType,
    gain: 0.040,
    bass: {
      notes: [
        [147, 0.38], [0, 0.19], [220, 0.38], [0, 0.19],
        [147, 0.38], [0, 0.19], [175, 0.38], [0, 0.19],
        [110, 0.57], [0, 0.28], [131, 0.57], [0, 0.28],
        [147, 1.13], [0, 0.38],
        [175, 0.38], [0, 0.19], [220, 0.38], [0, 0.19],
        [196, 0.38], [0, 0.19], [175, 0.38], [0, 0.19],
        [147, 0.57], [0, 0.28], [110, 0.57], [0, 0.28],
        [147, 1.13], [0, 0.38],
      ] as [number, number][],
      wave: "sine" as OscillatorType,
      gain: 0.028,
    },
  },

  // Klontausch — Verspielter Karten-Walzer in C-Dur, ~110 BPM
  klontausch: {
    notes: [
      [523, 0.18], [0, 0.09],
      [659, 0.18], [0, 0.09],
      [784, 0.18], [0, 0.09],
      [880, 0.36], [0, 0.18],
      [784, 0.18], [0, 0.09],
      [659, 0.18], [0, 0.09],
      [587, 0.18], [0, 0.09],
      [523, 0.18], [0, 0.09],
      [494, 0.18], [0, 0.09],
      [440, 0.36], [0, 0.18],
      [494, 0.18], [0, 0.09],
      [523, 0.18], [0, 0.09],
      [659, 0.18], [0, 0.09],
      [784, 0.18], [0, 0.09],
      [880, 0.18], [0, 0.09],
      [1047, 0.54], [0, 0.27],
      [880, 0.18], [0, 0.09],
      [784, 0.18], [0, 0.09],
      [659, 0.18], [0, 0.09],
      [523, 0.72], [0, 0.36],
    ] as [number, number][],
    wave: "triangle" as OscillatorType,
    gain: 0.065,
  },

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

// ── AudioManager ─────────────────────────────────────────────────────────────

class AudioManager {
  private ctx: AudioContext | null = null;
  // Howler music playback
  private currentHowl: Howl | null = null;
  // Synthesis fallback
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

  // Fade music volume (0–1). Works on Howl when a file is playing.
  fadeMusic(toVolume: number, durationMs = 500) {
    if (this.currentHowl) {
      this.currentHowl.fade(this.currentHowl.volume(), toVolume, durationMs);
    }
  }

  startMusic(track: TrackId) {
    this.currentTrack = track;
    if (!this.musicEnabled) return;
    this.stopMusic();

    // Try file-based playback via Howler.
    // Drop /public/audio/music/{track}.mp3 (or .ogg) to activate.
    const howl = new Howl({
      src: [`/audio/music/${track}.ogg`, `/audio/music/${track}.mp3`],
      loop: true,
      volume: 0.45,
      onloaderror: () => {
        // File missing — fall back to Web Audio synthesis.
        if (this.currentHowl === howl) {
          this.currentHowl = null;
          if (this.musicEnabled) this._loop(track);
        }
      },
      onplayerror: () => {
        // Autoplay blocked (e.g. iOS before first touch) — retry after unlock.
        howl.once("unlock", () => { if (this.currentHowl === howl) howl.play(); });
      },
    });
    this.currentHowl = howl;
    howl.play();
  }

  stopMusic() {
    if (this.currentHowl) {
      this.currentHowl.unload();
      this.currentHowl = null;
    }
    if (this.loopTimeoutId !== null) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }
    const t = this.ctx?.currentTime ?? 0;
    this.activeOscs.forEach((o) => { try { o.stop(t); } catch { /* already stopped */ } });
    this.activeOscs = [];
  }

  // ── Synthesis fallback ──────────────────────────────────────────────────────

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
