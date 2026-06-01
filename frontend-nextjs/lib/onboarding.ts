export type OnboardingChecklistItem = {
  key:
    | "identity_and_role"
    | "ai_disclosure"
    | "conversation_capability"
    | "proactive_checkins"
    | "reminders_and_day_context"
    | "how_to_interact"
    | "escape_hatches"
    | "acknowledge_weirdness"
    | "preferred_name"
    | "important_people"
    | "interests"
    | "emotional_checkin"
    | "close_intro";
  complete: boolean;
  completed_at?: string;
};

export const DEFAULT_ONBOARDING_CHECKLIST: OnboardingChecklistItem[] = [
  { key: "identity_and_role", complete: false },
  { key: "ai_disclosure", complete: false },
  { key: "conversation_capability", complete: false },
  { key: "proactive_checkins", complete: false },
  { key: "reminders_and_day_context", complete: false },
  { key: "how_to_interact", complete: false },
  { key: "escape_hatches", complete: false },
  { key: "acknowledge_weirdness", complete: false },
  { key: "preferred_name", complete: false },
  { key: "important_people", complete: false },
  { key: "interests", complete: false },
  { key: "emotional_checkin", complete: false },
  { key: "close_intro", complete: false },
];

export const createDefaultOnboardingChecklist = (): OnboardingChecklistItem[] =>
  DEFAULT_ONBOARDING_CHECKLIST.map((item) => ({ ...item }));
