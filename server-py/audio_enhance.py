"""Lightweight input-audio cleanup for ESP32/browser mic PCM.

Removes DC offset and low-frequency rumble (one-pole high-pass) and applies a
smoothed automatic gain so quiet MEMS-mic audio reaches a usable level for STT
and the peak-based idle detector.

Important: this is a sample-for-sample transform. It does NOT buffer, gate, or
re-time frames, so it cannot reintroduce the turn-taking stalls that server-side
VAD caused. Turn-taking stays device-driven.
"""

from __future__ import annotations

import math

import numpy as np
from loguru import logger

from pipecat.frames.frames import Frame, InputAudioRawFrame
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor


class AudioEnhancementProcessor(FrameProcessor):
    def __init__(
        self,
        *,
        sample_rate: int = 16000,
        hp_cutoff_hz: float = 90.0,
        target_rms: float = 3000.0,
        max_gain: float = 8.0,
        gain_smoothing: float = 0.1,
        noise_rms_floor: float = 60.0,
    ):
        super().__init__()
        # one-pole high-pass coefficient for the given cutoff
        self._alpha = math.exp(-2.0 * math.pi * hp_cutoff_hz / sample_rate)
        self._target_rms = target_rms
        self._max_gain = max_gain
        self._gain_smoothing = gain_smoothing
        # below this RMS the frame is treated as (near) silence: don't boost noise
        self._noise_rms_floor = noise_rms_floor

        # filter + gain state carried across frames (no clicks at frame edges)
        self._prev_x = 0.0
        self._prev_y = 0.0
        self._gain = 1.0

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, InputAudioRawFrame) and frame.audio:
            frame = self._enhance(frame)
        await self.push_frame(frame, direction)

    def _enhance(self, frame: InputAudioRawFrame) -> InputAudioRawFrame:
        x = np.frombuffer(frame.audio, dtype=np.int16).astype(np.float32)
        if x.size == 0:
            return frame

        # one-pole high-pass: y[n] = a * (y[n-1] + x[n] - x[n-1])
        # frames are short (10-20ms of voice), so the recursion is cheap.
        a = self._alpha
        y = np.empty_like(x)
        px, py = self._prev_x, self._prev_y
        for i in range(x.size):
            xi = x[i]
            py = a * (py + xi - px)
            px = xi
            y[i] = py
        self._prev_x, self._prev_y = float(px), float(py)

        # AGC toward target RMS, smoothed so it doesn't pump.
        # Hold gain steady on near-silence so room noise isn't amplified.
        rms = float(np.sqrt(np.mean(y * y))) + 1e-6
        if rms > self._noise_rms_floor:
            desired = min(self._max_gain, self._target_rms / rms)
            self._gain += self._gain_smoothing * (desired - self._gain)
        y *= self._gain

        np.clip(y, -32768.0, 32767.0, out=y)
        return InputAudioRawFrame(
            audio=y.astype(np.int16).tobytes(),
            sample_rate=frame.sample_rate,
            num_channels=frame.num_channels,
        )


def maybe_build_audio_enhancement(
    enabled: bool,
    *,
    sample_rate: int,
    target_rms: float,
    max_gain: float,
) -> AudioEnhancementProcessor | None:
    if not enabled:
        return None
    logger.info(
        "Audio enhancement enabled (sample_rate={}, target_rms={}, max_gain={})",
        sample_rate,
        target_rms,
        max_gain,
    )
    return AudioEnhancementProcessor(
        sample_rate=sample_rate,
        target_rms=target_rms,
        max_gain=max_gain,
    )
