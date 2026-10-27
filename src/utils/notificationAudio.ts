/**
 * HSECORE Central Notification Audio Engine
 * Pure native Web Audio API synthesizer for zero-latency, offline, 100% reliable industrial audio alerts.
 * Includes continuous emergency siren looping, per-alert siren selection, previewing, and autoplay policy handling.
 */

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioContextSuspended(): boolean {
  if (!audioCtx) return false;
  return audioCtx.state === 'suspended';
}

export async function resumeAudioContext(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

// Ensure audio context resumes on user click or touch anywhere in window
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
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
    titleFa: 'آژیر تخلیه اضطراری سایت',
    titleEn: 'Evacuation Siren (Sweep Alarm)',
    descFa: 'فرکانس بالارونده و متناوب صنعتی جهت تخلیه فوری محوطه و حرکت به نقاط تجمع ایمن',
    descEn: 'Ascending dual-tone sweep for urgent site evacuation to muster points',
    badge: 'تخلیه اضطراری سایت',
    color: 'rose',
    frequencyPattern: '500Hz - 1100Hz Swept',
    loopIntervalMs: 1400,
  },
  {
    id: 'siren_gas_leak',
    titleFa: 'آژیر نشت گاز سمی و خطر شیمیایی',
    titleEn: 'Toxic Gas / Hazmat Staccato',
    descFa: 'پالس‌های تند دوگانه با هشدارهای فرکانس بالا جهت تجهیز به ماسک و حرکت در خلاف جهت باد',
    descEn: 'Fast staccato bursts for toxic gas (H2S/Cl2) escape and PPE deployment',
    badge: 'خطر گاز و شیمیایی',
    color: 'amber',
    frequencyPattern: '1050Hz / 780Hz Rapid',
    loopIntervalMs: 1100,
  },
  {
    id: 'siren_fire_horn',
    titleFa: 'بوق اعلام حریق صنعتی (Fire Klaxon)',
    titleEn: 'Industrial Fire Klaxon',
    descFa: 'پالس‌های بوق قدرتمند و بم با طنین زنگ خطر ایستگاه آتش‌نشانی و اطفا حریق',
    descEn: 'Heavy low-frequency horn blasts for fire fighting and emergency response',
    badge: 'اعلام حریق',
    color: 'red',
    frequencyPattern: '440Hz + 554Hz Dual Horn',
    loopIntervalMs: 1500,
  },
  {
    id: 'siren_air_raid',
    titleFa: 'آژیر وضعیت قرمز و بحران سراسری',
    titleEn: 'Wailing / Red Alert Siren',
    descFa: 'آژیر نوسانی ممتد با اوج و فرود جهت شرایط اضطراری سطح ۱ و اعلام خطر عمومی',
    descEn: 'Continuous undulating wail for code-red industrial crises and air-raid alerts',
    badge: 'وضعیت قرمز',
    color: 'purple',
    frequencyPattern: '650Hz - 950Hz Warble',
    loopIntervalMs: 1600,
  },
  {
    id: 'siren_pulsed_hazard',
    titleFa: 'آژیر منقطع خطر حاد و توقف کار',
    titleEn: 'Pulsed High-Danger Alert',
    descFa: 'بوق‌های سه‌گانه ضربه‌ای با الگوی ISO 7731 جهت توقف فوری کلیه عملیات‌های بحرانی',
    descEn: 'Triple intermittent high-urgency bursts for immediate work cessation',
    badge: 'توقف فوری کار',
    color: 'orange',
    frequencyPattern: '1200Hz Triple Burst',
    loopIntervalMs: 1200,
  },
  {
    id: 'siren_standard_hse',
    titleFa: 'آژیر استاندارد HSECORE',
    titleEn: 'Standard HSECORE Synth Siren',
    descFa: 'آژیر سینت پیش‌فرض سامانه با ترکیب امواج اره‌ای و سینوسی دوگانه متناوب',
    descEn: 'Established dual-wave HSECORE standard alert tone',
    badge: 'استاندارد سامانه',
    color: 'emerald',
    frequencyPattern: '940Hz / 680Hz Stepped',
    loopIntervalMs: 1600,
  },
];

let activeCustomAudio: HTMLAudioElement | null = null;
let activeSirenLoopTimer: number | null = null;
let activeSirenType: string | null = null;
let activePreviewTimer: number | null = null;

export function stopNotificationAudio(): void {
  if (activeCustomAudio) {
    try {
      activeCustomAudio.pause();
      activeCustomAudio.currentTime = 0;
    } catch {}
    activeCustomAudio = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: false } }));
    }
  }
}

export function isSirenLoopActive(): boolean {
  return activeSirenLoopTimer !== null || activeCustomAudio !== null;
}

export function getActiveSirenType(): string | null {
  return activeSirenType;
}

// 1. Evacuation Siren: 500Hz -> 1100Hz -> 500Hz sweep
function playSirenEvacuation(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const duration = 1.25;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'sine';

  osc1.frequency.setValueAtTime(520, now);
  osc1.frequency.linearRampToValueAtTime(1150, now + 0.6);
  osc1.frequency.linearRampToValueAtTime(520, now + duration);

  osc2.frequency.setValueAtTime(260, now);
  osc2.frequency.linearRampToValueAtTime(575, now + 0.6);
  osc2.frequency.linearRampToValueAtTime(260, now + duration);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(masterVol * 0.45, now + 0.08);
  gain.gain.setValueAtTime(masterVol * 0.45, now + duration - 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

// 2. Toxic Gas Leak: Rapid Staccato Bursts (1050Hz / 780Hz)
function playSirenGasLeak(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const pulses = [
    { freq: 1050, time: 0, dur: 0.16 },
    { freq: 780,  time: 0.22, dur: 0.16 },
    { freq: 1050, time: 0.44, dur: 0.16 },
    { freq: 780,  time: 0.66, dur: 0.22 },
  ];

  pulses.forEach((p) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(p.freq, now + p.time);

    gain.gain.setValueAtTime(0.001, now + p.time);
    gain.gain.linearRampToValueAtTime(masterVol * 0.38, now + p.time + 0.02);
    gain.gain.setValueAtTime(masterVol * 0.38, now + p.time + p.dur - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + p.time + p.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + p.time);
    osc.stop(now + p.time + p.dur + 0.01);
  });
}

// 3. Fire Klaxon / Horn: Dual Tone 440Hz + 554Hz Lowpass Filtered
function playSirenFireHorn(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const duration = 0.95;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';

  osc1.frequency.setValueAtTime(440, now); // A4
  osc2.frequency.setValueAtTime(554.37, now); // C#5 (Major Third for heavy industrial horn)

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(masterVol * 0.5, now + 0.06);
  gain.gain.setValueAtTime(masterVol * 0.5, now + duration - 0.12);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

// 4. Air Raid / Red Alert: Undulating Warble Siren (650Hz - 950Hz)
function playSirenAirRaid(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const duration = 1.5;

  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const gain = ctx.createGain();

  carrier.type = 'sawtooth';
  carrier.frequency.setValueAtTime(800, now);

  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(3.5, now); // 3.5 cycles per second wail

  modGain.gain.setValueAtTime(160, now); // Modulate +/- 160Hz (640Hz to 960Hz)

  modulator.connect(carrier.frequency);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(masterVol * 0.42, now + 0.1);
  gain.gain.setValueAtTime(masterVol * 0.42, now + duration - 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  carrier.connect(gain);
  gain.connect(ctx.destination);

  modulator.start(now);
  carrier.start(now);
  modulator.stop(now + duration);
  carrier.stop(now + duration);
}

// 5. Pulsed Hazard / Work Cessation: 3 Sharp 1200Hz bursts
function playSirenPulsedHazard(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const bursts = [0, 0.22, 0.44];

  bursts.forEach((timeOffset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now + timeOffset);

    gain.gain.setValueAtTime(0.001, now + timeOffset);
    gain.gain.linearRampToValueAtTime(masterVol * 0.48, now + timeOffset + 0.02);
    gain.gain.setValueAtTime(masterVol * 0.48, now + timeOffset + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + timeOffset);
    osc.stop(now + timeOffset + 0.17);
  });
}

// 6. Standard HSE Synth: Alternating 940Hz and 680Hz stepped
function playSynthCriticalSiren(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const duration = 1.5;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'sine';

  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const t = now + (i * duration) / steps;
    const freq = i % 2 === 0 ? 940 : 680;
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq / 2, t);
  }

  gain.gain.setValueAtTime(masterVol * 0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

/**
 * Dispatch specific siren sound once
 */
export function playSpecificSirenOnce(
  ctx: AudioContext,
  sirenType: HseSirenType | string = 'siren_evacuation',
  volume: number = 0.8
): void {
  const vol = Math.max(0, Math.min(1, volume));
  if (vol <= 0) return;

  switch (sirenType) {
    case 'siren_evacuation':
      playSirenEvacuation(ctx, vol);
      break;
    case 'siren_gas_leak':
      playSirenGasLeak(ctx, vol);
      break;
    case 'siren_fire_horn':
      playSirenFireHorn(ctx, vol);
      break;
    case 'siren_air_raid':
      playSirenAirRaid(ctx, vol);
      break;
    case 'siren_pulsed_hazard':
      playSirenPulsedHazard(ctx, vol);
      break;
    case 'siren_standard_hse':
    default:
      playSynthCriticalSiren(ctx, vol);
      break;
  }
}

/**
 * Start continuous looping emergency siren for popup alert
 * Loops continuously until stopSirenLoop() is called when the user confirms the alert!
 */
export function startSirenLoop(
  sirenType: HseSirenType | string = 'siren_evacuation',
  volume: number = 0.85,
  customAudioUrl?: string
): void {
  // Clear any existing active loop
  stopSirenLoop();

  activeSirenType = sirenType;

  // Custom MP3 loop support if configured
  if (customAudioUrl) {
    try {
      const audio = new Audio(customAudioUrl);
      audio.loop = true;
      audio.volume = Math.max(0, Math.min(1, volume));
      activeCustomAudio = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[HSE Custom Siren Loop blocked or failed, fallback to synth]:', err);
          activeCustomAudio = null;
          // Fall back to synth loop
          startSynthSirenLoop(sirenType, volume);
        });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_siren_loop_state', {
          detail: { isPlaying: true, sirenType, volume }
        }));
      }
      return;
    } catch {
      // Fall through to synth loop
    }
  }

  startSynthSirenLoop(sirenType, volume);
}

function startSynthSirenLoop(sirenType: string, volume: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const def = HSE_SIREN_CATALOG.find((s) => s.id === sirenType) || HSE_SIREN_CATALOG[0];
  const interval = def.loopIntervalMs || 1500;

  // Play immediately once
  playSpecificSirenOnce(ctx, sirenType, volume);

  // Set interval loop
  activeSirenLoopTimer = window.setInterval(() => {
    const currentCtx = getAudioContext();
    if (currentCtx) {
      if (currentCtx.state === 'suspended') {
        currentCtx.resume().catch(() => {});
      }
      playSpecificSirenOnce(currentCtx, sirenType, volume);
    }
  }, interval);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hse_siren_loop_state', {
      detail: { isPlaying: true, sirenType, volume }
    }));
  }
}

/**
 * Immediately stop continuous siren loop (called when user acknowledges the alert)
 */
export function stopSirenLoop(): void {
  if (activeSirenLoopTimer !== null) {
    clearInterval(activeSirenLoopTimer);
    activeSirenLoopTimer = null;
  }
  if (activePreviewTimer !== null) {
    clearTimeout(activePreviewTimer);
    activePreviewTimer = null;
  }
  activeSirenType = null;
  stopNotificationAudio();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hse_siren_loop_state', {
      detail: { isPlaying: false }
    }));
  }
}

/**
 * Preview siren sound for dispatcher before broadcasting (3-4 seconds sample)
 */
export function previewSiren(
  sirenType: HseSirenType | string,
  durationSeconds: number = 3.5,
  volume: number = 0.8
): void {
  stopSirenLoop();

  startSirenLoop(sirenType, volume);

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
        playPromise.catch((err) => {
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
      // Dual Attention Beep (850Hz -> 850Hz double pulse)
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
      // Descending warning buzz
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
      // Harmonious Major Triad Chime (C5 -> E5 -> G5)
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
      // Info: Pleasant crystalline chime (587.33Hz D5 + 880Hz A5)
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
