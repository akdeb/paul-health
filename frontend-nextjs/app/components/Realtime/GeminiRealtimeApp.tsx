"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { EndSensitivity, Modality, Part } from "@google/genai";

import BottomToolbar from "./components/BottomToolbar";
import Transcript from "./components/Transcript";

import { SessionStatus } from "./types";
import { useTranscript } from "./contexts/TranscriptContext";
import { useLiveAPIContext } from "./contexts/GeminiAPIContext";
import { AudioRecorder } from "./lib/audioRecorder";
import { PCMPlayer } from "./lib/pcmPlayer";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { createClient } from "@/utils/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface GeminiRealtimeAppProps {
  personality: IPersonality;
  isDoctor: boolean;
  user: IUser;
  usageLimitExceeded: boolean;
  autoStart?: boolean;
}

function GeminiRealtimeApp({ personality, isDoctor, user, usageLimitExceeded, autoStart = false }: GeminiRealtimeAppProps) {
  const userId = user.user_id;
  const supabase = createClient();

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
    updateTranscriptMessage,
    updateTranscriptItemStatus,
  } = useTranscript();

  const { client, connected, connect, disconnect, setConfig, setModel, model } = useLiveAPIContext();

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
  const [userText, setUserText] = useState<string>("");

  const geminiRecorderRef = useRef<AudioRecorder | null>(null);
  const geminiPlayerRef = useRef<PCMPlayer | null>(null);
  const geminiAssistantMessageIdRef = useRef<string | null>(null);
  const geminiUserMessageIdRef = useRef<string | null>(null);
  const geminiInputTranscriptRef = useRef<string>("");
  const geminiOutputTranscriptRef = useRef<string>("");
  const geminiSessionOpenedRef = useRef(false);

  const [geminiInputVolume, setGeminiInputVolume] = useState(0);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const mergeStreamingTranscript = useCallback((prev: string, next: string) => {
    const cleanedNext = next.replace(/\s+/g, " ").trim();
    if (!cleanedNext) return prev;

    const cleanedPrev = prev.replace(/\s+/g, " ").trim();
    if (!cleanedPrev) return cleanedNext;

    // Some Gemini streams send full replacement transcripts; others send incremental chunks.
    // If the new transcript already contains the previous transcript as a prefix, treat it
    // as a replacement. Otherwise, append (token/word streaming).
    if (cleanedNext.startsWith(cleanedPrev)) {
      return cleanedNext;
    }

    // Avoid accidental duplication when overlap exists.
    if (cleanedPrev.endsWith(cleanedNext)) {
      return cleanedPrev;
    }

    return `${cleanedPrev} ${cleanedNext}`.replace(/\s+/g, " ").trim();
  }, []);

  useEffect(() => {
    const modelName = "models/gemini-2.5-flash-native-audio-preview-12-2025";
    setModel(modelName);
    setConfig({
      responseModalities: [Modality.AUDIO],
    });
  }, [personality, setConfig, setModel]);

  useEffect(() => {
    if (connected) {
      void disconnectFromGeminiRealtime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personality]);

  useEffect(() => {
    if (!geminiRecorderRef.current) {
      geminiRecorderRef.current = new AudioRecorder(16000);
    }
    if (!geminiPlayerRef.current) {
      // Gemini native audio preview typically returns 24kHz PCM
      geminiPlayerRef.current = new PCMPlayer(24000);
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--volume",
      `${Math.max(5, Math.min(geminiInputVolume * 200, 8))}px`
    );
  }, [geminiInputVolume]);

  const sendGeminiAudio = useCallback(
    (base64: string) => {
      if (!client) return;
      client.sendRealtimeInput([
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ]);
    },
    [client]
  );

  useEffect(() => {
    if (!autoStart) return;
    if (sessionStatus !== "DISCONNECTED") return;
    setIsSheetOpen(true);
    void connectToGeminiRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    const recorder = geminiRecorderRef.current;
    if (!recorder) return;

    const handleVolume = (volumeLevel: number) => {
      setGeminiInputVolume(volumeLevel);
    };

    recorder.on("volume", handleVolume);

    if (connected) {
      recorder.on("data", sendGeminiAudio);
      recorder.start().catch((error) => {
        console.error("Failed to start audio recorder", error);
      });
    } else {
      recorder.off("data", sendGeminiAudio);
      recorder.stop();
    }

    return () => {
      recorder.off("data", sendGeminiAudio);
      recorder.off("volume", handleVolume);
      recorder.stop();
    };
  }, [connected, sendGeminiAudio]);

  useEffect(() => {
    if (connected) {
      if (!geminiSessionOpenedRef.current) {
        setSessionStatus("CONNECTED");
        addTranscriptBreadcrumb(`Gemini session started at ${new Date().toLocaleString()}`);
        geminiSessionOpenedRef.current = true;
      }
    } else {
      geminiSessionOpenedRef.current = false;
      if (sessionStatus === "CONNECTED") {
        setSessionStatus("DISCONNECTED");
      }
      geminiAssistantMessageIdRef.current = null;
    }
  }, [connected, addTranscriptBreadcrumb, sessionStatus]);

  useEffect(() => {
    if (!client) return;
    const player = geminiPlayerRef.current;
    if (!player) return;

    const handleAudio = (data: ArrayBuffer) => {
      setIsAssistantSpeaking(true);
      player.play(data).catch((e) => {
        console.error("Failed to play Gemini audio", e);
      });
    };

    client.on("audio", handleAudio);

    const finalizeAssistantTurn = async () => {
      void player.stop();
      setIsAssistantSpeaking(false);
      if (geminiAssistantMessageIdRef.current) {
        updateTranscriptItemStatus(geminiAssistantMessageIdRef.current, "DONE");
        geminiAssistantMessageIdRef.current = null;
      }
      geminiOutputTranscriptRef.current = "";
    };

    const handleInputTranscription = (text: string) => {
      // Gemini often streams partial transcripts. Accumulate into a single user turn.
      geminiInputTranscriptRef.current = mergeStreamingTranscript(
        geminiInputTranscriptRef.current,
        text,
      );
      if (!geminiInputTranscriptRef.current) return;

      if (!geminiUserMessageIdRef.current) {
        const id = uuidv4().slice(0, 32);
        geminiUserMessageIdRef.current = id;
        addTranscriptMessage(id, "user", geminiInputTranscriptRef.current);
      } else {
        updateTranscriptMessage(
          geminiUserMessageIdRef.current,
          geminiInputTranscriptRef.current,
          false,
        );
      }
    };

    const handleOutputTranscription = (text: string) => {
      geminiOutputTranscriptRef.current = mergeStreamingTranscript(
        geminiOutputTranscriptRef.current,
        text,
      );
      if (!geminiOutputTranscriptRef.current) return;

      if (!geminiAssistantMessageIdRef.current) {
        const id = uuidv4().slice(0, 32);
        geminiAssistantMessageIdRef.current = id;
        addTranscriptMessage(id, "assistant", geminiOutputTranscriptRef.current);
      } else {
        updateTranscriptMessage(
          geminiAssistantMessageIdRef.current,
          geminiOutputTranscriptRef.current,
          false,
        );
      }
    };

    const handleGenerationComplete = () => {
      void finalizeAssistantTurn();
      if (geminiUserMessageIdRef.current) {
        updateTranscriptItemStatus(geminiUserMessageIdRef.current, "DONE");
        geminiUserMessageIdRef.current = null;
      }
      geminiInputTranscriptRef.current = "";
    };

    client.on("inputtranscription", handleInputTranscription);
    client.on("outputtranscription", handleOutputTranscription);
    client.on("generationcomplete", handleGenerationComplete);
    client.on("turncomplete", finalizeAssistantTurn);
    client.on("interrupted", finalizeAssistantTurn);

    return () => {
      client.off("audio", handleAudio);
      client.off("inputtranscription", handleInputTranscription);
      client.off("outputtranscription", handleOutputTranscription);
      client.off("generationcomplete", handleGenerationComplete);
      client.off("turncomplete", finalizeAssistantTurn);
      client.off("interrupted", finalizeAssistantTurn);
    };
  }, [client, addTranscriptMessage, updateTranscriptMessage, updateTranscriptItemStatus]);

  useEffect(() => {
    // Intentionally disabled: naive volume-based barge-in triggers on speaker echo.
    // Prefer Gemini server-side interruption + proper echo cancellation.
  }, []);

  const connectToGeminiRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") {
      console.warn("[Gemini] already connecting or connected, ignoring");
      return;
    }
    setSessionStatus("CONNECTING");

    try {
      const response = await fetch("/api/gemini/token", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to get ephemeral token");
      }
      const data = await response.json();
      const freshToken = data.token;

      const fullConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: personality.oai_voice,
            },
          },
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            silenceDurationMs: 200,
          },
        },
        systemInstruction: {
          parts: [{ text: personality.character_prompt ?? "" }],
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        proactivity: { proactiveAudio: true },
      };

      const ok = await connect(model, fullConfig, freshToken);
      if (!ok) {
        throw new Error("Failed to connect to Gemini Live");
      }
      setConfig(fullConfig);

      addTranscriptMessage(uuidv4().slice(0, 32), "user", "[Audio message]");
    } catch (error) {
      console.error("[Gemini] Connection failed:", error);
      toast({
        title: "Gemini connection failed",
        description: error instanceof Error ? error.message : "Unable to establish realtime session.",
        variant: "destructive",
      });
      setSessionStatus("DISCONNECTED");
      throw error;
    }
  };

  const disconnectFromGeminiRealtime = async () => {
    try {
      await disconnect();
    } finally {
      geminiRecorderRef.current?.stop();
      await geminiPlayerRef.current?.stop();
      if (geminiAssistantMessageIdRef.current) {
        updateTranscriptItemStatus(geminiAssistantMessageIdRef.current, "DONE");
        geminiAssistantMessageIdRef.current = null;
      }
      geminiSessionOpenedRef.current = false;
      setSessionStatus("DISCONNECTED");
    }
  };

  const onToggleConnection = async () => {
    if (usageLimitExceeded) {
      toast({
        title: "Usage limit exceeded",
        description: "You have exceeded your monthly usage limit.",
        variant: "destructive",
      });
      return;
    }

    if (sessionStatus === "DISCONNECTED") {
      setIsSheetOpen(true);
      try {
        await connectToGeminiRealtime();
      } catch (err) {
        console.error("[Gemini] onToggleConnection catch:", err);
        setIsSheetOpen(false);
      }
    } else {
      await disconnectFromGeminiRealtime();
      setIsSheetOpen(false);
    }
  };

  useEffect(() => {
    if (!client) return;
    const handleError = (error: any) => {
      console.error("Gemini realtime error", error);
      toast({
        title: "Gemini error",
        description: error?.message || "Realtime session reported an error.",
        variant: "destructive",
      });
      setSessionStatus("DISCONNECTED");
      geminiSessionOpenedRef.current = false;
    };

    client.on("error", handleError);
    return () => {
      client.off("error", handleError);
    };
  }, [client]);

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);

    if (!open && (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING")) {
      void disconnectFromGeminiRealtime();
    }
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
      {!autoStart ? (
        <div className="inline-block">
          <BottomToolbar
            sessionStatus={sessionStatus}
            onToggleConnection={onToggleConnection}
            isDoctor={isDoctor}
            personality={personality}
          />
        </div>
      ) : null}
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="h-[80vh] md:h-full p-0"
        style={{ maxWidth: isMobile ? "100%" : "50%" }}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-hidden">
            <Transcript
              userText={userText}
              setUserText={setUserText}
              onSendMessage={() => {}}
              canSend={false}
              personality={personality}
              userId={userId}
              supabase={supabase}
              isDoctor={isDoctor}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default GeminiRealtimeApp;
