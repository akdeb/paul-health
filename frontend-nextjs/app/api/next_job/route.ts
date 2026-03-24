import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CronSpec = {
    minute: number;
    hour: number;
    weekdays: Set<string> | "*";
};

const WEEKDAY_MAP: Record<string, string> = {
    SUN: "SUN",
    MON: "MON",
    TUE: "TUE",
    WED: "WED",
    THU: "THU",
    FRI: "FRI",
    SAT: "SAT",
};

const formatLocalParts = (date: Date, timeZone: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const weekdayPart = parts.find((part) => part.type === "weekday")?.value ?? "SUN";
    const hourPart = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minutePart = parts.find((part) => part.type === "minute")?.value ?? "00";

    return {
        weekday: WEEKDAY_MAP[weekdayPart.toUpperCase()] ?? "SUN",
        hour: Number(hourPart),
        minute: Number(minutePart),
    };
};

const parseCron = (cron: string): CronSpec | null => {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) {
        return null;
    }

    const minute = Number(parts[0]);
    const hour = Number(parts[1]);
    const dayField = parts[4].toUpperCase();

    if (Number.isNaN(minute) || Number.isNaN(hour)) {
        return null;
    }

    if (minute < 0 || minute > 59 || hour < 0 || hour > 23) {
        return null;
    }

    if (dayField === "*") {
        return {
            minute,
            hour,
            weekdays: "*",
        };
    }

    const weekdays = new Set<string>();
    for (const token of dayField.split(",")) {
        const weekday = token.trim();
        if (!WEEKDAY_MAP[weekday]) {
            return null;
        }
        weekdays.add(weekday);
    }

    return {
        minute,
        hour,
        weekdays,
    };
};

const matchesCronAtDate = (cron: CronSpec, date: Date, timeZone: string) => {
    const local = formatLocalParts(date, timeZone);
    const dayMatches = cron.weekdays === "*"
        ? true
        : cron.weekdays.has(local.weekday);

    return (
        dayMatches &&
        local.hour === cron.hour &&
        local.minute === cron.minute
    );
};

const findNextCronOccurrence = (
    cron: CronSpec,
    fromDate: Date,
    timeZone: string,
): Date | null => {
    const maxMinutes = 60 * 48; // search up to 48h
    const start = fromDate.getTime();

    for (let offsetMinute = 1; offsetMinute <= maxMinutes; offsetMinute += 1) {
        const candidate = new Date(start + offsetMinute * 60_000);
        if (matchesCronAtDate(cron, candidate, timeZone)) {
            return candidate;
        }
    }

    return null;
};

const findNextLocalCheckAt = (
    fromDate: Date,
    timeZone: string,
    targetHour: number,
    targetMinute: number,
) => {
    const maxMinutes = 60 * 72; // search up to 3 days
    const start = fromDate.getTime();

    for (let offsetMinute = 1; offsetMinute <= maxMinutes; offsetMinute += 1) {
        const candidate = new Date(start + offsetMinute * 60_000);
        const local = formatLocalParts(candidate, timeZone);
        if (local.hour === targetHour && local.minute === targetMinute) {
            return candidate;
        }
    }

    return null;
};

export async function GET(req: Request) {
    try {
        const authorization = req.headers.get("authorization") ?? "";
        const token = authorization.replace("Bearer ", "").trim();

        if (!token) {
            return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: dbUser, error: userError } = await supabase
            .from("users")
            .select("user_id, patient:patients!users_patient_id_fkey(patient_id, timezone)")
            .eq("user_id", user.id)
            .single();

        const patientRecord = Array.isArray(dbUser?.patient)
            ? dbUser?.patient[0]
            : dbUser?.patient;

        if (userError || !patientRecord?.patient_id) {
            return NextResponse.json(
                { error: "Patient not configured for user" },
                { status: 400 },
            );
        }

        const timezone = patientRecord.timezone || "UTC";
        const { data: jobs, error: jobsError } = await supabase
            .from("jobs")
            .select("job_id, cron, title, instructions, type, enabled")
            .eq("patient_id", patientRecord.patient_id)
            .eq("enabled", true);

        if (jobsError) {
            return NextResponse.json({ error: jobsError.message }, { status: 500 });
        }

        const now = new Date();
        let chosenJob:
            | {
                job_id: string;
                fireAt: Date;
                title: string;
                type: string;
                instructions: string;
            }
            | null = null;

        for (const job of jobs ?? []) {
            const parsed = parseCron(job.cron ?? "");
            if (!parsed) {
                continue;
            }

            const nextOccurrence = findNextCronOccurrence(parsed, now, timezone);
            if (!nextOccurrence) {
                continue;
            }

            if (!chosenJob || nextOccurrence.getTime() < chosenJob.fireAt.getTime()) {
                chosenJob = {
                    job_id: job.job_id,
                    fireAt: nextOccurrence,
                    title: job.title ?? "",
                    type: job.type ?? "",
                    instructions: job.instructions ?? "",
                };
            }
        }

        const nextCheckAt = findNextLocalCheckAt(now, timezone, 4, 0);

        return NextResponse.json({
            timezone,
            now_utc: now.toISOString(),
            next_job: chosenJob
                ? {
                    job_id: chosenJob.job_id,
                    type: chosenJob.type,
                    title: chosenJob.title,
                    instructions: chosenJob.instructions,
                    fire_at: chosenJob.fireAt.toISOString(),
                    fire_at_epoch: Math.floor(chosenJob.fireAt.getTime() / 1000),
                }
                : null,
            next_check_at: nextCheckAt?.toISOString() ?? null,
            next_check_at_epoch: nextCheckAt
                ? Math.floor(nextCheckAt.getTime() / 1000)
                : null,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Internal server error",
            },
            { status: 500 },
        );
    }
}
