"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellRing,
  Flag,
  Globe2,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  Puzzle,
  Trash2,
} from "lucide-react";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  createCareActivity,
  deleteCareActivity,
  updateCareActivity,
} from "@/db/careActivities";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type ScheduleFrequency = "daily" | "weekly" | "specific_days";
type WeekdayValue = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

interface CarePlanManagerProps {
  caregiverId: string;
  patientId: string;
  initialActivities: ICareActivity[];
}

interface CareActivityFormState {
  type: CareActivityType;
  title: string;
  instructions: string;
  enabled: boolean;
  frequency: ScheduleFrequency;
  weekday: WeekdayValue;
  daysOfWeek: WeekdayValue[];
  time: string;
}

type EditorState =
  | {
      mode: "create";
      type: CareActivityType;
    }
  | {
      mode: "edit";
      activity: ICareActivity;
    };

const WEEKDAY_OPTIONS: Array<{ value: WeekdayValue; label: string }> = [
  { value: "SUN", label: "Sun" },
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
];

const ACTIVITY_TYPE_OPTIONS: Array<{
  value: CareActivityType;
  label: string;
  description: string;
  helperPlaceholder: string;
  chipTone: string;
  bgColor: string;
  icon: typeof Flag;
}> = [
  {
    value: "guess_flag",
    label: "Guess the Flag",
    description: "Prompt the patient to identify national flags with gentle hints.",
    helperPlaceholder: "e.g. Give the patient some chances and hints before revealing the answer.",
    chipTone: "bg-sky-100 text-sky-800",
    icon: Flag,
    bgColor: "bg-sky-500",
  },
  {
    value: "guess_capital",
    label: "Guess the Capital",
    description: "Ask geography questions focused on capitals and familiar places.",
    helperPlaceholder: "e.g. Start easy and gradually increase difficulty if they feel engaged.",
    chipTone: "bg-amber-100 text-amber-800",
    icon: Globe2,
    bgColor: "bg-amber-500",
  },
  {
    value: "conversation_news",
    label: "News Conversation",
    description: "Open a supported conversation about current events.",
    helperPlaceholder: "e.g. Talk about current news in the local area and avoid distressing topics.",
    chipTone: "bg-slate-100 text-slate-800",
    icon: Newspaper,
    bgColor: "bg-slate-500",
  },
  {
    value: "medication_reminder",
    label: "Medicine Reminder",
    description: "Deliver reminders to take medicine or follow a care task.",
    helperPlaceholder: "e.g. Remind them to take the blue pill after breakfast and wait patiently.",
    chipTone: "bg-rose-100 text-rose-800",
    icon: BellRing,
    bgColor: "bg-rose-500",
  },
  {
    value: "memory_prompt",
    label: "Memory Prompt",
    description: "Guide the patient into familiar stories, people, and routines.",
    helperPlaceholder: "e.g. Ask about family, favourite songs, and one warm memory from childhood.",
    chipTone: "bg-emerald-100 text-emerald-800",
    icon: Puzzle,
    bgColor: "bg-emerald-500",
  },
];

export default function CarePlanManager({
  caregiverId,
  patientId,
  initialActivities,
}: CarePlanManagerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const { toast } = useToast();
  const [activities, setActivities] = useState(initialActivities);
  const [editorState, setEditorState] = useState<EditorState | null>(null);

  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  const openCreate = (type: CareActivityType) => {
    setEditorState({ mode: "create", type });
  };

  const openEdit = (activity: ICareActivity) => {
    setEditorState({ mode: "edit", activity });
  };

  const closeEditor = () => {
    setEditorState(null);
  };

  const handleSaved = (activity: ICareActivity) => {
    setActivities((prev) => {
      if (editorState?.mode === "edit") {
        return prev.map((item) => (
          item.job_id === activity.job_id ? activity : item
        ));
      }

      return [...prev, activity];
    });

    toast({
      description: editorState?.mode === "edit" ? "Activity saved." : "Activity created.",
    });
    closeEditor();
    router.refresh();
  };

  const handleDeleted = (jobId: string) => {
    setActivities((prev) => prev.filter((item) => item.job_id !== jobId));
    toast({
      description: "Activity removed.",
    });
    closeEditor();
    router.refresh();
  };

  const editorBody = editorState ? (
    <CareActivityEditor
      caregiverId={caregiverId}
      patientId={patientId}
      initialActivity={editorState.mode === "edit" ? editorState.activity : undefined}
      initialType={editorState.mode === "create" ? editorState.type : undefined}
      mode={editorState.mode}
      onCancel={closeEditor}
      onDeleted={handleDeleted}
      onSaved={handleSaved}
    />
  ) : null;

  return (
    <>
      <div className="min-w-0 space-y-8 pb-10">
        <section className="min-w-0 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Activities</h2>
            <p className="text-sm text-gray-500">
              Choose recurring moments for games, reminders, and guided conversation.
            </p>
          </div>

          <div className="w-full min-w-0 overflow-x-auto pb-2">
            <div className="flex w-max min-w-full gap-3 p-2">
              {ACTIVITY_TYPE_OPTIONS.map((activityType) => {
                return (
                 <button
  key={activityType.value}
  type="button"
  onClick={() => openCreate(activityType.value)}
  className={cn("relative w-[260px] shrink-0 rounded-3xl p-4 text-left flex flex-col justify-start transition hover:-translate-y-0.5", activityType.bgColor)}
>
  {/* Add button (top right) */}
  <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
    <Plus className="h-4 w-4 text-white" />
  </div>

  {/* Title */}
  <h3 className="text-2xl font-semibold w-3/4 text-white pr-8">
    {activityType.label}
  </h3>

  {/* Subtitle */}
  <p className="mt-2 text-sm leading-5 text-white/80">
    {activityType.description}
  </p>
</button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Scheduled activities</h2>
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => openCreate("guess_flag")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add activity
            </Button>
          </div>

          {activities.length === 0 ? (
            <Card className="rounded-3xl border-dashed shadow-none">
              <CardContent className="p-8 text-sm text-gray-500">
                No activities yet. Start with one of the suggestions above.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activities.map((activity) => (
                <ScheduledActivityCard
                  key={activity.job_id}
                  activity={activity}
                  onEdit={() => openEdit(activity)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {isDesktop ? (
        <Sheet open={!!editorState} onOpenChange={(open) => !open && closeEditor()}>
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-y-auto rounded-tl-3xl rounded-bl-3xl p-0 sm:max-w-xl"
          >
            <div className="flex min-h-full flex-col">
              <SheetHeader className="border-b border-gray-100 px-6 py-5">
                <SheetTitle>
                  {editorState?.mode === "edit" ? "Edit activity" : "Add activity"}
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {editorBody}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={!!editorState} onOpenChange={(open) => !open && closeEditor()}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader>
              <DrawerTitle>
                {editorState?.mode === "edit" ? "Edit activity" : "Add activity"}
              </DrawerTitle>
              <DrawerDescription>
                Set the activity type, instructions, schedule, and enabled state.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              {editorBody}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

function ScheduledActivityCard({
  activity,
  onEdit,
}: {
  activity: ICareActivity;
  onEdit: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const typeConfig = ACTIVITY_TYPE_OPTIONS.find((item) => item.value === activity.type);
  const Icon = typeConfig?.icon ?? Puzzle;

  // Optimistic UI state
  const [enabled, setEnabled] = useState<boolean>(!!activity.enabled);
  const [isPending, startTransition] = useTransition();

  // Keep local state in sync if parent activity changes (refetch, realtime, etc.)
  useEffect(() => {
    setEnabled(!!activity.enabled);
  }, [activity.enabled, activity.job_id]);

  return (
<Card className="rounded-3xl border-gray-200 shadow-sm">
  <CardHeader className="py-4 pb-2">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-2">
        {typeConfig ? (
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", typeConfig.chipTone)}>
            {typeConfig.label}
          </span>
        ) : null}

        <CardTitle className="text-lg font-semibold leading-tight">
          {activity.title}
        </CardTitle>
      </div>

      <Icon className="mt-1 h-5 w-5 shrink-0 text-gray-500" />
    </div>
  </CardHeader>

  <CardContent className="pb-4 pt-2 space-y-3">
    <p className="text-sm leading-5 text-gray-600 line-clamp-2">
      {activity.instructions || "No custom instructions yet."}
    </p>

    {/* Meta bar */}
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Status + Cron */}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:gap-6">
          {/* Status */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-gray-400">Status</span>
              <span className="text-sm font-medium text-gray-800">
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            {/* Switch on mobile next to status */}
            <div className="sm:hidden">
              <Switch
                id={`activity-enabled-${activity.job_id ?? "draft"}-mobile`}
                checked={enabled}
                disabled={isPending || !activity.job_id}
                onCheckedChange={(checked) => {
                  if (!activity.job_id) return;

                  const next = Boolean(checked);
                  const prev = enabled;
                  setEnabled(next);

                  startTransition(async () => {
                    try {
                      const res = await updateCareActivity(supabase, activity.job_id!, { enabled: next });
                      if ((res as any)?.error) setEnabled(prev);
                    } catch {
                      setEnabled(prev);
                    }
                  });
                }}
              />
            </div>
          </div>

          {/* Cron */}
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-gray-400">Cron</span>
              <span className="text-sm font-mono text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px] sm:max-w-none">
                {activity.cron}
              </span>
            </div>

            {/* Edit on mobile next to cron */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 sm:hidden"
              onClick={onEdit}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Right side: actions for sm+ */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3"
            onClick={onEdit}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>

          <Switch
            id={`activity-enabled-${activity.job_id ?? "draft"}`}
            checked={enabled}
            disabled={isPending || !activity.job_id}
            onCheckedChange={(checked) => {
              if (!activity.job_id) return;

              const next = Boolean(checked);
              const prev = enabled;
              setEnabled(next);

              startTransition(async () => {
                try {
                  const res = await updateCareActivity(supabase, activity.job_id!, { enabled: next });
                  if ((res as any)?.error) setEnabled(prev);
                } catch {
                  setEnabled(prev);
                }
              });
            }}
          />
        </div>
      </div>
    </div>
  </CardContent>
</Card>
  );
}

function CareActivityEditor({
  caregiverId,
  patientId,
  initialActivity,
  initialType,
  mode,
  onCancel,
  onDeleted,
  onSaved,
}: {
  caregiverId: string;
  patientId: string;
  initialActivity?: ICareActivity;
  initialType?: CareActivityType;
  mode: "create" | "edit";
  onCancel: () => void;
  onDeleted: (activityId: string) => void;
  onSaved: (activity: ICareActivity) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formState, setFormState] = useState<CareActivityFormState>(
    initialActivity
      ? activityToFormState(initialActivity)
      : createDefaultFormState(initialType ?? "guess_flag"),
  );

  useEffect(() => {
    if (initialActivity) {
      setFormState(activityToFormState(initialActivity));
      return;
    }

    setFormState(createDefaultFormState(initialType ?? "guess_flag"));
  }, [initialActivity, initialType]);

  const generatedCron = useMemo(() => buildCron(formState), [formState]);
  const typeConfig = ACTIVITY_TYPE_OPTIONS.find((item) => item.value === formState.type);

  const updateForm = <K extends keyof CareActivityFormState>(
    key: K,
    value: CareActivityFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const toggleDay = (day: WeekdayValue, checked: boolean) => {
    setFormState((current) => ({
      ...current,
      daysOfWeek: checked
        ? Array.from(new Set([...current.daysOfWeek, day]))
        : current.daysOfWeek.filter((item) => item !== day),
    }));
  };

  const save = async () => {
    const validationError = validateActivityForm(formState);
    if (validationError) {
      toast({
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const payload = {
      patient_id: patientId,
      type: formState.type,
      title: formState.title.trim(),
      instructions: formState.instructions.trim(),
      cron: generatedCron,
      enabled: formState.enabled,
    };

    const savedActivity = mode === "create"
      ? await createCareActivity(supabase, payload)
      : await updateCareActivity(supabase, initialActivity!.job_id, payload);

    setIsSaving(false);

    if (!savedActivity) {
      toast({
        description: "Activity could not be saved.",
        variant: "destructive",
      });
      return;
    }

    onSaved(savedActivity);
  };

  const remove = async () => {
    if (!initialActivity) {
      return;
    }

    setIsDeleting(true);
    const removed = await deleteCareActivity(supabase, initialActivity.job_id);
    setIsDeleting(false);

    if (!removed) {
      toast({
        description: "Activity could not be removed.",
        variant: "destructive",
      });
      return;
    }

    onDeleted(initialActivity.job_id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {typeConfig ? (
            <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-medium", typeConfig.chipTone)}>
              {typeConfig.label}
            </span>
          ) : null}
          <p className="text-sm text-gray-500">
            Fine-tune the activity content and schedule for this patient.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Activity type</Label>
          <Select
            value={formState.type}
            onValueChange={(value: CareActivityType) => {
              const nextDefaults = createDefaultFormState(value);
              setFormState((current) => ({
                ...current,
                type: value,
                title: nextDefaults.title,
                instructions: current.instructions || nextDefaults.instructions,
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select activity type" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={formState.title}
            onChange={(event) => updateForm("title", event.target.value)}
            placeholder="Name this activity"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Instructions</Label>
        <Textarea
          rows={4}
          value={formState.instructions}
          onChange={(event) => updateForm("instructions", event.target.value)}
          placeholder={typeConfig?.helperPlaceholder}
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
              Schedule
            </h3>
            <p className="text-sm text-gray-500">
              Define when this activity should be active for the patient.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
<div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={formState.time}
                onChange={(event) => updateForm("time", event.target.value)}
              />
            </div>
            </div>

            <div className="space-y-2">
              <Label>Repeats</Label>
              <Select
                value={formState.frequency}
                onValueChange={(value: ScheduleFrequency) => updateForm("frequency", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select repeat pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="specific_days">Specific days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formState.frequency === "weekly" ? (
            <div className="space-y-2">
              <Label>Day of week</Label>
              <Select
                value={formState.weekday}
                onValueChange={(value: WeekdayValue) => updateForm("weekday", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {formState.frequency === "specific_days" ? (
            <div className="space-y-3">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-3">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={formState.daysOfWeek.includes(option.value)}
                      onCheckedChange={(checked) => toggleDay(option.value, checked === true)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-gray-400">
              Generated cron
            </p>
            <p className="mt-1 break-all font-mono text-sm text-gray-700">{generatedCron}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-full"
          disabled={isSaving}
          onClick={() => void save()}
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Create activity" : "Save activity"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={isSaving}
          onClick={onCancel}
        >
          Cancel
        </Button>
        {mode === "edit" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={isDeleting}
            onClick={() => void remove()}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function createDefaultFormState(
  type: CareActivityType,
): CareActivityFormState {
  const typeConfig = ACTIVITY_TYPE_OPTIONS.find((item) => item.value === type)!;

  return {
    type,
    title: typeConfig.label,
    instructions: "",
    enabled: true,
    frequency: "daily",
    weekday: "MON",
    daysOfWeek: ["MON", "WED", "FRI"],
    time: "09:00",
  };
}

function activityToFormState(activity: ICareActivity): CareActivityFormState {
  const parsed = parseCron(activity.cron);

  return {
    type: activity.type,
    title: activity.title,
    instructions: activity.instructions,
    enabled: activity.enabled,
    frequency: parsed.frequency,
    weekday: parsed.weekday,
    daysOfWeek: parsed.daysOfWeek,
    time: parsed.time,
  };
}

function validateActivityForm(formState: CareActivityFormState) {
  if (!formState.title.trim()) {
    return "Activity title is required.";
  }

  if (!formState.time) {
    return "Select a time for the activity.";
  }

  if (formState.frequency === "specific_days" && formState.daysOfWeek.length === 0) {
    return "Pick at least one day of the week.";
  }

  return null;
}

function buildCron(formState: CareActivityFormState) {
  const [hour, minute] = formState.time.split(":");
  const hourValue = Number(hour);
  const minuteValue = Number(minute);

  if (formState.frequency === "daily") {
    return `${minuteValue} ${hourValue} * * *`;
  }

  if (formState.frequency === "weekly") {
    return `${minuteValue} ${hourValue} * * ${formState.weekday}`;
  }

  return `${minuteValue} ${hourValue} * * ${formState.daysOfWeek.join(",")}`;
}

function parseCron(cron: string): {
  frequency: ScheduleFrequency;
  weekday: WeekdayValue;
  daysOfWeek: WeekdayValue[];
  time: string;
} {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    return {
      frequency: "daily",
      weekday: "MON",
      daysOfWeek: ["MON", "WED", "FRI"],
      time: "09:00",
    };
  }

  const minute = String(parts[0]).padStart(2, "0");
  const hour = String(parts[1]).padStart(2, "0");
  const dayField = parts[4];

  if (dayField === "*") {
    return {
      frequency: "daily",
      weekday: "MON",
      daysOfWeek: ["MON", "WED", "FRI"],
      time: `${hour}:${minute}`,
    };
  }

  if (dayField.includes(",")) {
    const days = dayField.split(",").filter(Boolean) as WeekdayValue[];

    return {
      frequency: "specific_days",
      weekday: days[0] ?? "MON",
      daysOfWeek: days,
      time: `${hour}:${minute}`,
    };
  }

  return {
    frequency: "weekly",
    weekday: dayField as WeekdayValue,
    daysOfWeek: [dayField as WeekdayValue],
    time: `${hour}:${minute}`,
  };
}
