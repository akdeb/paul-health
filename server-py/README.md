# Pipecat Multi-Transport Bot

This workspace now exposes two access paths to the same Pipecat bot logic:

- Browser WebSocket test UI at `/browser`
- ESP32 WebSocket client at `/ws/esp32`
- Container entrypoint via `uv run server.py`

## What to do next

1. Copy the example environment file:

   ```bash
   cp env.example .env
   ```

2. Add your API keys to `.env`:

   Classic route:
   - `DEEPGRAM_API_KEY`
   - `OPENAI_API_KEY`
   - `CARTESIA_API_KEY`

   Gemini Live route:
   - `GEMINI_API_KEY` or `GOOGLE_API_KEY`

   Grok route:
   - `XAI_API_KEY`

   Route selection:
   - `CURRENT_VOICE_ROUTE=classic` or `CURRENT_VOICE_ROUTE=gem_live` or `CURRENT_VOICE_ROUTE=grok`

   Optional Gemini Live settings:
   - `GEMINI_LIVE_MODEL`
   - `GEMINI_LIVE_VOICE`

   Optional Grok settings:
   - `GROK_VOICE`

3. Install dependencies:

   ```bash
   uv sync
   ```

4. Run the local server:

   ```bash
   uv run server.py
   ```

5. Browser client:

   [http://localhost:7860/browser](http://localhost:7860/browser)

6. ESP32 client:

   `ws://localhost:7860/ws/esp32`

## Notes

- The first run can take around 20 seconds while Pipecat loads models and imports.
- The browser route uses plain WebSocket with raw PCM audio in/out.
- The ESP32 route accepts raw PCM audio input and returns Opus packets over WSS.
- The ESP32 route also emits JSON control messages such as `RESPONSE.CREATED`,
  `AUDIO.COMMITTED`, and `RESPONSE.COMPLETE`.
- `CURRENT_VOICE_ROUTE=classic` uses `Deepgram + OpenAI + Cartesia`.
- `CURRENT_VOICE_ROUTE=gem_live` uses Pipecat `GeminiLiveLLMService` for native
  speech-to-speech.
- `CURRENT_VOICE_ROUTE=grok` uses Pipecat `GrokRealtimeLLMService` for native
  speech-to-speech.
- Route builders are split into [classic_route.py](/Users/akashdeepdeb/Desktop/Projects/pipecat-test/classic_route.py)
  and [gem_live_route.py](/Users/akashdeepdeb/Desktop/Projects/pipecat-test/gem_live_route.py),
  plus [grok_route.py](/Users/akashdeepdeb/Desktop/Projects/pipecat-test/grok_route.py).
- The included [Dockerfile](/Users/akashdeepdeb/Desktop/Projects/pipecat-test/Dockerfile) is
  set up for generic container hosting of this FastAPI app.
