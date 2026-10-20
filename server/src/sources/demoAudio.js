import fs from "node:fs";
import path from "node:path";

const SAMPLE_RATE = 16000;

const triad = (root, quality) => [root, root + (quality === "m" ? 3 : 4), root + 7];

const TRACK_SPECS = [
  {
    id: "demo-night-promenade",
    title: "Night Promenade",
    album: "Offline Sketches",
    seconds: 22,
    bpm: 76,
    seed: 11,
    progression: [
      triad(-12, "m"),
      triad(-14, "M"),
      triad(-16, "M"),
      triad(-17, "m"),
    ],
    tags: ["ambient", "night", "piano", "calm", "夜晚", "安静"],
  },
  {
    id: "demo-paper-lanterns",
    title: "Paper Lanterns",
    album: "Offline Sketches",
    seconds: 20,
    bpm: 88,
    seed: 23,
    progression: [
      triad(-21, "M"),
      triad(-14, "M"),
      triad(-12, "m"),
      triad(-16, "M"),
    ],
    tags: ["warm", "folk", "guitar", "daylight", "温暖"],
  },
  {
    id: "demo-slow-current",
    title: "Slow Current",
    album: "Offline Sketches",
    seconds: 24,
    bpm: 64,
    seed: 37,
    progression: [
      triad(-19, "m"),
      triad(-22, "M"),
      triad(-16, "M"),
      triad(-21, "M"),
    ],
    tags: ["drone", "slow", "focus", "deep", "专注"],
  },
  {
    id: "demo-glass-garden",
    title: "Glass Garden",
    album: "Offline Sketches",
    seconds: 19,
    bpm: 92,
    seed: 41,
    progression: [
      triad(-17, "m"),
      triad(-21, "M"),
      triad(-14, "M"),
      triad(-19, "M"),
    ],
    tags: ["bright", "bell", "morning", "轻快", "清晨"],
  },
  {
    id: "demo-dust-and-copper",
    title: "Dust & Copper",
    album: "Offline Sketches",
    seconds: 21,
    bpm: 70,
    seed: 53,
    progression: [
      triad(-12, "m"),
      triad(-21, "M"),
      triad(-19, "m"),
      triad(-17, "m"),
    ],
    tags: ["lofi", "warm", "loop", "复古", "循环"],
  },
  {
    id: "demo-fern-light",
    title: "Fern Light",
    album: "Offline Sketches",
    seconds: 23,
    bpm: 84,
    seed: 67,
    progression: [
      triad(-14, "M"),
      triad(-17, "m"),
      triad(-21, "M"),
      triad(-19, "M"),
    ],
    tags: ["nature", "soft", "green", "自然", "柔和"],
  },
];

export const DEMO_TRACKS = TRACK_SPECS.map((spec) => ({
  id: spec.id,
  title: spec.title,
  artist: "小云屋工作室",
  album: spec.album,
  duration: spec.seconds,
  tags: spec.tags,
  fileName: `${spec.id}.wav`,
}));

const NOTE_A4 = 440;
const freqOf = (semitones) => NOTE_A4 * 2 ** (semitones / 12);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addPad(buffer, startSec, durSec, freq, gain) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(durSec * SAMPLE_RATE);
  const attack = Math.max(1, Math.floor(0.4 * SAMPLE_RATE));
  const release = Math.max(1, Math.floor(0.6 * SAMPLE_RATE));

  for (let i = 0; i < length; i += 1) {
    const index = start + i;
    if (index >= buffer.length) break;
    const time = i / SAMPLE_RATE;
    let envelope = 1;
    if (i < attack) envelope = i / attack;
    if (i > length - release) envelope = Math.max(0, (length - i) / release);
    const vibrato = 1 + 0.0025 * Math.sin(2 * Math.PI * 0.17 * time);
    const wave =
      Math.sin(2 * Math.PI * freq * vibrato * time) * 0.6 +
      Math.sin(2 * Math.PI * freq * 2 * time) * 0.1;
    buffer[index] += wave * envelope * gain;
  }
}

function addPluck(buffer, startSec, durSec, freq, gain, decay) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const length = Math.floor(durSec * SAMPLE_RATE);
  const attack = Math.max(1, Math.floor(0.008 * SAMPLE_RATE));

  for (let i = 0; i < length; i += 1) {
    const index = start + i;
    if (index >= buffer.length) break;
    const time = i / SAMPLE_RATE;
    const envelope = Math.min(1, i / attack) * Math.exp(-time * decay);
    const wave =
      Math.sin(2 * Math.PI * freq * time) * 0.7 +
      Math.sin(2 * Math.PI * freq * 2 * time) * 0.18 +
      Math.sin(2 * Math.PI * freq * 3.01 * time) * 0.07;
    buffer[index] += wave * envelope * gain;
  }
}

function synthesize(spec) {
  const total = Math.floor(spec.seconds * SAMPLE_RATE);
  const buffer = new Float32Array(total);
  const random = mulberry32(spec.seed);
  const beat = 60 / spec.bpm;
  const bar = beat * 4;

  let barIndex = 0;
  for (let start = 0; start < spec.seconds; start += bar) {
    const chord = spec.progression[barIndex % spec.progression.length];
    const span = Math.min(bar, spec.seconds - start);

    chord.forEach((note, voiceIndex) => {
      addPad(buffer, start, span, freqOf(note), 0.055 - voiceIndex * 0.008);
    });
    addPad(buffer, start, span, freqOf(chord[0] - 12), 0.05);

    const steps = 8;
    for (let step = 0; step < steps; step += 1) {
      const offset = random() > 0.45 ? 12 : 0;
      const note = chord[Math.floor(random() * chord.length)] + offset;
      const at = start + (step * span) / steps;
      if (at >= spec.seconds) break;
      addPluck(buffer, at, Math.min(beat * 2.4, spec.seconds - at), freqOf(note), 0.12, 3.4);
    }

    barIndex += 1;
  }

  let peak = 0;
  for (let i = 0; i < total; i += 1) peak = Math.max(peak, Math.abs(buffer[i]));
  const scale = peak > 0 ? 0.82 / peak : 1;

  const fade = Math.floor(0.6 * SAMPLE_RATE);
  for (let i = 0; i < total; i += 1) {
    let value = buffer[i] * scale;
    if (i < fade) value *= i / fade;
    if (i > total - fade) value *= Math.max(0, (total - i) / fade);
    buffer[i] = value;
  }
  return buffer;
}

function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

export function ensureDemoAudio(mediaDir) {
  const targetDir = path.join(mediaDir, "demo");
  fs.mkdirSync(targetDir, { recursive: true });

  let generated = 0;
  TRACK_SPECS.forEach((spec) => {
    const file = path.join(targetDir, `${spec.id}.wav`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1024) return;
    fs.writeFileSync(file, toWav(synthesize(spec)));
    generated += 1;
  });
  return generated;
}
