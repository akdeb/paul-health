"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2 } from "lucide-react";
import { updatePersonality } from "@/db/personalities";
import { useToast } from "@/components/ui/use-toast";
import { geminiVoices } from "@/lib/data";
import EmojiComponent from "./EmojiComponent";

const ACCENT_OPTIONS = [
  { value: "british", label: "British", emoji: "🇬🇧" },
  { value: "irish", label: "Irish", emoji: "🇮🇪" },
  { value: "australian", label: "Australian", emoji: "🇦🇺" },
  { value: "canadian", label: "Canadian", emoji: "🇨🇦" },
  { value: "american", label: "American", emoji: "🇺🇸" },
  { value: "south_african", label: "South African", emoji: "🇿🇦" },
  { value: "indian", label: "Indian", emoji: "🇮🇳" },
  { value: "singaporean", label: "Singaporean", emoji: "🇸🇬" },
  { value: "new_zealand", label: "New Zealand", emoji: "🇳🇿" },
] as const;

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly", emoji: "😊" },
  { value: "professional", label: "Professional", emoji: "👔" },
  { value: "playful", label: "Playful", emoji: "😄" },
  { value: "calm", label: "Calm", emoji: "😌" },
  { value: "direct", label: "Direct", emoji: "🎯" },
  { value: "warm", label: "Warm", emoji: "🤗" },
  { value: "serious", label: "Serious", emoji: "🧐" },
  { value: "energetic", label: "Energetic", emoji: "⚡" },
] as const;

interface SettingsDashboardProps {
  selectedUser: IUser;
  allLanguages: ILanguage[];
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  selectedUser,
}) => {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [formData, setFormData] = useState({
    assistantName: "",
    voice: "" as GeminiVoice | "",
    accent: "" as string,
    tones: [] as string[],
    voiceInstructions: "",
    customInstructions: "",
    firstMessagePrompt: "",
  });

  useEffect(() => {
    const personality = selectedUser.personality;
    if (!personality) {
      setFormData({
        assistantName: "",
        voice: "",
        accent: "",
        tones: [],
        voiceInstructions: "",
        customInstructions: "",
        firstMessagePrompt: "",
      });
      return;
    }

    const voice = (personality.voice ?? "") as GeminiVoice | "";
    const assistantName = personality.title ?? "";
    const customInstructions = personality.character_prompt ?? "";
    const voiceInstructions = personality.voice_prompt ?? "";
    const firstMessagePrompt = personality.first_message_prompt ?? "";

    setFormData({
      assistantName,
      voice,
      accent: personality.accent ?? "",
      tones: personality.tone ?? [],
      voiceInstructions,
      customInstructions,
      firstMessagePrompt,
    });
  }, [selectedUser.personality]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const playVoicePreview = (voiceId: GeminiVoice) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }

    const audio = new Audio(`/gemini_voices/${voiceId}.wav`);
    previewAudioRef.current = audio;
    void audio.play().catch((error) => {
      console.error("Failed to play voice preview", error);
    });
  };

  const toggleTag = (field: "tones", optionValue: string) => {
    setFormData((prev) => {
      const current = prev[field];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [field]: next };
    });
  };

  const setSingleSelect = (field: "accent", optionValue: string) => {
    setFormData((prev) => ({ ...prev, [field]: optionValue }));
  };

  const invalidateUserContextCache = async () => {
    const response = await fetch("/api/cache/user-context", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to invalidate user context cache");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !formData.assistantName.trim() ||
      !formData.voice ||
      !formData.accent ||
      formData.tones.length === 0 ||
      !formData.customInstructions.trim() ||
      !formData.firstMessagePrompt.trim()
    ) {
      toast({
        title: "Missing required fields",
        description: "Fill in the agent name, voice, accent, tone, custom instructions, and first message prompt before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!selectedUser.personality_id) {
        throw new Error("No personality_id found for this user");
      }

      await updatePersonality(supabase, selectedUser.personality_id, {
        provider: "gemini",
        title: formData.assistantName.trim(),
        character_prompt: formData.customInstructions.trim(),
        voice: formData.voice,
        accent: formData.accent,
        tone: formData.tones,
        voice_prompt: formData.voiceInstructions.trim(),
        first_message_prompt: formData.firstMessagePrompt.trim(),
      });
      await invalidateUserContextCache();
      toast({
        title: "Agent updated",
        description: "Agent settings saved to personalities.",
      });
      router.refresh();
    } catch (error) {
      console.error("Error updating personality:", error);
      toast({
        title: "Error",
        description: "Failed to update your agent. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const Heading = () => {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-4 items-center sm:justify-normal justify-between max-w-screen-sm">
          <div className="flex flex-col gap-2 w-full">
            <h1 className="text-lg font-semibold">Agent Settings</h1>
        <p className="text-sm text-gray-500">
          Customize your agent&apos;s personality and behavior to fit your needs.
        </p>
          </div>
        </div>
        {/* <HomePageSubtitles user={selectedUser} page="create" /> */}
      </div>
    );
  };

  return (
    <div className="pb-2 flex min-w-0 flex-col pl-1">
      <Heading />

      <form onSubmit={handleSubmit} className="space-y-6 mt-8 w-full pr-1">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="assistantName">Assistant name</Label>
            <Input
              id="assistantName"
              placeholder="Nova"
              value={formData.assistantName}
              onChange={(e) => setFormData((prev) => ({ ...prev, assistantName: e.target.value }))}
            />
            <p className="text-sm flex justify-between">
              <span className="text-gray-500" />
              <span className="text-gray-500">{formData.assistantName.length}/50</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice">Pick a Gemini voice</Label>
            <p className="text-sm text-gray-500">
              Choose a Gemini voice for your assistant.
            </p>
            <div className="w-full min-w-0 px-2">
              <div className="w-full overflow-x-auto py-2 touch-pan-x">
                <div className="flex w-max gap-3">
                  {geminiVoices.map((voice: VoiceType) => (
                    <div
                      key={voice.id}
                      className={`relative w-48 shrink-0 cursor-pointer rounded-xl border-2 p-4 transition-all hover:scale-[1.02] hover:shadow-lg ${
                        formData.voice === voice.id
                          ? `border-blue-500 shadow-lg ${voice.color} ring-2 ring-blue-200`
                          : `border-gray-200 hover:border-gray-300 ${voice.color} hover:shadow-md`
                      }`}
                      onClick={() => {
                        const voiceId = voice.id as GeminiVoice;
                        setFormData((prev) => ({ ...prev, voice: voiceId }));
                        playVoicePreview(voiceId);
                      }}
                    >
                      <div className="flex flex-col">
                        <div className="flex flex-col items-center gap-3">
                          {voice.emoji && (
                            <div className="text-3xl">
                              <EmojiComponent emoji={voice.emoji} />
                            </div>
                          )}
                          <div className="flex flex-col text-center">
                            <span className="font-semibold text-gray-900">{voice.name}</span>
                            <span className="text-xs text-gray-600 mt-1">{voice.description}</span>
                          </div>
                        </div>
                        {formData.voice === voice.id && (
                          <div className="absolute -top-2 -right-2">
                            <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg">
                              <Check size={12} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accent</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((opt) => {
                const selected = formData.accent === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setSingleSelect("accent", opt.value)}
                  >
                    {opt.label} {opt.emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((opt) => {
                const selected = formData.tones.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => toggleTag("tones", opt.value)}
                  >
                    {!selected && "+"} {opt.label} {opt.emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voiceInstructions">Voice instructions</Label>
            <Textarea
              id="voiceInstructions"
              placeholder="Describe how the assistant should sound beyond accent and tone, such as pacing, warmth, emphasis, or cadence."
              rows={4}
              value={formData.voiceInstructions}
              onChange={(e) => setFormData((prev) => ({ ...prev, voiceInstructions: e.target.value }))}
            />
            <p className="text-sm flex justify-between">
              <span className="text-gray-500" />
              <span className="text-gray-500">{formData.voiceInstructions.length}/1000</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customInstructions">Custom instructions</Label>
            <Textarea
              id="customInstructions"
              placeholder="How should the assistant act? What should it optimize for? Any do/don't rules?"
              rows={6}
              value={formData.customInstructions}
              onChange={(e) => setFormData((prev) => ({ ...prev, customInstructions: e.target.value }))}
            />
            <p className="text-sm flex justify-between">
              <span className="text-gray-500" />
              <span className="text-gray-500">{formData.customInstructions.length}/1000</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstMessagePrompt">First message prompt</Label>
            <Textarea
              id="firstMessagePrompt"
              placeholder="What should the assistant talk about first? (e.g., introduce itself and ask 2 questions)"
              rows={4}
              value={formData.firstMessagePrompt}
              onChange={(e) => setFormData((prev) => ({ ...prev, firstMessagePrompt: e.target.value }))}
            />
            <p className="text-sm flex justify-between">
              <span className="text-gray-500" />
              <span className="text-gray-500">{formData.firstMessagePrompt.length}/300</span>
            </p>
          </div>
        </div>

        <Button
          variant="default"
          className="flex flex-row gap-2 items-center mr-auto"
          type="submit"
size="sm"
          disabled={
            isSubmitting ||
            formData.assistantName === "" ||
            formData.voice === "" ||
            formData.accent === "" ||
            formData.tones.length === 0 ||
            formData.customInstructions === "" ||
            formData.firstMessagePrompt === ""
          }
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          {!isSubmitting && <Check className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  )
};

export default SettingsDashboard;
