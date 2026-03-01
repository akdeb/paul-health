"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import BottomToolbar from "./components/BottomToolbar";

import { AgentConfig, SessionStatus } from "@/app/components/Realtime/types";

import { useTranscript } from "@/app/components/Realtime/contexts/TranscriptContext";
import { useEvent } from "@/app/components/Realtime/contexts/EventContext";
import { useHandleServerEvent } from "./hooks/useHandleServerEvent";

import { createRealtimeConnection } from "./lib/realtimeConnection";
import { toast } from "@/components/ui/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Transcript from "./components/Transcript";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { createClient } from "@/utils/supabase/client";
import {
  buildCharacterInstructions,
  buildOpeningTurnPrompt,
  ConversationTarget,
} from "./lib/promptContext";

interface OpenAIRealtimeAppProps {
  personality: IPersonality;
  isDoctor: boolean;
  user: IUser;
  usageLimitExceeded: boolean;
  autoStart?: boolean;
  conversationTarget?: ConversationTarget;
}

function OpenAIRealtimeApp({
  personality,
  isDoctor,
  user,
  usageLimitExceeded,
  autoStart = false,
  conversationTarget = "patient",
}: OpenAIRealtimeAppProps) {
  const supabase = createClient();
  const userId = user.user_id;

  const { transcriptItems, addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<AgentConfig[] | null>(null);

  const [isSheetOpen, setIsSheetOpen] = useState<boolean>(false);
  const [userText, setUserText] = useState<string>("");

  const isMobile = useMediaQuery("(max-width: 768px)");

  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");

  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(true);

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    if (dcRef.current && dcRef.current.readyState === "open") {
      logClientEvent(eventObj, eventNameSuffix);
      dcRef.current.send(JSON.stringify(eventObj));
    } else {
      logClientEvent({ attemptedEvent: eventObj.type }, "error.data_channel_not_open");
      console.error("Failed to send message - no data channel available", eventObj);
    }
  };

  const handleServerEventRef = useHandleServerEvent({
    setSessionStatus,
    selectedAgentName,
    selectedAgentConfigSet,
    sendClientEvent,
    setSelectedAgentName,
  });

  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      void connectToRealtime();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentName]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      setSessionStatus("DISCONNECTED");
      toast({
        description: "Your API key is likely invalid. Please add it to your env variables.",
      });
      return null;
    }

    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    if (sessionStatus !== "DISCONNECTED") return;
    if (usageLimitExceeded) {
      toast({
        title: "Usage limit exceeded",
        description: "You have exceeded your monthly usage limit.",
        variant: "destructive",
      });
      return;
    }

    setSessionStatus("CONNECTING");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(EPHEMERAL_KEY, audioElementRef);
      pcRef.current = pc;
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
      });
      dc.addEventListener("error", (err: any) => {
        logClientEvent({ error: err }, "data_channel.error");
      });
      dc.addEventListener("message", (e: MessageEvent) => {
        handleServerEventRef.current(JSON.parse(e.data));
      });

      setDataChannel(dc);
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      setSessionStatus("DISCONNECTED");
    }
  };

  const disconnectFromRealtime = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });

      pcRef.current.close();
      pcRef.current = null;
    }
    setDataChannel(null);
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);

    logClientEvent({}, "disconnected");
  };

  const createFirstMessage = () => {
    return buildOpeningTurnPrompt(
      personality?.first_message_prompt ?? "",
      conversationTarget,
      isDoctor,
    );
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent(
      {
        type: "conversation.item.create",
        item: {
          id,
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      },
      "(simulated user text message)"
    );
    sendClientEvent({ type: "response.create" }, "(trigger response after simulated user text message)");
  };

  const updateSession = (shouldTriggerResponse: boolean) => {
    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        instructions: buildCharacterInstructions(
          personality.character_prompt,
          conversationTarget,
        ),
        voice: personality.oai_voice,
      },
    };

    sendClientEvent(sessionUpdateEvent);

    if (shouldTriggerResponse) {
      sendSimulatedUserMessage(createFirstMessage());
    }
  };

  const onToggleConnection = async () => {
    if (sessionStatus === "DISCONNECTED") {
      setIsSheetOpen(true);
      await connectToRealtime();
    } else {
      disconnectFromRealtime();
      setIsSheetOpen(false);
    }
  };

  useEffect(() => {
    if (!autoStart) return;
    if (sessionStatus !== "DISCONNECTED") return;
    setIsSheetOpen(true);
    void connectToRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);

    if (!open && (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING")) {
      disconnectFromRealtime();
    }
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
      {!autoStart ? (
        <SheetTrigger asChild>
          <div className="inline-block">
            <BottomToolbar
              sessionStatus={sessionStatus}
              onToggleConnection={onToggleConnection}
              isDoctor={isDoctor}
              personality={personality}
            />
          </div>
        </SheetTrigger>
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
              onSendMessage={() => sendSimulatedUserMessage(userText)}
              canSend={!!dataChannel && sessionStatus === "CONNECTED"}
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

export default OpenAIRealtimeApp;
