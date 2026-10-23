/**
 * Chuông thông báo ngắn, trong: hai nốt kính (sol rồi đô) và họa âm nhẹ.
 * Tự tổng hợp bằng Web Audio, không dùng file âm thanh của hãng khác.
 */

let audio: AudioContext | null = null;
let pending = false;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) audio = new Ctor();
  return audio;
}

function tone(
  ctx: AudioContext,
  freq: number,
  when: number,
  peak: number,
  decay: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + decay + 0.02);
}

function strike(ctx: AudioContext) {
  const now = ctx.currentTime + 0.01;
  tone(ctx, 784, now, 0.11, 0.42);
  tone(ctx, 1046.5, now + 0.09, 0.09, 0.5);
  tone(ctx, 2093, now + 0.09, 0.028, 0.36);
}

/** Gọi một lần sau cử chỉ người dùng để trình duyệt cho phép phát tiếng. */
export function armNotificationChime() {
  const ctx = context();
  if (!ctx) return;
  void ctx.resume().then(() => {
    if (!pending || ctx.state !== 'running') return;
    pending = false;
    strike(ctx);
  });
}

/** Kêu một tiếng khi có thông báo chưa đọc mới. */
export function playNotificationChime() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state !== 'running') {
    pending = true;
    void ctx.resume();
    return;
  }
  strike(ctx);
}
