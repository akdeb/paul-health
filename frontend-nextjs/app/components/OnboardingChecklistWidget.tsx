import { CheckCircle2, ListChecks } from "lucide-react";

import { FeatureCard } from "@/components/feature-card";
import {
  ONBOARDING_CHECKLIST_TASKS,
  type OnboardingChecklistItem,
} from "@/lib/onboarding";

type OnboardingChecklistWidgetProps = {
  incomplete: OnboardingChecklistItem[];
  completedCount: number;
  totalCount: number;
  complete: boolean;
};

const statusEmojiClassName = "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-base";
const progressPillClassName = "shrink-0 rounded-full bg-black px-3 py-1 text-sm font-medium text-white";

export default function OnboardingChecklistWidget({
  incomplete,
  completedCount,
  totalCount,
  complete,
}: OnboardingChecklistWidgetProps) {
  if (complete) {
    return (
      <FeatureCard
        title={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Onboarding complete
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-700">
              {completedCount}/{totalCount} complete
            </span>
          </div>
        }
        titleClassName="w-full text-xl"
        className="bg-emerald-50/70"
      />
    );
  }

  const incompleteKeys = new Set(incomplete.map((item) => item.key));
  const orderedTasks = [
    ...ONBOARDING_CHECKLIST_TASKS.filter((task) => incompleteKeys.has(task.key)),
    ...ONBOARDING_CHECKLIST_TASKS.filter((task) => !incompleteKeys.has(task.key)),
  ];

  return (
    <FeatureCard
      title={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Onboarding checklist
          </span>
          <span className={progressPillClassName}>
            {completedCount}/{totalCount} complete
          </span>
        </div>
      }
      titleClassName="w-full text-2xl"
      contentClassName="pt-1"
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {orderedTasks.map((task) => {
            const isIncomplete = incompleteKeys.has(task.key);
            return (
            <div
              key={task.key}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${
                isIncomplete
                  ? "border-gray-200 bg-white text-[#101820]"
                  : "border-emerald-100 bg-emerald-50/60 text-emerald-800"
              }`}
            >
              <span className={statusEmojiClassName} aria-hidden="true">
                {isIncomplete ? "⌛" : "✅"}
              </span>
              <div className="text-sm font-semibold leading-tight">
                {task.title}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </FeatureCard>
  );
}
