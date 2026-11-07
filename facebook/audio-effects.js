/**
 * Facebook Reels Audio Effects & Retention Enhancer
 * Provides procedural sound synthesis and asset management:
 * 1. Subtle quiz suspense BGM bed (sub-pulse + tension pad + ostinato)
 * 2. Countdown timer tick-tock SFX (clock ticks to drive urgency)
 * 3. Correct answer reveal chime / ding SFX (psychological reward)
 * 
 * Works 100% offline with zero external audio dependencies.
 * If user places custom MP3/WAV files in assets/audio, those will be preferred.
 */

const fs = require('fs');
const path = require('path');

function createWavHeader(numSamples, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

/**
 * Generates realistic countdown clock tick-tock audio
 */
function generateTickTockWav(duration = 6, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * duration);
  const pcm = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    const secondFraction = t % 1.0;

    // Primary tick at start of each second
    if (secondFraction < 0.08) {
      const dt = secondFraction;
      s += 0.65 * Math.sin(2 * Math.PI * 2400 * dt) * Math.exp(-dt * 90);
      s += 0.35 * Math.sin(2 * Math.PI * 950 * dt) * Math.exp(-dt * 60);
      s += 0.20 * (Math.random() * 2 - 1) * Math.exp(-dt * 120);
    }
    // Secondary tock at half-second mark
    if (secondFraction >= 0.5 && secondFraction < 0.58) {
      const dt = secondFraction - 0.5;
      s += 0.45 * Math.sin(2 * Math.PI * 1700 * dt) * Math.exp(-dt * 90);
      s += 0.25 * Math.sin(2 * Math.PI * 720 * dt) * Math.exp(-dt * 60);
      s += 0.15 * (Math.random() * 2 - 1) * Math.exp(-dt * 120);
    }

    const clamped = Math.max(-1, Math.min(1, s));
    pcm.writeInt16LE(Math.floor(clamped * 32767), i * 2);
  }

  return Buffer.concat([createWavHeader(numSamples, sampleRate), pcm]);
}

/**
 * Generates rich suspense / quiz background music bed
 * Heartbeat sub-bass pulse + D minor drone pad + tension ostinato
 */
function generateSuspenseBgmWav(duration = 40, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * duration);
  const pcm = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // 1. Subtle Heartbeat / Sub Pulse (120 BPM = 0.5s period)
    const beatPhase = (t % 0.5) / 0.5;
    if (beatPhase < 0.25) {
      const bt = beatPhase * 0.5;
      s += 0.45 * Math.sin(2 * Math.PI * (60 - 20 * beatPhase) * bt) * Math.exp(-bt * 22);
    }

    // 2. Minor Tension Pad (D minor drone: 73.4Hz [D2], 146.8Hz [D3], 174.6Hz [F3], 220Hz [A3])
    const padLFO = 1 + 0.15 * Math.sin(2 * Math.PI * 0.3 * t);
    const pad = (
      0.18 * Math.sin(2 * Math.PI * 73.4 * t) +
      0.15 * Math.sin(2 * Math.PI * 146.8 * t) +
      0.10 * Math.sin(2 * Math.PI * 174.6 * t) +
      0.08 * Math.sin(2 * Math.PI * 220.0 * t)
    ) * padLFO;
    s += pad;

    // 3. Subtle tension clock ostinato (16th notes: every 0.125s)
    const subPhase = (t % 0.125) / 0.125;
    if (subPhase < 0.12) {
      const st = subPhase * 0.125;
      s += 0.08 * Math.sin(2 * Math.PI * 3400 * st) * Math.exp(-st * 160);
    }

    const clamped = Math.max(-1, Math.min(1, s * 0.7));
    pcm.writeInt16LE(Math.floor(clamped * 32767), i * 2);
  }

  return Buffer.concat([createWavHeader(numSamples, sampleRate), pcm]);
}

/**
 * Generates sparkling correct answer reveal chime / bell
 */
function generateChimeWav(duration = 2.5, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * duration);
  const pcm = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    const decay = Math.exp(-t * 2.8);

    s += 0.45 * Math.sin(2 * Math.PI * 1318.5 * t) * decay;
    s += 0.35 * Math.sin(2 * Math.PI * 2637 * t) * Math.exp(-t * 3.5);
    s += 0.18 * Math.sin(2 * Math.PI * 3951 * t) * Math.exp(-t * 4.5);
    s += 0.10 * Math.sin(2 * Math.PI * 5274 * t) * Math.exp(-t * 6.0);

    const clamped = Math.max(-1, Math.min(1, s));
    pcm.writeInt16LE(Math.floor(clamped * 32767), i * 2);
  }

  return Buffer.concat([createWavHeader(numSamples, sampleRate), pcm]);
}

/**
 * Ensures sound assets exist in audioDir, creating synthetic defaults if missing
 */
function ensureAudioAssets(customDir = null) {
  const audioDir = customDir || path.resolve(__dirname, '../assets/audio');
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // 1. Suspense BGM
  const customBgm = [
    path.join(audioDir, 'suspense_bgm.mp3'),
    path.join(audioDir, 'quiz_suspense_bgm.mp3'),
    path.join(audioDir, 'bgm.mp3'),
  ].find(p => fs.existsSync(p));

  const bgmPath = customBgm || path.join(audioDir, 'quiz_suspense_bgm.wav');
  if (!fs.existsSync(bgmPath)) {
    fs.writeFileSync(bgmPath, generateSuspenseBgmWav(40));
  }

  // 2. Countdown Timer Tick-Tock
  const customTick = [
    path.join(audioDir, 'tick_tock.mp3'),
    path.join(audioDir, 'countdown_tick_tock.mp3'),
  ].find(p => fs.existsSync(p));

  const tickTockPath = customTick || path.join(audioDir, 'countdown_tick_tock.wav');
  if (!fs.existsSync(tickTockPath)) {
    fs.writeFileSync(tickTockPath, generateTickTockWav(8));
  }

  // 3. Answer Reveal Chime
  const customChime = [
    path.join(audioDir, 'correct_ding.mp3'),
    path.join(audioDir, 'bell_chime.mp3'),
  ].find(p => fs.existsSync(p));

  const chimePath = customChime || path.join(audioDir, 'correct_ding.wav');
  if (!fs.existsSync(chimePath)) {
    fs.writeFileSync(chimePath, generateChimeWav(3));
  }

  return {
    bgmPath,
    tickTockPath,
    chimePath,
  };
}

module.exports = {
  createWavHeader,
  generateTickTockWav,
  generateSuspenseBgmWav,
  generateChimeWav,
  ensureAudioAssets,
};
