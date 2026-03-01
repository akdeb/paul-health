"use client";

export type ConversationTarget = "patient" | "caregiver";

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
