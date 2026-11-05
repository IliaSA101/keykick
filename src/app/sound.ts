/**
 * Звуки игры: записанные файлы (удар, трибуны, свисток), при сбое загрузки — синтез WebAudio
 * (решение design.md). Щелчок клавиши и ошибка — всегда синтез: они короткие и частые.
 * Браузер разрешает звук только после первого действия ребёнка: файлы скачиваются сразу,
 * а раскодируются, когда по первому нажатию или клику появится звуковой контекст.
 */
import { ref, watch } from 'vue';
import { artUrl, type ArtKey } from '../art/assets';

const MUTE_KEY = 'keykick.muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Без звука — выбор ребёнка, помнится между заходами. */
export const muted = ref(readMuted());

watch(muted, (value) => {
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Хранилище недоступно (приватное окно) — выбор живёт до перезагрузки.
  }
});

type SfxKey = Extract<ArtKey, `sfx${string}`>;
const sfxKeys: readonly SfxKey[] = ['sfxKick', 'sfxGoal', 'sfxGroan', 'sfxWhistleStart', 'sfxWhistleEnd'];

// Сырые байты качаем сразу при загрузке игры: к первому матчу они уже здесь.
const raw = new Map<SfxKey, Promise<ArrayBuffer | null>>(
  sfxKeys.map((k) => [
    k,
    fetch(artUrl(k))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null),
  ]),
);
const buffers = new Map<SfxKey, AudioBuffer>();

let ctx: AudioContext | null = null;

function createContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    return null;
  }
  const a = ctx;
  for (const [k, bytes] of raw) {
    void bytes
      .then((b) => (b ? a.decodeAudioData(b) : null))
      .then((buf) => {
        if (buf) buffers.set(k, buf);
      })
      .catch(() => {
        // Не раскодировалось — останется синтез.
      });
  }
  return ctx;
}

// Первое действие ребёнка в любом месте игры открывает звук: к удару файлы уже раскодированы.
for (const type of ['pointerdown', 'keydown'] as const) {
  globalThis.addEventListener?.(type, () => void createContext(), { once: true, capture: true });
}

function audio(): AudioContext | null {
  if (muted.value) return null;
  const a = createContext();
  if (a?.state === 'suspended') void a.resume();
  return a;
}

/** Записанный звук; false — файла ещё (или вообще) нет, играем синтез. */
function play(a: AudioContext, key: SfxKey, volume: number, at = a.currentTime): boolean {
  const buffer = buffers.get(key);
  if (!buffer) return false;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(a.destination);
  src.start(at);
  return true;
}

/** Тон с огибающей: атака 5 мс, затухание до конца. */
function tone(a: AudioContext, freq: number, start: number, length: number, volume: number, type: OscillatorType = 'sine'): void {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** Шум через полосовой фильтр: щелчок клавиши, гул трибун. */
function noise(a: AudioContext, start: number, length: number, volume: number, freq: number, q = 1): void {
  const frames = Math.max(1, Math.floor(a.sampleRate * length));
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  // Шум для звука, а не для игры: здесь Math.random допустим, страж следит только за src/engine.
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.08, length / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(start);
}

export const sound = {
  /** Верная клавиша — тихий щелчок. */
  key(): void {
    const a = audio();
    if (a) noise(a, a.currentTime, 0.03, 0.12, 3500, 2);
  },
  /** Ошибка — короткий низкий «бум», не обидный. */
  error(): void {
    const a = audio();
    if (a) tone(a, 140, a.currentTime, 0.12, 0.25, 'triangle');
  },
  /** Гол — удар, восходящий аккорд и рёв трибун. */
  goal(): void {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    if (!play(a, 'sfxKick', 0.8, t)) noise(a, t, 0.06, 0.35, 900, 1);
    [523, 659, 784, 1047].forEach((f, i) => tone(a, f, t + 0.08 + i * 0.07, 0.35, 0.1, 'triangle'));
    if (!play(a, 'sfxGoal', 0.9, t + 0.1)) noise(a, t + 0.1, 1.6, 0.22, 700, 0.6);
  },
  /** Сейв вратаря — удар и разочарованное «ох» трибун. */
  save(): void {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    if (!play(a, 'sfxKick', 0.8, t)) noise(a, t, 0.06, 0.3, 900, 1);
    if (!play(a, 'sfxGroan', 0.8, t + 0.1)) noise(a, t + 0.08, 0.7, 0.12, 400, 0.8);
  },
  /** Гол в наши ворота — два нисходящих тона. */
  conceded(): void {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    tone(a, 392, t, 0.25, 0.18, 'triangle');
    tone(a, 294, t + 0.2, 0.4, 0.18, 'triangle');
  },
  /** Свисток судьи: начало и конец тайма. */
  whistle(long = false): void {
    const a = audio();
    if (!a) return;
    if (play(a, long ? 'sfxWhistleEnd' : 'sfxWhistleStart', 0.7)) return;
    const t = a.currentTime;
    const blasts = long ? [0, 0.3, 0.6] : [0];
    for (const at of blasts) {
      const osc = a.createOscillator();
      const lfo = a.createOscillator();
      const lfoGain = a.createGain();
      const gain = a.createGain();
      osc.frequency.value = 2600;
      lfo.frequency.value = 30;
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain).connect(osc.frequency);
      const len = long && at === 0.6 ? 0.6 : 0.22;
      gain.gain.setValueAtTime(0, t + at);
      gain.gain.linearRampToValueAtTime(0.08, t + at + 0.01);
      gain.gain.setValueAtTime(0.08, t + at + len - 0.03);
      gain.gain.linearRampToValueAtTime(0, t + at + len);
      osc.connect(gain).connect(a.destination);
      osc.start(t + at);
      lfo.start(t + at);
      osc.stop(t + at + len + 0.02);
      lfo.stop(t + at + len + 0.02);
    }
  },
};
