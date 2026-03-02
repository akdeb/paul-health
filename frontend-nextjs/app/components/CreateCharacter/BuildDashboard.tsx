"use client";

import React, { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Send } from "lucide-react";
import { getPersonalityById, updatePersonality } from "@/db/personalities";
import { toast } from "@/components/ui/use-toast";
import { z } from "zod";
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

const formSchema = z.object({
  assistantName: z
    .string()
    .min(2, "Minimum 2 characters")
    .max(50, "Maximum 50 characters"),
  voice: z.string().min(1, "Voice selection is required"),
  accent: z.string().min(1, "Pick an accent"),
  tones: z.array(z.string()).min(1, "Pick at least one tone"),
  customInstructions: z
    .string()
    .min(20, "Minimum 20 characters")
    .max(1000, "Maximum 1000 characters"),
  firstMessagePrompt: z
    .string()
    .min(20, "Minimum 20 characters")
    .max(300, "Maximum 300 characters"),
});

type FormData = z.infer<typeof formSchema>;

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  selectedUser,
}) => {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [personality, setPersonality] = useState<IPersonality | null>(
    selectedUser.personality ?? null,
  );

  const [formData, setFormData] = useState({
    assistantName: "",
    voice: "" as GeminiVoice | "",
    accent: "" as string,
    tones: [] as string[],
    customInstructions: "",
    firstMessagePrompt: "",
  });

  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  React.useEffect(() => {
    const run = async () => {
      if (selectedUser.personality_id) {
        const p = await getPersonalityById(supabase, selectedUser.personality_id);
        setPersonality(p);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser.personality_id]);

  React.useEffect(() => {
    if (!personality) return;

    const voice = (personality.oai_voice ?? "") as GeminiVoice | "";
    const assistantName = personality.title ?? "";
    const customInstructions = personality.character_prompt ?? "";
    const firstMessagePrompt = personality.first_message_prompt ?? "";

    const accentMatch = /Accent:\s*(.*)/i.exec(personality.voice_prompt ?? "");
    const toneMatch = /Tone:\s*(.*)/i.exec(personality.voice_prompt ?? "");

    const accentLabel = (accentMatch?.[1] ?? "").trim();
    const accentValue =
      ACCENT_OPTIONS.find((o) => o.label.toLowerCase() === accentLabel.toLowerCase())
        ?.value ??
      "";

    const toneLabels = (toneMatch?.[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tones = toneLabels
      .map((lbl) => TONE_OPTIONS.find((o) => o.label.toLowerCase() === lbl.toLowerCase())?.value)
      .filter(Boolean) as string[];

    setFormData({
      assistantName,
      voice,
      accent: accentValue,
      tones,
      customInstructions,
      firstMessagePrompt,
    });
  }, [personality]);

  const handleBlur = (field: keyof FormData) => {
    // Mark the field as touched
    setTouchedFields(prev => ({ ...prev, [field]: true }));

    // Validate the field
    validateField(field, formData[field] as any);
  };

  const validateField = (field: keyof FormData, value: any) => {
    try {
      formSchema.shape[field].parse(value);
      // Clear error if validation passes
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const zodError = error as z.ZodError;
        setFormErrors(prev => ({ ...prev, [field]: zodError.errors[0].message }));
      }
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Only validate if the field has been touched before
    if (touchedFields[field]) {
      validateField(field, value);
    }
  };

  const toggleTag = (field: "tones", optionValue: string) => {
    setFormData((prev) => {
      const current = prev[field];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [field]: next };
    });

    if (touchedFields[field]) {
      const current = formData[field];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      validateField(field, next);
    }
  };

  const setSingleSelect = (field: "accent", optionValue: string) => {
    setFormData((prev) => ({ ...prev, [field]: optionValue }));
    if (touchedFields[field]) {
      validateField(field, optionValue);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Set submitting state to true
    setIsSubmitting(true);

    // Validate the entire form
    const result = formSchema.safeParse(formData);
    console.log(result);

    if (!result.success) {
      // Extract and set all validation errors
      const errors: Partial<Record<keyof FormData, string>> = {};
      result.error.errors.forEach(err => {
        errors[err.path[0] as keyof FormData] = err.message;
      });
      setFormErrors(errors);
      setIsSubmitting(false); // Reset submitting state
      return;
    }

    try {
      const accentText =
        ACCENT_OPTIONS.find((o) => o.value === formData.accent)?.label ??
        formData.accent;
      const toneText = formData.tones
        .map((v) => TONE_OPTIONS.find((o) => o.value === v)?.label ?? v)
        .join(", ");

      if (!selectedUser.personality_id) {
        throw new Error("No personality_id found for this user");
      }

      const updated = await updatePersonality(supabase, selectedUser.personality_id, {
        provider: "gemini",
        title: formData.assistantName,
        character_prompt: formData.customInstructions,
        oai_voice: formData.voice,
        voice_prompt: `Speak in the following accent: ${accentText}\nSpeak in the following tone: ${toneText}`,
        first_message_prompt: formData.firstMessagePrompt,
      });

      if (updated) {
        setPersonality(updated);
        toast({
          title: "Agent updated",
          description: "Your agent settings have been updated!",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error updating personality:", error);
      toast({
        title: "Error",
        description: "Failed to update your agent. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false); // Reset submitting state
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
    <div className="overflow-hidden pb-2 flex flex-col pl-1">
      <Heading />

      <form onSubmit={handleSubmit} className="space-y-6 mt-8 w-full pr-1">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="assistantName">Assistant name</Label>
            <Input
              id="assistantName"
              placeholder="Nova"
              value={formData.assistantName}
              onChange={(e) => handleInputChange("assistantName", e.target.value)}
              onBlur={() => handleBlur("assistantName")}
            />
            <p className="text-sm flex justify-between">
              <span className={formErrors.assistantName ? "text-red-500" : "text-gray-500"}>
                {formErrors.assistantName}
              </span>
              <span className="text-gray-500">{formData.assistantName.length}/50</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice">Pick a Gemini voice</Label>
            <p className="text-sm text-gray-500">
              Choose a Gemini voice for your assistant.
            </p>
            <div className="overflow-x-auto w-fit px-2">
              <div className="flex gap-3 py-2">
                {geminiVoices.slice(0,3).map((voice: VoiceType) => (
                  <div
                    key={voice.id}
                    className={`relative rounded-xl border-2 p-4 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-lg w-48 flex-shrink-0 ${
                      formData.voice === voice.id
                        ? `border-blue-500 shadow-lg ${voice.color} ring-2 ring-blue-200`
                        : `border-gray-200 hover:border-gray-300 ${voice.color} hover:shadow-md`
                    }`}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, voice: voice.id as GeminiVoice }));
                      if (touchedFields.voice) {
                        validateField("voice", voice.id);
                      }
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
            <p className="text-sm">
              <span className={formErrors.voice ? "text-red-500" : "text-gray-500"}>
                {formErrors.voice}
              </span>
            </p>
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
                    onBlur={() => handleBlur("accent")}
                  >
                    {opt.label} {opt.emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-sm">
              <span className={formErrors.accent ? "text-red-500" : "text-gray-500"}>
                {formErrors.accent}
              </span>
            </p>
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
                    onBlur={() => handleBlur("tones")}
                  >
                    {!selected && "+"} {opt.label} {opt.emoji}
                  </button>
                );
              })}
            </div>
            <p className="text-sm">
              <span className={formErrors.tones ? "text-red-500" : "text-gray-500"}>
                {formErrors.tones}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customInstructions">Custom instructions</Label>
            <Textarea
              id="customInstructions"
              placeholder="How should the assistant act? What should it optimize for? Any do/don't rules?"
              rows={6}
              value={formData.customInstructions}
              onChange={(e) => handleInputChange("customInstructions", e.target.value)}
              onBlur={() => handleBlur("customInstructions")}
            />
            <p className="text-sm flex justify-between">
              <span className={formErrors.customInstructions ? "text-red-500" : "text-gray-500"}>
                {formErrors.customInstructions}
              </span>
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
              onChange={(e) => handleInputChange("firstMessagePrompt", e.target.value)}
              onBlur={() => handleBlur("firstMessagePrompt")}
            />
            <p className="text-sm flex justify-between">
              <span className={formErrors.firstMessagePrompt ? "text-red-500" : "text-gray-500"}>
                {formErrors.firstMessagePrompt}
              </span>
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
          {isSubmitting ? "Saving..." : "Save"} {!isSubmitting && <Check className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  )
};

export default SettingsDashboard;