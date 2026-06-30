"""Audio codec helpers shared across websocket routes."""

from __future__ import annotations

from dataclasses import dataclass

import av
import numpy as np


def boost_limit_pcm16le(pcm_bytes: bytes, gain_db: float = 7.0, ceiling: float = 0.99) -> bytes:
    """Loudness boost with a tanh soft-clip limiter (ported from elato-local).

    Applies gain, then tanh soft-clipping so the signal gets loud without harsh
    digital clipping (tanh is ~linear for small inputs and rolls off smoothly),
    then clamps to +/-ceiling before int16 conversion. Returns new PCM bytes.
    """
    if not pcm_bytes:
        return pcm_bytes

    audio = np.frombuffer(pcm_bytes, dtype=np.int16)
    if audio.size == 0:
        return pcm_bytes

    x = audio.astype(np.float32) / 32768.0
    x *= 10.0 ** (gain_db / 20.0)
    y = np.tanh(x)
    np.clip(y, -ceiling, ceiling, out=y)
    return (y * 32767.0).astype(np.int16).tobytes()


@dataclass
class OpusEncoder:
    sample_rate: int = 24000
    channels: int = 1
    bit_rate: int = 24000
    frame_duration_ms: int = 120

    def __post_init__(self):
        self._codec = av.CodecContext.create("libopus", "w")
        self._codec.sample_rate = self.sample_rate
        self._codec.rate = self.sample_rate
        self._codec.layout = "mono" if self.channels == 1 else "stereo"
        self._codec.format = "s16"
        self._codec.bit_rate = self.bit_rate
        self._codec.options = {
            "application": "voip",
            "frame_duration": str(self.frame_duration_ms),
        }
        self._codec.open()
        self._frame_size = int(self.sample_rate * self.frame_duration_ms / 1000)
        self._bytes_per_frame = self._frame_size * self.channels * 2
        self._buffer = bytearray()

    def encode(self, pcm_audio: bytes) -> list[bytes]:
        packets: list[bytes] = []
        self._buffer.extend(pcm_audio)

        while len(self._buffer) >= self._bytes_per_frame:
            chunk = bytes(self._buffer[: self._bytes_per_frame])
            del self._buffer[: self._bytes_per_frame]

            samples = np.frombuffer(chunk, dtype=np.int16).reshape(self.channels, -1)
            frame = av.AudioFrame.from_ndarray(samples, format="s16", layout=self._codec.layout.name)
            frame.sample_rate = self.sample_rate
            packets.extend(bytes(packet) for packet in self._codec.encode(frame))

        return packets

    def flush(self, pad_final_frame: bool = False) -> list[bytes]:
        if not self._buffer:
            return []

        if not pad_final_frame:
            self._buffer.clear()
            return []

        padded = bytes(self._buffer) + b"\x00" * (self._bytes_per_frame - len(self._buffer))
        self._buffer.clear()
        return self.encode(padded)

    def reset(self):
        self._buffer.clear()

    def close(self):
        self._buffer.clear()
