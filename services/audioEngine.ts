export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmRetryCount: number = 0;
  private retryTimeout: number | null = null;
  
  // Configuration for local sound files
  private soundFiles = {
    BGM: '/sounds/bgm.mp3',
    WAVE: '/sounds/step1.mp3',   // Wave Detected
    HEART: '/sounds/step2.mp3',  // Heart Detected
    LAUNCH: '/sounds/step3.mp3'  // Launch
  };

  constructor() {}

  public async init() {
    // 1. Safe AudioContext Creation
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          // Await preload to ensure we at least start fetching before proceeding
          await this.preloadSounds();
        } else {
          console.error("[AudioEngine] Web Audio API is not supported in this browser.");
          return;
        }
      } catch (e) {
        console.error("[AudioEngine] Failed to create AudioContext:", e);
        return;
      }
    }
    
    // 2. Resume if suspended (Browser Auto-play Policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn("[AudioEngine] Failed to resume AudioContext:", e);
      }
    }
  }

  private async preloadSounds() {
    if (!this.ctx) return;

    const promises = Object.entries(this.soundFiles).map(async ([key, path]) => {
      try {
        const response = await fetch(path);
        if (!response.ok) {
           console.warn(`[AudioEngine] File not found: ${path} (Status: ${response.status})`);
           return;
        }
        const arrayBuffer = await response.arrayBuffer();
        
        // Use a promise wrapper for decodeAudioData to handle older callback-based implementations safely
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            this.ctx!.decodeAudioData(
                arrayBuffer, 
                (buf) => resolve(buf), 
                (err) => reject(err)
            );
        });
        
        this.buffers.set(key, audioBuffer);
        console.log(`[AudioEngine] Loaded ${key}`);
      } catch (error) {
        console.warn(`[AudioEngine] Failed to load/decode ${path}:`, error);
      }
    });
    
    // We wait for all to settle (succeed or fail) so we don't block initialization on one missing file
    await Promise.allSettled(promises);
  }

  public playBGM() {
    if (!this.ctx) return;
    
    // If BGM is already playing, do not restart
    if (this.bgmSource) return;

    // Check if buffer is loaded
    const buffer = this.buffers.get('BGM');
    if (!buffer) {
      if (this.bgmRetryCount < 10) { // Max retry 5 seconds
        console.log('[AudioEngine] BGM loading... retrying in 500ms');
        this.bgmRetryCount++;
        // Clear existing timeout if any
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = window.setTimeout(() => this.playBGM(), 500);
      } else {
        console.warn('[AudioEngine] Gave up waiting for BGM file.');
      }
      return;
    }

    try {
        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;
        
        const gain = this.ctx.createGain();
        gain.gain.value = 0.5; // 50% volume
        
        this.bgmSource.connect(gain);
        gain.connect(this.ctx.destination);
        this.bgmSource.start(0);
        this.bgmRetryCount = 0; // Reset on success
    } catch (e) {
        console.error("[AudioEngine] Error playing BGM", e);
    }
  }

  public stopBGM() {
    // Clear any pending retry
    if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
    }

    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
        this.bgmSource.disconnect();
      } catch(e) {
        // ignore already stopped errors
      }
      this.bgmSource = null;
    }
  }

  private playSound(key: string) {
    if (!this.ctx) return;
    const buffer = this.buffers.get(key);
    if (!buffer) {
        // Just warn once, don't retry for SFX to avoid delayed sounds
        console.warn(`[AudioEngine] Sound ${key} not ready.`);
        return;
    }

    try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        
        const gain = this.ctx.createGain();
        gain.gain.value = 1.0; 

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);
    } catch (e) {
        console.error(`[AudioEngine] Error playing ${key}`, e);
    }
  }

  public playWaveSFX() { this.playSound('WAVE'); }
  public playHeartSFX() { this.playSound('HEART'); }
  public playLaunchSFX() { this.playSound('LAUNCH'); }
}

export const audioEngine = new AudioEngine();