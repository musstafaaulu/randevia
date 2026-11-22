// Synthesizes an original, royalty-free corporate-demo background track
// from scratch (pure Node + math - no samples, no external audio deps):
// a soft pad, piano-like arpeggios, a sustained low bass and a very quiet
// shaker-like rhythm, over a I-V-vi-IV progression in C major at 96 BPM,
// finished with a small Schroeder-style reverb and a peak-safe normalize.
// Fades in/out and the exact trim-to-video-length happen later, in
// 07-assemble.mjs, against the real final video duration.
import fs from 'node:fs';
import path from 'node:path';
import { WORK_DIR } from './lib/ffmpeg.mjs';

const SR = 44100;
const BPM = 96;
const BEAT = 60 / BPM; // seconds
const BAR = BEAT * 4;
const CHORD_BARS = 2;
const CHORD_DUR = BAR * CHORD_BARS; // 5s
const CYCLE_DUR = CHORD_DUR * 4; // 20s
const CYCLES = 9; // ~180s, trimmed to the real video length later
const DURATION = CYCLE_DUR * CYCLES;
const N = Math.round(DURATION * SR);

const A4 = 440;
function noteFreq(semitonesFromA4) {
  return A4 * Math.pow(2, semitonesFromA4 / 12);
}
// Semitone offsets from A4 for the notes we use.
const N_ = {
  C3: -21, E3: -17, G3: -14, A3: -12, C4: -9, D4: -7, E4: -5, F3: -16, F4: -4,
};

// I - V - vi - IV in C major, each as [root, third, fifth] (for the pad/
// arpeggio) and its own bass root (one octave below the pad's root).
const PROGRESSION = [
  { chord: [N_.C4, N_.E4, N_.G3 + 12], bass: N_.C3 },
  { chord: [N_.G3, N_.D4 + 0, N_.D4], bass: N_.G3 - 12 },
  { chord: [N_.A3, N_.C4, N_.E4], bass: N_.A3 - 12 },
  { chord: [N_.F3, N_.A3, N_.C4], bass: N_.F3 - 12 },
];

const out = new Float64Array(N);

function addSample(i, v) {
  if (i >= 0 && i < N) out[i] += v;
}

// ---- Pad: slow sine-cluster per chord, short linear crossfade at
// boundaries so chord changes don't click. ----
function renderPad() {
  const crossfade = 0.15; // seconds
  for (let cycle = 0; cycle < CYCLES; cycle++) {
    for (let step = 0; step < 4; step++) {
      const { chord } = PROGRESSION[step];
      const chordStart = cycle * CYCLE_DUR + step * CHORD_DUR;
      const startSample = Math.round(chordStart * SR);
      const lenSample = Math.round(CHORD_DUR * SR);
      for (let n = 0; n < lenSample; n++) {
        const t = n / SR;
        let env = 1;
        if (t < crossfade) env = t / crossfade;
        else if (t > CHORD_DUR - crossfade) env = (CHORD_DUR - t) / crossfade;
        let v = 0;
        for (const semis of chord) {
          const f = noteFreq(semis - 12); // pad sits an octave low, warm
          const detune = 1.0015;
          v += Math.sin(2 * Math.PI * f * t) * 0.5;
          v += Math.sin(2 * Math.PI * f * detune * t) * 0.5;
        }
        v /= chord.length * 2;
        addSample(startSample + n, v * env * 0.11);
      }
    }
  }
}

// ---- Arpeggio: 8th-note piano-like plucks through the chord tones. ----
function pianoish(freq, t) {
  const fund = Math.sin(2 * Math.PI * freq * t);
  const h2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.28;
  const h3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.12;
  return fund + h2 + h3;
}
function renderArpeggio() {
  const eighth = BEAT / 2;
  const noteLen = 0.6;
  for (let cycle = 0; cycle < CYCLES; cycle++) {
    for (let step = 0; step < 4; step++) {
      const { chord } = PROGRESSION[step];
      const pattern = [chord[0], chord[1], chord[2], chord[1] + 12, chord[0] + 12, chord[1] + 12, chord[2], chord[1]];
      const chordStart = cycle * CYCLE_DUR + step * CHORD_DUR;
      const stepsInChord = Math.round(CHORD_DUR / eighth);
      for (let s = 0; s < stepsInChord; s++) {
        const semis = pattern[s % pattern.length];
        const freq = noteFreq(semis);
        const noteStart = chordStart + s * eighth;
        const startSample = Math.round(noteStart * SR);
        const lenSample = Math.round(Math.min(noteLen, eighth * 3) * SR);
        for (let n = 0; n < lenSample; n++) {
          const t = n / SR;
          const env = Math.exp(-t * 5.5);
          addSample(startSample + n, pianoish(freq, t) * env * 0.085);
        }
      }
    }
  }
}

// ---- Bass: one sustained low note per bar. ----
function renderBass() {
  for (let cycle = 0; cycle < CYCLES; cycle++) {
    for (let step = 0; step < 4; step++) {
      const { bass } = PROGRESSION[step];
      const freq = noteFreq(bass - 12);
      for (let bar = 0; bar < CHORD_BARS; bar++) {
        const noteStart = cycle * CYCLE_DUR + step * CHORD_DUR + bar * BAR;
        const startSample = Math.round(noteStart * SR);
        const lenSample = Math.round(BAR * 0.95 * SR);
        for (let n = 0; n < lenSample; n++) {
          const t = n / SR;
          const env = Math.exp(-t * 1.1) * (t < 0.02 ? t / 0.02 : 1);
          const v = Math.sin(2 * Math.PI * freq * t) * 0.7 + triWave(freq, t) * 0.3;
          addSample(startSample + n, v * env * 0.1);
        }
      }
    }
  }
}
function triWave(freq, t) {
  const phase = (freq * t) % 1;
  return 4 * Math.abs(phase - 0.5) - 1;
}

// ---- Rhythm: very quiet filtered-noise shaker on every 8th note. ----
function renderRhythm() {
  const eighth = BEAT / 2;
  let prevNoise = 0;
  const totalSteps = Math.floor(DURATION / eighth);
  for (let s = 0; s < totalSteps; s++) {
    const hitStart = s * eighth;
    const startSample = Math.round(hitStart * SR);
    const lenSample = Math.round(0.03 * SR);
    for (let n = 0; n < lenSample; n++) {
      const raw = Math.random() * 2 - 1;
      const filtered = raw - prevNoise * 0.7; // crude highpass -> shaker-ish
      prevNoise = raw;
      const env = Math.exp(-(n / SR) * 90);
      addSample(startSample + n, filtered * env * 0.018);
    }
  }
}

// ---- Small Schroeder-style reverb (4 combs + 2 allpass), applied as a
// wet send mixed back at a modest level. ----
function schroederReverb(input) {
  const combDelays = [1557, 1617, 1491, 1422];
  const combGain = 0.82;
  const damp = 0.2;
  const wet = new Float64Array(input.length);

  for (const delay of combDelays) {
    const buf = new Float64Array(delay);
    let idx = 0;
    let lp = 0;
    const combOut = new Float64Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const delayed = buf[idx];
      lp = delayed * (1 - damp) + lp * damp;
      const w = input[i] + lp * combGain;
      buf[idx] = w;
      combOut[i] = delayed;
      idx = (idx + 1) % delay;
    }
    for (let i = 0; i < input.length; i++) wet[i] += combOut[i] / combDelays.length;
  }

  for (const delay of [225, 556]) {
    const buf = new Float64Array(delay);
    let idx = 0;
    const g = 0.5;
    for (let i = 0; i < wet.length; i++) {
      const bufOut = buf[idx];
      const x = wet[i];
      const y = -g * x + bufOut;
      buf[idx] = x + g * y;
      wet[i] = y;
      idx = (idx + 1) % delay;
    }
  }
  return wet;
}

console.log('rendering pad...');
renderPad();
console.log('rendering arpeggio...');
renderArpeggio();
console.log('rendering bass...');
renderBass();
console.log('rendering rhythm...');
renderRhythm();

console.log('applying reverb...');
const reverbSend = new Float64Array(N);
for (let i = 0; i < N; i++) reverbSend[i] = out[i]; // send everything rendered so far
const wet = schroederReverb(reverbSend);

const mixed = new Float64Array(N);
for (let i = 0; i < N; i++) mixed[i] = out[i] * 0.82 + wet[i] * 0.3;

console.log('normalizing...');
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(mixed[i]));
const targetPeak = 0.9;
const scale = peak > 0 ? targetPeak / peak : 1;
console.log(`peak before normalize: ${peak.toFixed(4)}, scale: ${scale.toFixed(4)}`);

const pcm = Buffer.alloc(N * 2 * 2); // stereo, 16-bit
for (let i = 0; i < N; i++) {
  const s = Math.max(-1, Math.min(1, mixed[i] * scale));
  const val = Math.round(s * 32767);
  pcm.writeInt16LE(val, i * 4);
  pcm.writeInt16LE(val, i * 4 + 2);
}

function wavHeader(dataLength) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // stereo
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2 * 2, 28); // byte rate
  header.writeUInt16LE(4, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

const rawDir = path.join(WORK_DIR, 'raw');
fs.mkdirSync(rawDir, { recursive: true });
const outPath = path.join(rawDir, 'music.wav');
fs.writeFileSync(outPath, Buffer.concat([wavHeader(pcm.length), pcm]));
console.log(`wrote ${outPath} (${DURATION.toFixed(1)}s)`);
