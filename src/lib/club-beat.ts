// A tiny original house-style loop made with Web Audio. It starts only after a click.
export function startClubBeat(context: AudioContext): () => void {
  const noise = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * 0.22),
    context.sampleRate,
  );
  const channel = noise.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  let step = 0;

  const tone = (
    time: number,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration);
  };

  const noiseHit = (
    time: number,
    cutoff: number,
    duration: number,
    volume: number,
  ) => {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(time);
    source.stop(time + duration);
  };

  const playStep = () => {
    if (context.state !== "running") return;
    const time = context.currentTime + 0.02;
    if (step % 2 === 0) {
      const kick = context.createOscillator();
      const gain = context.createGain();
      kick.type = "sine";
      kick.frequency.setValueAtTime(120, time);
      kick.frequency.exponentialRampToValueAtTime(48, time + 0.16);
      gain.gain.setValueAtTime(0.23, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      kick.connect(gain).connect(context.destination);
      kick.start(time);
      kick.stop(time + 0.2);
      tone(
        time,
        [82.41, 98, 110, 98][Math.floor(step / 2) % 4],
        0.19,
        0.038,
        "triangle",
      );
    }
    if (step % 4 === 2) noiseHit(time, 1100, 0.13, 0.085);
    noiseHit(time, 6500, 0.06, step % 2 ? 0.035 : 0.018);
    step = (step + 1) % 8;
  };

  playStep();
  const timer = window.setInterval(playStep, 250); // 120 BPM, eighth notes
  return () => window.clearInterval(timer);
}
