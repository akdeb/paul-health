"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { LiveConnectConfig } from "@google/genai";
import { GenAILiveClient } from "../lib/geminiLiveClient";

type GeminiAPIContextValue = {
  client: GenAILiveClient | null;
  connected: boolean;
  connect: (model: string, config: LiveConnectConfig, apiKey: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  setConfig: (config: LiveConnectConfig) => void;
  setModel: (model: string) => void;
  config: LiveConnectConfig;
  model: string;
};

const GeminiAPIContext = createContext<GeminiAPIContextValue | undefined>(undefined);

export function GeminiAPIProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<GenAILiveClient | null>(null);
  const [connected, setConnected] = useState(false);

  const [config, setConfig] = useState<LiveConnectConfig>({} as LiveConnectConfig);
  const [model, setModel] = useState<string>(
    "models/gemini-2.5-flash-native-audio-preview-12-2025",
  );

  const connect = async (modelName: string, cfg: LiveConnectConfig, apiKey: string) => {
    // Create a fresh client for each ephemeral token. The token is single-use, so reusing
    // a long-lived client instance can lead to confusing connection failures.
    const newClient = new GenAILiveClient({ apiKey });
    setClient(newClient);

    const ok = await newClient.connect(modelName, cfg);
    setConnected(ok);
    return ok;
  };

  const disconnect = async () => {
    client?.disconnect();
    setConnected(false);
  };

  return (
    <GeminiAPIContext.Provider
      value={{
        client,
        connected,
        connect,
        disconnect,
        setConfig,
        setModel,
        config,
        model,
      }}
    >
      {children}
    </GeminiAPIContext.Provider>
  );
}

export function useLiveAPIContext() {
  const ctx = useContext(GeminiAPIContext);
  if (!ctx) {
    throw new Error("useLiveAPIContext must be used within a GeminiAPIProvider");
  }
  return ctx;
}
