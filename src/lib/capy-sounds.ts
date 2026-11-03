export type CapySound = "kyu" | "kyuang" | "ppu" | "echo" | "chorus";

let sharedContext: AudioContext | null = null;

function context() {
  sharedContext ??= new AudioContext();
  if (sharedContext.state === "suspended") void sharedContext.resume();
  return sharedContext;
}

function chirp(
  audio: AudioContext,
  start: number,
  from: number,
  to: number,
  duration: number,
  gain = 0.055,
) {
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const filter = audio.createBiquadFilter();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  filter.type = "bandpass";
  filter.frequency.value = 920;
  filter.Q.value = 1.2;
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.025);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(filter).connect(volume).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

export function playCapySound(kind: CapySound) {
  const audio = context();
  const now = audio.currentTime + 0.015;
  const wobble = 0.94 + Math.random() * 0.12;

  if (kind === "kyu") {
    chirp(audio, now, 430 * wobble, 720 * wobble, 0.16);
    return;
  }
  if (kind === "ppu") {
    chirp(audio, now, 210 * wobble, 145 * wobble, 0.55, 0.07);
    return;
  }
  if (kind === "echo") {
    chirp(audio, now, 390 * wobble, 660 * wobble, 0.25);
    chirp(audio, now + 0.25, 350 * wobble, 560 * wobble, 0.28, 0.025);
    chirp(audio, now + 0.52, 320 * wobble, 510 * wobble, 0.3, 0.012);
    return;
  }
  if (kind === "chorus") {
    chirp(audio, now, 390, 650, 0.3);
    chirp(audio, now + 0.04, 490, 790, 0.3, 0.045);
    chirp(audio, now + 0.08, 585, 880, 0.32, 0.035);
    return;
  }
  chirp(audio, now, 380 * wobble, 710 * wobble, 0.22);
  chirp(audio, now + 0.16, 560 * wobble, 860 * wobble, 0.24, 0.045);
}
