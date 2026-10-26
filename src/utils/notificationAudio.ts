/**
 * HSECORE Central Notification Audio Engine
 * Pure native Web Audio API synthesizer for zero-latency, offline, 100% reliable industrial audio alerts.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
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

// Ensure audio context resumes on first user click anywhere in the window
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export type SoundType = 'critical_hse' | 'warning' | 'error' | 'success' | 'info';

let activeCustomAudio: HTMLAudioElement | null = null;

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

function playSynthCriticalSiren(ctx: AudioContext, masterVol: number): void {
  const now = ctx.currentTime;
  const duration = 1.6;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc2.type = 'sine';

  // Pitch sweep siren alternating 940Hz and 680Hz
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

export function playNotificationSound(
  type: SoundType | string,
  options?: {
    volume?: number;
    forcePlay?: boolean;
    muted?: boolean;
    customAudioUrl?: string;
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
          console.warn('[HSE Custom MP3 Fallback] Falling back to Web Audio synth siren:', err);
          const ctx = getAudioContext();
          if (ctx) playSynthCriticalSiren(ctx, masterVol);
        });
      }
      return;
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_audio_play_state', { detail: { isPlaying: false } }));
      }
      console.warn('[HSE Custom MP3 Error] Falling back to Web Audio synth siren:', err);
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (type === 'critical_hse' || type === 'critical') {
      playSynthCriticalSiren(ctx, masterVol);
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
      // Low descending buzz
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
