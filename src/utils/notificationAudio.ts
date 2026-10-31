/**
 * HSECORE Central Notification Audio & Physical Alert Engine
 * Pure native Web Audio API synthesizer + In-Memory Binary WAV Data-URI Fallback +
 * MediaSession Lock-Screen Integration + Continuous Haptic Vibration + Screen Wake Lock.
 */

let audioCtx: AudioContext | null = null;
let audioUnlockedByGesture = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioCtx = new AudioContextClass();
      } catch {
        audioCtx = null;
      }
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioContextSuspended(): boolean {
  const ctx = getAudioContext();
  if (!ctx) return false;
  return ctx.state === 'suspended';
}

export function isAudioReadyForAutoplay(): boolean {
  if (audioUnlockedByGesture) return true;
  if (typeof navigator !== 'undefined' && (navigator as any).userActivation?.hasBeenActive) {
    return true;
  }
  if (audioCtx && audioCtx.state === 'running') {
    return true;
  }
  return false;
}

export async function resumeAudioContext(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      if ((ctx.state as AudioContextState) === 'running') {
        audioUnlockedByGesture = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hse_audio_unlocked', { detail: { unlocked: true } }));
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  audioUnlockedByGesture = true;
  return true;
}

// Proactive one-time audio & media unlocker on first user interaction
if (typeof window !== 'undefined') {
  const unlockEvents = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];
  const removeUnlockListeners = () => {
    unlockEvents.forEach((evt) => {
      window.removeEventListener(evt, unlockAudio);
    });
  };
  const unlockAudio = () => {
    if (audioUnlockedByGesture) {
      removeUnlockListeners();
      return;
    }
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (ctx.state === 'running' && !audioUnlockedByGesture) {
            audioUnlockedByGesture = true;
            removeUnlockListeners();
            window.dispatchEvent(new CustomEvent('hse_audio_unlocked', { detail: { unlocked: true } }));
          }
        }).catch(() => {});
      } else if (ctx.state === 'running') {
        audioUnlockedByGesture = true;
        removeUnlockListeners();
        window.dispatchEvent(new CustomEvent('hse_audio_unlocked', { detail: { unlocked: true } }));
      }
    }
  };

  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });
}

export type SoundType = 'critical_hse' | 'warning' | 'error' | 'success' | 'info';

export type HseSirenType =
  | 'siren_evacuation'      // آژیر تخلیه اضطراری سایت
  | 'siren_gas_leak'        // آژیر نشت گاز سمی و خطر شیمیایی
  | 'siren_fire_horn'       // بوق اعلام حریق صنعتی
  | 'siren_air_raid'        // آژیر وضعیت قرمز و بحران عمومی
  | 'siren_pulsed_hazard'   // آژیر منقطع خطر حاد و توقف کار
  | 'siren_standard_hse';   // آژیر استاندارد HSECORE

export interface SirenDefinition {
  id: HseSirenType;
  titleFa: string;
  titleEn: string;
  descFa: string;
  descEn: string;
  badge: string;
  color: string;
  frequencyPattern: string;
  loopIntervalMs: number;
}

export const HSE_SIREN_CATALOG: SirenDefinition[] = [
  {
    id: 'siren_evacuation',
    titleFa: 'آژیر تخلیه اضطراری سایت (DIN 33404 / ISO 8201)',
    titleEn: 'DIN 33404-3 / ISO 8201 Evacuation Sweep',
    descFa: 'موج جاروبی نزولی استاندارد بین‌المللی (۱۲۰۰ به ۵۰۰ هرتز در ۱ ثانیه) جهت تخلیه فوری سایت و حرکت به نقاط تجمع ایمن',
    descEn: 'International standard continuous downward sweep (1200Hz to 500Hz @ 1Hz) for immediate site evacuation',
    badge: 'تخلیه اضطراری (DIN 33404)',
    color: 'rose',
    frequencyPattern: '1200Hz → 500Hz Sweep (1.0s)',
    loopIntervalMs: 1000,
  },
  {
    id: 'siren_gas_leak',
    titleFa: 'آژیر نشت گاز سمی و خطر شیمیایی (EN 54-3 Hi-Lo)',
    titleEn: 'EN 54-3 / BS 5839 Alternating Hi-Lo Alarm',
    descFa: 'فرکانس متناوب دوگانه استاندارد اروپایی (۹۷۰ و ۸۰۰ هرتز) جهت هشدار نشت گازهای سمی (H2S/Cl2) و استفاده فوری از ماسک تنفسی',
    descEn: 'European standard EN 54-3 alternating two-tone (970Hz / 800Hz @ 2Hz) for toxic gas & chemical hazard',
    badge: 'خطر گاز و شیمیایی (EN 54-3)',
    color: 'amber',
    frequencyPattern: '970Hz / 800Hz Hi-Lo (EN 54-3)',
    loopIntervalMs: 1000,
  },
  {
    id: 'siren_fire_horn',
    titleFa: 'بوق اعلام حریق صنعتی (NFPA 72 / ISO 8201 T3)',
    titleEn: 'NFPA 72 / ISO 8201 Temporal-3 Fire Klaxon',
    descFa: 'الگوی جهانی سه پالس استاندارد اعلام حریق (Code-3 / T3) با طنین بوق صنعتی ۵۲۰ هرتز جهت بسیج تیم اطفا و واکنش اضطراری',
    descEn: 'Universal ISO 8201 / NFPA 72 Temporal-3 pattern (3 horn blasts + pause) at 520Hz industrial klaxon pitch',
    badge: 'اعلام حریق (NFPA 72 T3)',
    color: 'red',
    frequencyPattern: '520Hz Temporal-3 (ISO 8201)',
    loopIntervalMs: 3200,
  },
  {
    id: 'siren_air_raid',
    titleFa: 'آژیر وضعیت قرمز و بحران سراسری (Civil Defense Wail)',
    titleEn: 'WMO / FEMA Civil Defense Wail Siren',
    descFa: 'آژیر نوسانی ممتد (Wail) با اوج و فرود سینوس مکانیکی (۴۰۰ تا ۹۵۰ هرتز) ویژه شرایط اضطراری سطح ۱ و اعلام خطر عمومی',
    descEn: 'International Civil Defense undulating rotor wail (400Hz - 950Hz) for Code-Red site-wide emergencies',
    badge: 'وضعیت قرمز (Wail Standard)',
    color: 'purple',
    frequencyPattern: '400Hz - 950Hz Wail (3.0s)',
    loopIntervalMs: 3000,
  },
  {
    id: 'siren_pulsed_hazard',
    titleFa: 'آژیر منقطع خطر حاد و توقف کار (ISO 7731 Pulse)',
    titleEn: 'ISO 7731 Imminent Danger Rapid Pulse',
    descFa: 'پالس‌های تند و نافذ ۱۰۰۰ هرتز مطابق استاندارد جهانی ISO 7731 جهت توقف فوری عملیات و فاصله‌گیری از کانون خطر حاد',
    descEn: 'ISO 7731 rapid intermittent 1000Hz high-penetration pulses (3 Hz) for immediate work cessation',
    badge: 'توقف فوری کار (ISO 7731)',
    color: 'orange',
    frequencyPattern: '1000Hz Rapid Pulse (ISO 7731)',
    loopIntervalMs: 1200,
  },
  {
    id: 'siren_standard_hse',
    titleFa: 'آژیر استاندارد صنایع نفت و پتروشیمی (IEC 60849 PAGA)',
    titleEn: 'IEC 60849 / PAGA Offshore & Refinery Yelp',
    descFa: 'آژیر جاروبی سریع بالارونده (۶۰۰ به ۱۲۰۰ هرتز) مطابق استاندارد سیستم‌های PAGA پالایشگاهی و پتروشیمی (IEC 60849)',
    descEn: 'Standard PAGA general emergency fast-rising yelp sweep (600Hz → 1200Hz) per IEC 60849',
    badge: 'استاندارد PAGA (IEC 60849)',
    color: 'emerald',
    frequencyPattern: '600Hz → 1200Hz Fast Yelp',
    loopIntervalMs: 1400,
  },
];

let activeCustomAudio: HTMLAudioElement | null = null;
let activeFallbackWavAudio: HTMLAudioElement | null = null;
let activeSirenLoopTimer: number | null = null;
let activeVibrationTimer: number | null = null;
let activeTitleFlashTimer: number | null = null;
let originalDocumentTitle: string | null = null;
let activeWakeLock: any = null;
let activeSirenType: string | null = null;
let activeCustomAudioUrl: string | null = null;
let activePreviewTimer: number | null = null;
let activeWebAudioNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
let currentSirenSessionId = 0;

// Cache generated WAV data URIs per siren type for instant zero-network `<audio>` playback
const wavDataUriCache = new Map<string, string>();

interface SirenSynthesisStep {
  freq: number;
  env: number;
  /** Harmonic profile selector: 'sweep' | 'hilo' | 'klaxon' | 'wail' | 'pulse' | 'yelp' */
  timbre: 'sweep' | 'hilo' | 'klaxon' | 'wail' | 'pulse' | 'yelp';
}

function getSirenCycleDurationSec(sirenType: string): number {
  switch (sirenType) {
    case 'siren_evacuation':
      return 1.0; // DIN 33404-3: exact 1.0s cycle (1200Hz -> 500Hz)
    case 'siren_gas_leak':
      return 1.0; // EN 54-3 Hi-Lo: 2 complete Hi-Lo pairs (0.25s @ 970Hz, 0.25s @ 800Hz)
    case 'siren_fire_horn':
      return 3.2; // ISO 8201 / NFPA 72 Temporal-3 (3 blasts + pause)
    case 'siren_air_raid':
      return 3.0; // FEMA / Civil Defense Wail: 3.0s full rise & fall cycle
    case 'siren_pulsed_hazard':
      return 1.2; // ISO 7731 rapid intermittent danger pulse: 4 pulses of 0.30s
    case 'siren_standard_hse':
    default:
      return 1.4; // IEC 60849 PAGA Yelp: 4 fast rising sweeps of 0.35s
  }
}

/**
 * Computes instantaneous international-standard siren frequency (Hz), amplitude envelope (0..1),
 * and acoustic harmonic timbre at time `t` within `durationSec`.
 */
function computeStandardSirenProfile(
  sirenType: string,
  t: number,
  durationSec: number
): SirenSynthesisStep {
  const localT = ((t % durationSec) + durationSec) % durationSec;
  const progress = localT / durationSec;

  if (sirenType === 'siren_evacuation') {
    // 1. DIN 33404-3 / ISO 8201 Emergency Evacuation Tone:
    // Continuous downward sweep from 1200 Hz to 500 Hz over 1.0s (1 Hz repetition)
    const sweepPos = localT % 1.0;
    const freq = 1200 - 700 * sweepPos;
    let env = 1.0;
    if (sweepPos < 0.015) env = sweepPos / 0.015;
    else if (sweepPos > 0.96) env = (1.0 - sweepPos) / 0.04;
    return { freq, env, timbre: 'sweep' };
  }

  if (sirenType === 'siren_gas_leak') {
    // 2. EN 54-3 / BS 5839 Alternating Two-Tone (Hi-Lo) Chemical & Gas Alarm:
    // Alternates between 970 Hz (0.25s) and 800 Hz (0.25s) -> 0.5s per pair
    const pairPos = localT % 0.5;
    const isHigh = pairPos < 0.25;
    const tonePos = isHigh ? pairPos : pairPos - 0.25;
    const freq = isHigh ? 970 : 800;
    let env = 1.0;
    // Smooth 8ms anti-click envelope at each 250ms tone switch
    if (tonePos < 0.008) env = tonePos / 0.008;
    else if (tonePos > 0.242) env = (0.25 - tonePos) / 0.008;
    return { freq, env, timbre: 'hilo' };
  }

  if (sirenType === 'siren_fire_horn') {
    // 3. NFPA 72 / ISO 8201 Temporal-3 (T3) Industrial Fire Klaxon:
    // 3 distinct horn blasts (0.45s ON, 0.30s OFF) followed by 0.95s pause = 3.20s cycle
    // Fundamental 520 Hz (NFPA 72 low-frequency standard for maximum awakening/penetration)
    const freq = 520;
    let env = 0.0;
    const windows: Array<[number, number]> = [
      [0.0, 0.45],
      [0.75, 1.20],
      [1.50, 1.95],
    ];
    for (const [start, end] of windows) {
      if (localT >= start && localT <= end) {
        const dt = localT - start;
        const len = end - start;
        if (dt < 0.015) env = dt / 0.015;
        else if (dt > len - 0.025) env = (len - dt) / 0.025;
        else env = 1.0;
        break;
      }
    }
    return { freq, env, timbre: 'klaxon' };
  }

  if (sirenType === 'siren_air_raid') {
    // 4. Civil Defense / WMO / FEMA Red-Alert Wail Siren:
    // Smooth mechanical rotor wail rising from 400 Hz to 950 Hz and falling back over 3.0s
    const wailCurve = 0.5 - 0.5 * Math.cos(2 * Math.PI * progress);
    // Slight asymmetric mechanical rotor curve (faster spin-up, natural coast-down)
    const shaped = Math.pow(wailCurve, 0.9);
    const freq = 400 + 550 * shaped;
    // Rotor acoustic pressure naturally swells at higher RPM
    let env = 0.78 + 0.22 * shaped;
    if (localT < 0.03) env *= localT / 0.03;
    else if (localT > durationSec - 0.03) env *= (durationSec - localT) / 0.03;
    return { freq, env, timbre: 'wail' };
  }

  if (sirenType === 'siren_pulsed_hazard') {
    // 5. ISO 7731 / IMO Imminent Danger Rapid Intermittent Pulse:
    // High-penetration 1000 Hz rapid pulses (0.19s ON, 0.11s OFF -> 0.30s period, ~3.3 Hz)
    const pulsePeriod = 0.30;
    const pPos = localT % pulsePeriod;
    const onDur = 0.19;
    // Slight +30Hz urgency pitch inflection at pulse onset per industrial sounder character
    const freq = 1000 + (pPos < onDur ? 25 * (1 - pPos / onDur) : 0);
    let env = 0.0;
    if (pPos < onDur) {
      if (pPos < 0.01) env = pPos / 0.01;
      else if (pPos > onDur - 0.015) env = (onDur - pPos) / 0.015;
      else env = 1.0;
    }
    return { freq, env, timbre: 'pulse' };
  }

  // 6. IEC 60849 / UKOOA PAGA General Alarm Fast Yelp Sweep ('siren_standard_hse'):
  // Rapid upward frequency sweep from 600 Hz to 1200 Hz every 0.35s (~2.85 sweeps/sec)
  const yelpPeriod = 0.35;
  const yPos = (localT % yelpPeriod) / yelpPeriod;
  const freq = 600 + 600 * yPos;
  let env = 1.0;
  if (yPos < 0.04) env = yPos / 0.04;
  else if (yPos > 0.93) env = (1.0 - yPos) / 0.07;
  return { freq, env, timbre: 'yelp' };
}

/**
 * Generates an in-memory 44.1kHz 16-bit PCM RIFF WAVE base64 Data-URI for each international standard siren.
 * Uses a single pure acoustic carrier per siren with authentic standard harmonic structure.
 */
function getOrGenerateSirenWavDataUri(sirenType: string): string {
  const cached = wavDataUriCache.get(sirenType);
  if (cached) return cached;

  const sampleRate = 44100;
  const durationSec = getSirenCycleDurationSec(sirenType);
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const { freq, env, timbre } = computeStandardSirenProfile(sirenType, t, durationSec);

    phase += (2 * Math.PI * freq) / sampleRate;
    if (phase > 2 * Math.PI) {
      phase -= 2 * Math.PI;
    }

    let rawWave = 0;
    if (timbre === 'klaxon') {
      // NFPA 72 / ISO 8201 Fire Klaxon: rich brass/horn odd+even harmonics + subtle 110Hz diaphragm modulation
      rawWave =
        Math.sin(phase) * 0.62 +
        Math.sin(phase * 2) * 0.22 +
        Math.sin(phase * 3) * 0.28 +
        Math.sin(phase * 4) * 0.10 +
        Math.sin(phase * 5) * 0.08;
      rawWave = Math.tanh(rawWave * 1.45);
    } else if (timbre === 'sweep') {
      // DIN 33404-3 Evacuation Sweep: crisp electronic industrial sounder (sawtooth-filtered warmth)
      rawWave =
        Math.sin(phase) * 0.78 +
        Math.sin(phase * 2) * 0.22 +
        Math.sin(phase * 3) * 0.12;
    } else if (timbre === 'hilo') {
      // EN 54-3 Two-Tone Hi-Lo: clear odd-harmonic electronic sounder (square-filtered character)
      rawWave =
        Math.sin(phase) * 0.82 +
        Math.sin(phase * 3) * 0.20 +
        Math.sin(phase * 5) * 0.06;
    } else if (timbre === 'wail') {
      // Civil Defense Mechanical Rotor Wail: warm fundamental + 2nd & 3rd stator port harmonics
      rawWave =
        Math.sin(phase) * 0.76 +
        Math.sin(phase * 2) * 0.26 +
        Math.sin(phase * 3) * 0.10;
    } else if (timbre === 'pulse') {
      // ISO 7731 Danger Pulse: penetrating 1000Hz alert tone with crisp odd harmonic edge
      rawWave =
        Math.sin(phase) * 0.80 +
        Math.sin(phase * 2) * 0.14 +
        Math.sin(phase * 3) * 0.18;
    } else {
      // IEC 60849 PAGA Yelp: balanced industrial horn sweep
      rawWave =
        Math.sin(phase) * 0.80 +
        Math.sin(phase * 2) * 0.20 +
        Math.sin(phase * 3) * 0.10;
    }

    const sample = Math.max(-1, Math.min(1, rawWave * 0.74 * env));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength)))
    );
  }
  const dataUri = `data:audio/wav;base64,${btoa(binary)}`;
  wavDataUriCache.set(sirenType, dataUri);
  return dataUri;
}

/**
 * Request Screen Wake Lock so device screen stays awake during an active HSE emergency
 */
async function acquireEmergencyWakeLock(): Promise<void> {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    if (!activeWakeLock) {
      activeWakeLock = await (navigator as any).wakeLock.request('screen');
      activeWakeLock.addEventListener('release', () => {
        activeWakeLock = null;
      });
    }
  } catch {
    // WakeLock may fail if document is hidden or unsupported
  }
}

function releaseEmergencyWakeLock(): void {
  if (activeWakeLock) {
    try {
      activeWakeLock.release();
    } catch {}
    activeWakeLock = null;
  }
}

/**
 * Start continuous high-priority haptic vibration loop on supported mobile devices
 */
function startEmergencyVibrationLoop(): void {
  stopEmergencyVibrationLoop();
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([500, 150, 500, 150, 700]);
      activeVibrationTimer = window.setInterval(() => {
        try {
          navigator.vibrate([500, 150, 500, 150, 700]);
        } catch {}
      }, 2400);
    } catch {}
  }
}

function stopEmergencyVibrationLoop(): void {
  if (activeVibrationTimer !== null) {
    clearInterval(activeVibrationTimer);
    activeVibrationTimer = null;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
}

/**
 * Flash document title for visual attention in background tabs
 */
function startEmergencyTitleFlash(alertTitle?: string): void {
  stopEmergencyTitleFlash();
  if (typeof document === 'undefined') return;
  originalDocumentTitle = document.title;
  let toggle = false;
  const label = alertTitle || 'هشدار فوری اضطراری HSE';
  activeTitleFlashTimer = window.setInterval(() => {
    document.title = toggle ? `🚨 ${label}` : `⚠️ [آژیر فعال] HSECORE`;
    toggle = !toggle;
  }, 900);
}

function stopEmergencyTitleFlash(): void {
  if (activeTitleFlashTimer !== null) {
    clearInterval(activeTitleFlashTimer);
    activeTitleFlashTimer = null;
  }
  if (typeof document !== 'undefined' && originalDocumentTitle) {
    document.title = originalDocumentTitle;
    originalDocumentTitle = null;
  }
}

/**
 * Register OS Lock Screen MediaSession metadata so mobile/desktop lock screens display the emergency banner
 */
function setupEmergencyMediaSession(sirenType: string, alertTitle?: string): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof (window as any).MediaMetadata === 'undefined') {
    return;
  }
  try {
    const def = HSE_SIREN_CATALOG.find((s) => s.id === sirenType) || HSE_SIREN_CATALOG[0];
    navigator.mediaSession.metadata = new (window as any).MediaMetadata({
      title: alertTitle || `🚨 ${def.titleFa}`,
      artist: 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)',
      album: def.badge || 'وضعیت اضطراری HSE',
      artwork: [
        { src: '/assets/hsecore-icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/assets/hsecore-icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch {}
}

function clearEmergencyMediaSession(): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.metadata = null;
  } catch {}
}

function stopActiveWebAudioNodes(): void {
  if (activeWebAudioNodes.length === 0) return;
  for (const node of activeWebAudioNodes) {
    try {
      node.osc.stop();
    } catch {}
    try {
      node.osc.disconnect();
      node.gain.disconnect();
    } catch {}
  }
  activeWebAudioNodes = [];
}

function destroyAudioElement(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  try {
    audio.onended = null;
    audio.onerror = null;
    audio.loop = false;
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute('src');
    audio.load();
  } catch {}
}

export function stopNotificationAudio(): void {
  stopActiveWebAudioNodes();
  if (activeCustomAudio) {
    const audio = activeCustomAudio;
    activeCustomAudio = null;
    destroyAudioElement(audio);
  }
  if (activeFallbackWavAudio) {
    const wav = activeFallbackWavAudio;
    activeFallbackWavAudio = null;
    destroyAudioElement(wav);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: false } }));
  }
}

export function isSirenLoopActive(): boolean {
  return (
    activeSirenLoopTimer !== null ||
    activeCustomAudio !== null ||
    activeFallbackWavAudio !== null ||
    activeWebAudioNodes.length > 0
  );
}

export function getActiveSirenType(): string | null {
  return activeSirenType;
}

/**
 * Dispatch a single clean international standard siren cycle via Web Audio API (used only as one-shot or fallback)
 */
export function playSpecificSirenOnce(
  ctx: AudioContext,
  sirenType: HseSirenType | string = 'siren_evacuation',
  volume: number = 0.8
): void {
  const vol = Math.max(0, Math.min(1, volume));
  if (vol <= 0) return;

  stopActiveWebAudioNodes();

  const now = ctx.currentTime;
  const duration = getSirenCycleDurationSec(sirenType);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = sirenType === 'siren_fire_horn' ? 'sawtooth' : 'triangle';

  const steps = Math.max(60, Math.ceil(duration * 50));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    const { freq, env } = computeStandardSirenProfile(sirenType, t, duration);
    osc.frequency.setValueAtTime(freq, now + t);
    gain.gain.setValueAtTime(Math.max(0.0001, vol * 0.55 * env), now + t);
  }

  osc.connect(gain);
  gain.connect(ctx.destination);

  const tracked = { osc, gain };
  activeWebAudioNodes.push(tracked);
  osc.onended = () => {
    activeWebAudioNodes = activeWebAudioNodes.filter((n) => n !== tracked);
  };

  osc.start(now);
  osc.stop(now + duration);
}

/**
 * Start continuous looping emergency siren for popup or background alert.
 * Strictly single-stream & idempotent: if the exact same siren is already playing, it updates volume/metadata without restarting.
 */
export function startSirenLoop(
  sirenType: HseSirenType | string = 'siren_evacuation',
  volume: number = 0.85,
  customAudioUrl?: string,
  alertTitle?: string,
  forceRestart: boolean = false
): void {
  const clampedVol = Math.max(0, Math.min(1, volume));
  const normalizedCustomUrl = customAudioUrl || null;

  // Idempotency guard: if the exact same siren loop is already active (and not in preview mode), do NOT restart or overlap
  if (
    !forceRestart &&
    activePreviewTimer === null &&
    isSirenLoopActive() &&
    activeSirenType === sirenType &&
    activeCustomAudioUrl === normalizedCustomUrl
  ) {
    if (activeCustomAudio) {
      activeCustomAudio.volume = clampedVol;
    }
    if (activeFallbackWavAudio) {
      activeFallbackWavAudio.volume = clampedVol;
    }
    if (alertTitle) {
      setupEmergencyMediaSession(sirenType, alertTitle);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hse_siren_loop_state', {
          detail: { isPlaying: true, sirenType, volume: clampedVol, audioBlocked: false },
        })
      );
    }
    return;
  }

  stopSirenLoop();

  const sessionId = ++currentSirenSessionId;
  activeSirenType = sirenType;
  activeCustomAudioUrl = normalizedCustomUrl;

  acquireEmergencyWakeLock();
  startEmergencyVibrationLoop();
  startEmergencyTitleFlash(alertTitle);
  setupEmergencyMediaSession(sirenType, alertTitle);

  if (customAudioUrl) {
    try {
      const audio = new Audio(customAudioUrl);
      audio.loop = true;
      audio.volume = clampedVol;
      activeCustomAudio = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (sessionId !== currentSirenSessionId || activeCustomAudio !== audio) {
              destroyAudioElement(audio);
              return;
            }
            audioUnlockedByGesture = true;
            stopActiveWebAudioNodes();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('hse_siren_loop_state', {
                  detail: { isPlaying: true, sirenType, volume: clampedVol, audioBlocked: false },
                })
              );
            }
          })
          .catch((err: any) => {
            if (sessionId !== currentSirenSessionId) {
              destroyAudioElement(audio);
              return;
            }
            if (activeCustomAudio === audio) {
              activeCustomAudio = null;
            }
            destroyAudioElement(audio);
            if (err?.name === 'AbortError') return;
            startSynthSirenLoop(sirenType, clampedVol, sessionId);
          });
      }
      return;
    } catch {
      // Fall through to standard siren loop
    }
  }

  startSynthSirenLoop(sirenType, clampedVol, sessionId);
}

function startSynthSirenLoop(sirenType: string, volume: number, sessionId: number): void {
  if (sessionId !== currentSirenSessionId) return;
  const clampedVol = Math.max(0, Math.min(1, volume));

  try {
    const wavUri = getOrGenerateSirenWavDataUri(sirenType);
    const wavAudio = new Audio(wavUri);
    wavAudio.loop = true;
    wavAudio.volume = clampedVol;
    activeFallbackWavAudio = wavAudio;

    const playPromise = wavAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (sessionId !== currentSirenSessionId || activeFallbackWavAudio !== wavAudio) {
            destroyAudioElement(wavAudio);
            return;
          }
          audioUnlockedByGesture = true;
          stopActiveWebAudioNodes();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('hse_siren_loop_state', {
                detail: { isPlaying: true, sirenType, volume: clampedVol, audioBlocked: false },
              })
            );
          }
        })
        .catch((err: any) => {
          if (sessionId !== currentSirenSessionId) {
            destroyAudioElement(wavAudio);
            return;
          }
          if (activeFallbackWavAudio === wavAudio) {
            activeFallbackWavAudio = null;
          }
          destroyAudioElement(wavAudio);
          // Never trigger WebAudio fallback if play() was merely interrupted by a pause/stop call
          if (err?.name === 'AbortError') {
            return;
          }
          // If HTML5 Audio autoplay is blocked by browser policy, try single-stream WebAudio fallback
          const ctx = getAudioContext();
          if (ctx && ctx.state === 'running' && sessionId === currentSirenSessionId) {
            const cycleMs = Math.round(getSirenCycleDurationSec(sirenType) * 1000);
            playSpecificSirenOnce(ctx, sirenType, clampedVol);
            activeSirenLoopTimer = window.setInterval(() => {
              if (sessionId !== currentSirenSessionId) {
                if (activeSirenLoopTimer !== null) {
                  clearInterval(activeSirenLoopTimer);
                  activeSirenLoopTimer = null;
                }
                return;
              }
              const currentCtx = getAudioContext();
              if (currentCtx && currentCtx.state === 'running') {
                playSpecificSirenOnce(currentCtx, sirenType, clampedVol);
              }
            }, cycleMs);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('hse_siren_loop_state', {
                  detail: { isPlaying: true, sirenType, volume: clampedVol, audioBlocked: false },
                })
              );
            }
          } else if (typeof window !== 'undefined' && sessionId === currentSirenSessionId) {
            window.dispatchEvent(
              new CustomEvent('hse_siren_loop_state', {
                detail: { isPlaying: false, sirenType, volume: clampedVol, audioBlocked: true },
              })
            );
          }
        });
    }
  } catch {}
}

/**
 * Immediately stop continuous siren loop, vibration, wake lock, and title flash (called when user acknowledges the alert)
 */
export function stopSirenLoop(): void {
  currentSirenSessionId++;
  if (activeSirenLoopTimer !== null) {
    clearInterval(activeSirenLoopTimer);
    activeSirenLoopTimer = null;
  }
  if (activePreviewTimer !== null) {
    clearTimeout(activePreviewTimer);
    activePreviewTimer = null;
  }
  activeSirenType = null;
  activeCustomAudioUrl = null;
  stopNotificationAudio();
  stopEmergencyVibrationLoop();
  stopEmergencyTitleFlash();
  releaseEmergencyWakeLock();
  clearEmergencyMediaSession();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('hse_siren_loop_state', {
        detail: { isPlaying: false, audioBlocked: false },
      })
    );
  }
}

/**
 * Preview siren sound for dispatcher before broadcasting (4 seconds sample)
 */
export function previewSiren(
  sirenType: HseSirenType | string,
  durationSeconds: number = 4.0,
  volume: number = 0.8
): void {
  stopSirenLoop();

  startSirenLoop(sirenType, volume, undefined, undefined, true);

  activePreviewTimer = window.setTimeout(() => {
    stopSirenLoop();
    activePreviewTimer = null;
  }, durationSeconds * 1000);
}

export function stopSirenPreview(): void {
  if (activePreviewTimer !== null) {
    clearTimeout(activePreviewTimer);
    activePreviewTimer = null;
  }
  stopSirenLoop();
}

/**
 * Standard notification sound playback (short one-shot chimes or emergency alerts)
 */
export function playNotificationSound(
  type: SoundType | string,
  options?: {
    volume?: number;
    forcePlay?: boolean;
    muted?: boolean;
    customAudioUrl?: string;
    sirenType?: HseSirenType | string;
  }
): void {
  // Never overlap a one-shot notification sound on top of an active emergency siren loop
  if (isSirenLoopActive()) return;

  const isMuted = options?.muted ?? false;
  if (isMuted && !options?.forcePlay) return;

  const masterVol = Math.max(0, Math.min(1, options?.volume ?? 0.8));
  if (masterVol <= 0) return;

  // Custom audio playback strictly for critical HSE alarm
  if ((type === 'critical_hse' || type === 'critical') && options?.customAudioUrl) {
    try {
      stopNotificationAudio();
      const audio = new Audio(options.customAudioUrl);
      audio.volume = masterVol;
      activeCustomAudio = audio;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: true } }));
      }
      audio.onended = () => {
        if (activeCustomAudio === audio) activeCustomAudio = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: false } }));
        }
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (activeCustomAudio === audio) activeCustomAudio = null;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: false } }));
          }
          const ctx = getAudioContext();
          if (ctx) playSpecificSirenOnce(ctx, options?.sirenType || 'siren_evacuation', masterVol);
        });
      }
      return;
    } catch {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: false } }));
      }
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'critical_hse' || type === 'critical') {
      playSpecificSirenOnce(ctx, options?.sirenType || 'siren_evacuation', masterVol);
    } else if (type === 'warning' || type === 'high') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, now);

      gain.gain.setValueAtTime(masterVol * 0.35, now);
      gain.gain.setValueAtTime(0, now + 0.18);
      gain.gain.setValueAtTime(masterVol * 0.35, now + 0.26);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.56);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);

      gain.gain.setValueAtTime(masterVol * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.001, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(masterVol * 0.25, now + idx * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.65);
      });
    } else {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      harmonic.type = 'sine';

      osc.frequency.setValueAtTime(587.33, now);
      harmonic.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(masterVol * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      harmonic.start(now);
      osc.stop(now + 0.46);
      harmonic.stop(now + 0.46);
    }
  } catch (err) {
    console.debug('[HSE Audio Alert Note]', err);
  }
}
