"use client";

import { audioContext as getAudioContext } from "./audioContext";

export class PCMPlayer {
  private ctxPromise: Promise<AudioContext> | null = null;
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private idleResolvers: Array<() => void> = [];

  constructor(private sampleRate = 24000) {}

  private async ensureContext() {
    if (!this.ctxPromise) {
      this.ctxPromise = getAudioContext({ sampleRate: this.sampleRate, id: "gemini-playback" });
    }
    this.ctx = await this.ctxPromise;
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch {
        // ignore
      }
    }
    if (this.nextTime < this.ctx.currentTime) {
      this.nextTime = this.ctx.currentTime;
    }
    return this.ctx;
  }

  async play(pcm: ArrayBuffer) {
    const ctx = await this.ensureContext();

    const int16 = new Int16Array(pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = Math.max(-1, Math.min(1, int16[i] / 32768));
    }

    const buffer = ctx.createBuffer(1, float32.length, this.sampleRate);
    buffer.copyToChannel(float32, 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) {
        this.flushIdleResolvers();
      }
    };

    const startAt = Math.max(this.nextTime, ctx.currentTime);
    src.start(startAt);
    this.nextTime = startAt + buffer.duration;
  }

  async stop() {
    const ctx = await this.ensureContext();
    // Stop any already-scheduled sources; otherwise they will keep playing even if we
    // reset nextTime (causes overlapping "old buffer" audio after interrupts).
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    this.sources.clear();
    this.nextTime = ctx.currentTime;
    this.flushIdleResolvers();
  }

  async waitForIdle() {
    if (this.sources.size === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private flushIdleResolvers() {
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
