import { createUser, doesUserExist, getUserById } from "@/db/users";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/feature-card";
import Link from "next/link";
import { CalendarClock, Clock3, MessageSquareText, PhoneCall, ShieldCheck } from "lucide-react";
import HomeConversationChart from "@/app/components/HomeConversationChart";
import { getCareActivitiesByPatientId } from "@/db/careActivities";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) {
        return "No activity yet";
    }

    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) {
        return "Just now";
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const formatDuration = (seconds: number) => {
    if (seconds <= 0) {
        return "<1 min";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    return `${remainingSeconds}s`;
};

export default async function Home() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const userExists = await doesUserExist(supabase, user);

    if (!userExists) {
        await createUser(supabase, user, {
            personality_id: user.user_metadata?.personality_id ?? "",
            language_code: "en-US",
        });
        redirect("/onboard");
    }

    const dbUser = await getUserById(supabase, user.id);

    if (!dbUser) {
        redirect("/login");
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfRange = new Date(startOfToday);
    startOfRange.setDate(startOfRange.getDate() - 6);

    const [{ data: chatActions }, careActivities] = await Promise.all([
        supabase
            .from("actions")
            .select("action_id, type, created_at, session_time")
            .eq("user_id", dbUser.user_id)
            .in("type", ["web_chat", "device_chat"])
            .gte("created_at", startOfRange.toISOString())
            .order("created_at", { ascending: true }),
        dbUser.patient?.patient_id
            ? getCareActivitiesByPatientId(supabase, dbUser.patient.patient_id)
            : Promise.resolve([]),
    ]);

    const actionIds = (chatActions ?? []).map((action) => action.action_id);
    const { data: conversationRows } = actionIds.length > 0
        ? await supabase
            .from("conversations")
            .select("action_id, created_at")
            .in("action_id", actionIds)
            .gte("created_at", startOfToday.toISOString())
        : { data: [] as Array<{ action_id: string; created_at: string }> };

    const latestChatAction = [...(chatActions ?? [])].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const enabledActivities = careActivities.filter((activity) => activity.enabled).length;
    const todaySessions = (chatActions ?? []).filter((action) =>
        new Date(action.created_at).getTime() >= startOfToday.getTime()
    );
    const conversationTurnsToday = conversationRows?.length ?? 0;
    const talkTimeToday = todaySessions.reduce((total, action) => total + (action.session_time ?? 0), 0);

    const chartData = Array.from({ length: 7 }, (_, index) => {
        const day = new Date(startOfRange);
        day.setDate(startOfRange.getDate() + index);
        const dayKey = day.toLocaleDateString("en-CA");

        const actionsForDay = (chatActions ?? []).filter((action) =>
            new Date(action.created_at).toLocaleDateString("en-CA") === dayKey
        );

        const webChats = actionsForDay.filter((action) => action.type === "web_chat").length;
        const deviceChats = actionsForDay.filter((action) => action.type === "device_chat").length;

        return {
            dayLabel: day.toLocaleDateString("en-US", { weekday: "short" }),
            fullLabel: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            webChats,
            deviceChats,
            total: webChats + deviceChats,
        };
    }).reverse();

    const overviewStats = [
        {
            label: "Conversation turns today",
            value: String(conversationTurnsToday),
            icon: MessageSquareText,
        },
        {
            label: "Talk time today",
            value: formatDuration(talkTimeToday),
            icon: Clock3,
        },
        {
            label: "Scheduled activities",
            value: String(enabledActivities),
            icon: CalendarClock,
        },
        {
            label: "Last companion activity",
            value: formatRelativeTime(latestChatAction?.created_at),
            icon: Clock3,
        },
    ];

    return (
        <div className="space-y-6 pb-10">
            <section className="relative overflow-hidden rounded-3xl border-2 border-gray-200 bg-gray-50 p-6 sm:p-8">
<div className="relative z-10">
                <h1 className="font-semibold text-3xl text-[#243640] sm:text-4xl">Welcome back, {dbUser.name || "Caregiver"}</h1>
                <p className="mt-2 max-w-2xl text-[#42535d]">
                    This dashboard focuses on live status and actions. Care configuration lives in the Care Plan tab.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild variant="primary">
                        <Link href="/home/care-plan">Open Care Plan</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/home/settings/patient">Patient</Link>
                    </Button>
                </div>
</div>
                
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <HomeConversationChart data={chartData} />
                <FeatureCard
                    title="Quick actions"
                    icon={<ShieldCheck className="h-5 w-5" />}
                    titleClassName="text-2xl"
                    description="Fast actions for today without entering full Care Plan configuration."
                >
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="primary"><Link href="/home/care-plan">Adjust care rules</Link></Button>
                            <Button asChild variant="outline"><Link href="/home/settings/ai">Add companion feature</Link></Button>
                            <Button asChild variant="outline"><Link href="/home/settings/caregiver"><PhoneCall className="mr-2 h-4 w-4" />Update contacts</Link></Button>
                        </div>
                </FeatureCard>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overviewStats.map((item) => (
                    <FeatureCard
                        key={item.label}
                        headerClassName="pb-2"
                        descriptionClassName="text-[#4a5f6b]"
                        titleClassName="text-2xl text-black"
                        title={item.value}
                        icon={<item.icon className="h-5 w-5" />}
                        description={item.label}
                    />
                ))}
            </section>


        </div>
    );
}
