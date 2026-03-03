"use client";

import { useEffect, useMemo, useState } from "react";

import OpenAIRealtimeApp from "./OpenAIRealtimeApp";
import GeminiRealtimeApp from "./GeminiRealtimeApp";

import { getPersonalityById } from "@/db/personalities";
import { createClient } from "@/utils/supabase/client";
import { GeminiAPIProvider } from "./contexts/GeminiAPIContext";
import { TranscriptProvider } from "./contexts/TranscriptContext";
import { EventProvider } from "./contexts/EventContext";
import { ConversationTarget } from "./lib/promptContext";

interface AppProps {
  personalityIdState: string;
  isDoctor: boolean;
  user: IUser;
  usageLimitExceeded: boolean;
  autoStart?: boolean;
  conversationTarget?: ConversationTarget;
  jobId?: string | null;
  actionId?: string | null;
  actionStartedAt?: number | null;
  onClose?: () => void;
}

function App({
  personalityIdState,
  isDoctor,
  user,
  usageLimitExceeded,
  autoStart = false,
  conversationTarget = "patient",
  jobId = null,
  actionId = null,
  actionStartedAt = null,
  onClose,
}: AppProps) {
  const supabase = useMemo(() => createClient(), []);
  const [personality, setPersonality] = useState<IPersonality | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const fetchPersonality = async () => {
      setLoading(true);
      try {
        if (!personalityIdState) {
          if (!cancelled) {
            setPersonality(null);
          }
          return;
        }
        const personalityData = await getPersonalityById(supabase, personalityIdState);
        if (!cancelled) {
          setPersonality(personalityData);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchPersonality();

    return () => {
      cancelled = true;
    };
  }, [personalityIdState, supabase]);

  if (loading || !personality) {
    return null;
  }

  if (personality.provider === "gemini") {
    return (
      <TranscriptProvider>
        <EventProvider>
          <GeminiAPIProvider>
            <GeminiRealtimeApp
              personality={personality}
              isDoctor={isDoctor}
              user={user}
              usageLimitExceeded={usageLimitExceeded}
              autoStart={autoStart}
              conversationTarget={conversationTarget}
              jobId={jobId}
              actionId={actionId}
              actionStartedAt={actionStartedAt}
              onClose={onClose}
            />
          </GeminiAPIProvider>
        </EventProvider>
      </TranscriptProvider>
    );
  }

  return (
    <TranscriptProvider>
      <EventProvider>
        <OpenAIRealtimeApp
          personality={personality}
          isDoctor={isDoctor}
          user={user}
          usageLimitExceeded={usageLimitExceeded}
          autoStart={autoStart}
          conversationTarget={conversationTarget}
          jobId={jobId}
          actionId={actionId}
          actionStartedAt={actionStartedAt}
          onClose={onClose}
        />
      </EventProvider>
    </TranscriptProvider>
  );
}

export default App;
