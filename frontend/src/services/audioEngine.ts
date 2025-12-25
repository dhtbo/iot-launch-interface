export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmRetryCount: number = 0;
  private retryTimeout: number | null = null;
  private soundFiles = {
    BGM: '/sounds/bgm.mp3',
    WAVE: '/sounds/step1.mp3',
    HEART: '/sounds/step2.mp3',
    LAUNCH: '/sounds/step3.mp3'
  };
  public async init() {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          await this.preloadSounds();
        } else {
          return;
        }
      } catch {
        return;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {}
    }
  }
  private async preloadSounds() {
    if (!this.ctx) return;
    const promises = Object.entries(this.soundFiles).map(async ([key, path]) => {
      try {
        const response = await fetch(path);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            this.ctx!.decodeAudioData(
                arrayBuffer, 
                (buf) => resolve(buf), 
                (err) => reject(err)
            );
        });
        this.buffers.set(key, audioBuffer);
      } catch {}
    });
    await Promise.allSettled(promises);
  }
  public playBGM() {
    if (!this.ctx) return;
    if (this.bgmSource) return;
    const buffer = this.buffers.get('BGM');
    if (!buffer) {
      if (this.bgmRetryCount < 10) {
        this.bgmRetryCount++;
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
        this.retryTimeout = window.setTimeout(() => this.playBGM(), 500);
      }
      return;
    }
    try {
        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.5;
        this.bgmSource.connect(gain);
        gain.connect(this.ctx.destination);
        this.bgmSource.start(0);
        this.bgmRetryCount = 0;
    } catch {}
  }
  public stopBGM() {
    if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
    }
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
        this.bgmSource.disconnect();
      } catch {}
      this.bgmSource = null;
    }
  }
  private playSound(key: string) {
    if (!this.ctx) return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = 1.0; 
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);
    } catch {}
  }
  public playWaveSFX() { this.playSound('WAVE'); }
  public playHeartSFX() { this.playSound('HEART'); }
  public playLaunchSFX() { this.playSound('LAUNCH'); }
}
export const audioEngine = new AudioEngine();
