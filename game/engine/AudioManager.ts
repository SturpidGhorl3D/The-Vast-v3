/**
 * AudioManager.ts
 * Manages all game audio using Web Audio API. 
 * Supports both procedural synthesis and pre-loaded asset playback.
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isInitialized = false;
  
  // Cache for pre-loaded audio assets
  private bufferCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.ctx = new AudioContext();
    }
  }

  async init() {
    if (this.isInitialized) return;
    if (!this.ctx) this.ctx = new AudioContext();
    
    await this.ctx.resume();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    
    this.isInitialized = true;
    this.playAmbient();
  }

  /**
   * Loads an audio file and caches it.
   */
  async loadSound(id: string, url: string) {
    if (!this.ctx) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.bufferCache.set(id, audioBuffer);
  }

  /**
   * Plays a pre-loaded sound.
   */
  playSound(id: string, volume: number = 1.0) {
    if (!this.ctx || !this.sfxGain || !this.bufferCache.has(id)) return;
    
    const source = this.ctx.createBufferSource();
    source.buffer = this.bufferCache.get(id)!;
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(this.sfxGain);
    
    source.start();
  }

  setVolumes(master: number, sfx: number, music: number) {
    if (this.masterGain) this.masterGain.gain.value = master;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
    if (this.musicGain) this.musicGain.gain.value = music;
  }

  private playOscillator(type: OscillatorType, freq: number, duration: number, gain: number = 0.1, ramp: "up" | "down" | "flat" = "down") {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    if (ramp === "down") {
      osc.frequency.exponentialRampToValueAtTime(freq / 4, this.ctx.currentTime + duration);
    } else if (ramp === "up") {
      osc.frequency.exponentialRampToValueAtTime(freq * 4, this.ctx.currentTime + duration);
    }

    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(g);
    g.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, freq: number, gain: number, bandwidth: number = 1000) {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = freq / bandwidth; // Control resonance/bandwidth

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start();
  }

  // Placeholder sound methods, will be replaced by playSound calls later
  playProjectileSFX() {
    // Metallic clank + electric fizz
    this.playOscillator('square', 440, 0.03, 0.2, 'flat'); 
    this.playNoise(0.05, 2000, 0.1, 500); 
  }

  playBeamSFX() {
    this.playOscillator('sawtooth', 880, 0.3, 0.05, 'flat');
    this.playOscillator('square', 885, 0.3, 0.03, 'flat');
  }

  playRocketSFX() {
    this.playOscillator('sawtooth', 55, 1.0, 0.4, 'up');
    this.playNoise(0.5, 400, 0.2);
  }

  playWarpSFX() {
    this.playOscillator('sine', 40, 2.0, 0.3, 'up');
    this.playOscillator('triangle', 80, 2.0, 0.2, 'up');
  }

  playAmbient() {
      if (!this.ctx || !this.musicGain) return;
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 150;
      
      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      noise.start();
  }
}

export const audioManager = new AudioManager();
