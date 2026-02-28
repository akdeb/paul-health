import { createUser, doesUserExist, getUserById } from "@/db/users";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureCard } from "@/components/feature-card";
import Link from "next/link";
import { AlertTriangle, BellRing, CalendarClock, Clock3, MessageSquareText, PhoneCall, ShieldCheck } from "lucide-react";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const overviewStats = [
    { label: "Conversations today", value: "8", icon: MessageSquareText, tone: "text-black" },
    { label: "Check-ins scheduled", value: "2", icon: CalendarClock, tone: "text-black" },
    { label: "Active alerts", value: "1", icon: AlertTriangle, tone: "text-black" },
    { label: "Last companion activity", value: "12 min", icon: Clock3, tone: "text-black" },
];

export default async function Home() {
    const supabase = createClient();

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

    return (
        <div className="space-y-6 pb-10">
            <section className="relative overflow-hidden rounded-3xl border-2 border-gray-200 bg-gray-50 p-6 sm:p-8">
<div className="relative z-10">
                <h1 className="font-semibold text-3xl text-[#243640] sm:text-4xl">Welcome back, {dbUser.supervisor_name || "Caregiver"}</h1>
                <p className="mt-2 max-w-2xl text-[#42535d]">
                    This dashboard focuses on live status and actions. Care configuration lives in the Care Plan tab.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild variant="primary">
                        <Link href="/home/care-plan">Open Care Plan</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/home/settings">Patient</Link>
                    </Button>
                </div>
</div>
                
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {overviewStats.map((item) => (
                    <FeatureCard
                        key={item.label}
                        headerClassName="pb-2"
                        descriptionClassName="text-[#4a5f6b]"
                        titleClassName={`text-2xl ${item.tone}`}
                        title={item.value}
                        icon={<item.icon className="h-5 w-5" />}
                        description={item.label}
                    />
                ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <FeatureCard
                    title="Safeguarding queue"
                    icon={<BellRing className="h-5 w-5" />}
                    titleClassName="text-2xl"
                    description="Recent events that may require immediate caregiver follow-up."
                    contentClassName="space-y-3"
                >
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                            <p className="font-semibold">High priority · 10:14 AM</p>
                            <p className="mt-1">Repeated confusion signals and distress language detected for ~6 minutes.</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                            <p className="font-semibold">Info · 9:20 AM</p>
                            <p className="mt-1">Morning conversation ended in stable mood after orientation prompts.</p>
                        </div>
                </FeatureCard>

                <FeatureCard
                    title="Quick actions"
                    icon={<ShieldCheck className="h-5 w-5" />}
                    titleClassName="text-2xl"
                    description="Fast actions for today without entering full Care Plan configuration."
                >
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="primary"><Link href="/home/care-plan">Adjust care rules</Link></Button>
                            <Button asChild variant="outline"><Link href="/home/ai-settings">Add companion feature</Link></Button>
                            <Button asChild variant="outline"><Link href="/home/settings"><PhoneCall className="mr-2 h-4 w-4" />Update contacts</Link></Button>
                        </div>
                </FeatureCard>
            </section>
        </div>
    );
}
