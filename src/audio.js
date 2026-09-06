export function createAudio() {
  let ctx = null;
  let master = null;
  let started = false;
  let muted = false;
  let seaGain = null;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }

  function env(gain, t, a = 0.01, d = 0.2, vol = 0.2) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    o.connect(g);
    g.connect(master);
    env(g, t, 0.02, dur, vol);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq = 900) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = n.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = n;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const g = ctx.createGain();
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    env(g, t, 0.005, dur, vol);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function startSea() {
    if (!ctx || seaGain) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.03;
      data[i] = last;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    seaGain = ctx.createGain();
    seaGain.gain.value = 0.18;
    src.connect(filter);
    filter.connect(seaGain);
    seaGain.connect(master);
    src.start();
  }

  function start() {
    ensure();
    if (!ctx) return;
    ctx.resume();
    if (started) return;
    started = true;
    startSea();
    horn();
  }

  function horn() {
    if (!ctx || muted) return;
    tone(196, 0.55, 'sawtooth', 0.06, -40);
    setTimeout(() => tone(147, 0.7, 'sawtooth', 0.05, -20), 180);
  }

  function hit() {
    noiseBurst(0.09, 0.16, 420);
    tone(180, 0.08, 'square', 0.04, -80);
  }

  function arrow() {
    noiseBurst(0.07, 0.08, 1800);
    tone(720, 0.1, 'triangle', 0.03, -400);
  }

  function gold() {
    tone(660, 0.12, 'sine', 0.07);
    tone(990, 0.16, 'sine', 0.05);
  }

  function fire() {
    noiseBurst(0.2, 0.07, 280);
  }

  function click() {
    tone(440, 0.05, 'square', 0.03);
  }

  function ability() {
    tone(392, 0.12, 'sawtooth', 0.05);
    tone(523, 0.18, 'triangle', 0.04);
  }

  function win() {
    if (!ctx || muted) return;
    [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0.28, 'triangle', 0.08), i * 140));
  }

  function lose() {
    tone(196, 0.5, 'sawtooth', 0.06, -80);
    setTimeout(() => tone(110, 0.7, 'triangle', 0.07, -30), 200);
  }

  function land() {
    noiseBurst(0.18, 0.12, 240);
    horn();
  }

  function setMuted(on) {
    muted = on;
    if (master) master.gain.value = muted ? 0 : 0.32;
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  return {
    start,
    horn,
    hit,
    arrow,
    gold,
    fire,
    click,
    ability,
    win,
    lose,
    land,
    setMuted,
    toggleMute,
    isMuted: () => muted,
  };
}
