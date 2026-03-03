export type ConversationTarget = "patient" | "caregiver";

export function buildVoiceInstructions(
  voicePrompt: string,
  accent: string,
  tone: string[],
) {
  const parts = [
    voicePrompt.trim(),
    accent ? `Accent: ${accent}` : "",
    tone.length > 0 ? `Tone: ${tone.join(", ")}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}

export function buildCharacterInstructions(
  characterPrompt: string,
  conversationTarget: ConversationTarget,
) {
  const sharedAudienceGuidance =
    "This character may speak with either the dementia patient or the caregiver. Stay in character for both audiences, adapt your tone to who you are speaking with, and never confuse the caregiver with the patient.";

  if (conversationTarget === "caregiver") {
    return `${characterPrompt}\n\n${sharedAudienceGuidance}\n\nFor this conversation, you are speaking to the caregiver. Address the caregiver directly, keep your response supportive and practical, and do not act as if the caregiver is the dementia patient. More context may be provided later.`;
  }

  return `${characterPrompt}\n\n${sharedAudienceGuidance}\n\nFor this conversation, you are speaking to the dementia patient unless the user explicitly tells you otherwise.`;
}

export function buildCompiledSystemPrompt({
  characterPrompt,
  voicePrompt,
  accent,
  tone,
  conversationTarget,
  languageName,
  chatHistory,
  timestamp,
}: {
  characterPrompt: string;
  voicePrompt: string;
  accent: string;
  tone: string[];
  conversationTarget: ConversationTarget;
  languageName?: string | null;
  chatHistory?: string;
  timestamp?: string;
}) {
  const compiledVoicePrompt = buildVoiceInstructions(voicePrompt, accent, tone);
  const sections = [
    buildCharacterInstructions(characterPrompt, conversationTarget),
    compiledVoicePrompt ? `VOICE INSTRUCTIONS:\n${compiledVoicePrompt}` : "",
    chatHistory ? `CHAT HISTORY:\n${chatHistory}` : "",
    timestamp ? `CURRENT TIME:\n${timestamp}` : "",
    `LANGUAGE:\nYou may talk in any language the user would like, but the default language is ${languageName ?? "English"}.`,
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function buildOpeningTurnPrompt(
  firstMessagePrompt: string,
  conversationTarget: ConversationTarget,
  isDoctor: boolean,
) {
  if (isDoctor) {
    return "Ask the doctor if everything is good and how you can help them and their patient.";
  }

  if (conversationTarget === "caregiver") {
    if (firstMessagePrompt) {
      return `Always start the conversation following these instructions from the user: ${firstMessagePrompt}\n\nThis check-in is with the caregiver, not the dementia patient. Speak first, greet the caregiver in character, and ask one short supportive opening question. More context may be provided later.`;
    }

    return "This is a caregiver check-in, not a patient conversation. Speak first, introduce yourself in character to the caregiver, and ask one short supportive opening question. More context may be provided later.";
  }

  return firstMessagePrompt
    ? `Always start the conversation following these instructions from the user: ${firstMessagePrompt}`
    : "The user is initiating a new chat here. Say something!";
}
