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

export const ONBOARDING_CHECKLIST_TASKS: Array<{
  key: OnboardingChecklistItem["key"];
  title: string;
  description: string;
}> = [
  {
    key: "identity_and_role",
    title: "Introduce Paul",
    description: "Paul says who he is and how he will be around as company.",
  },
  {
    key: "ai_disclosure",
    title: "Explain Paul is AI",
    description: "Paul clearly says he is not a real person.",
  },
  {
    key: "conversation_capability",
    title: "Set trust around conversation",
    description: "Paul explains he can listen, understand, and talk properly.",
  },
  {
    key: "proactive_checkins",
    title: "Set check-in expectation",
    description: "Paul explains he may check in during the day.",
  },
  {
    key: "reminders_and_day_context",
    title: "Explain reminders",
    description: "Paul mentions reminders, the day, and what is happening.",
  },
  {
    key: "how_to_interact",
    title: "Explain how to talk",
    description: "The patient learns they can just start talking.",
  },
  {
    key: "escape_hatches",
    title: "Give escape hatches",
    description: "Paul explains they can stop, pause, or push back.",
  },
  {
    key: "acknowledge_weirdness",
    title: "Acknowledge weirdness",
    description: "Paul names that talking to a device can feel strange.",
  },
  // {
  //   key: "preferred_name",
  //   title: "Ask preferred name",
  //   description: "Paul asks what the patient likes to be called.",
  // },
  // {
  //   key: "important_people",
  //   title: "Ask important people",
  //   description: "Paul asks who matters most in the patient's life.",
  // },
  // {
  //   key: "interests",
  //   title: "Ask interests",
  //   description: "Paul asks what the patient enjoys.",
  // },
  {
    key: "emotional_checkin",
    title: "First emotional check-in",
    description: "Paul asks how the patient is feeling right now.",
  },
  {
    key: "close_intro",
    title: "Close the intro",
    description: "Paul closes onboarding and explains he will be around.",
  },
];

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

export const normalizeOnboardingChecklist = (
  checklist: OnboardingChecklistItem[] | null | undefined,
): OnboardingChecklistItem[] => {
  const byKey = new Map(
    (Array.isArray(checklist) ? checklist : [])
      .filter((item) => ONBOARDING_CHECKLIST_TASKS.some((task) => task.key === item.key))
      .map((item) => [item.key, item]),
  );

  return ONBOARDING_CHECKLIST_TASKS.map((task) => {
    const existing = byKey.get(task.key);
    return {
      key: task.key,
      complete: Boolean(existing?.complete),
      ...(existing?.completed_at ? { completed_at: existing.completed_at } : {}),
    };
  });
};

export const getOnboardingChecklistState = (
  checklist: OnboardingChecklistItem[] | null | undefined,
) => {
  const normalizedChecklist = normalizeOnboardingChecklist(checklist);
  const incomplete = normalizedChecklist.filter((item) => !item.complete);
  const complete = normalizedChecklist.length > 0 && incomplete.length === 0;

  return {
    checklist: normalizedChecklist,
    incomplete,
    completedCount: normalizedChecklist.length - incomplete.length,
    totalCount: normalizedChecklist.length,
    complete,
  };
};
