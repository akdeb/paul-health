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
    { label: "Conversations today", value: "8", icon: MessageSquareText, tone: "text-[#2f5f84]" },
    { label: "Check-ins scheduled", value: "2", icon: CalendarClock, tone: "text-[#6d4a12]" },
    { label: "Active alerts", value: "1", icon: AlertTriangle, tone: "text-[#9b4a1f]" },
    { label: "Last companion activity", value: "12 min ago", icon: Clock3, tone: "text-[#2a6650]" },
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
            <section className="relative overflow-hidden rounded-3xl border border-[#ffdccc] bg-[#fff4ea] p-6 sm:p-8">
                <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#ffd7c1]" />
                <div className="absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#d9f5e8]" />
<div className="relative z-10">
<Badge className="mb-3 w-fit border-transparent bg-[#ff6f61] text-white">Dashboard</Badge>
                <h1 className="font-[var(--font-inter-tight)] text-3xl text-[#243640] sm:text-4xl">Welcome back, {dbUser.supervisor_name || "Caregiver"}</h1>
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
                        className="border-[#ffe2d4] bg-[#fffdf9]"
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
                    icon={<BellRing className="h-5 w-5 text-[#b85d2a]" />}
                    titleClassName="text-2xl"
                    description="Recent events that may require immediate caregiver follow-up."
                    contentClassName="space-y-3"
                >
                        <div className="rounded-xl border border-[#ffd8c9] bg-[#fff2e9] p-4 text-sm text-[#724725]">
                            <p className="font-semibold">High priority · 10:14 AM</p>
                            <p className="mt-1">Repeated confusion signals and distress language detected for ~6 minutes.</p>
                        </div>
                        <div className="rounded-xl border border-[#d9f2e7] bg-[#effcf6] p-4 text-sm text-[#246048]">
                            <p className="font-semibold">Info · 9:20 AM</p>
                            <p className="mt-1">Morning conversation ended in stable mood after orientation prompts.</p>
                        </div>
                </FeatureCard>

                <FeatureCard
                    title="Quick actions"
                    icon={<ShieldCheck className="h-5 w-5 text-[#1f6c6d]" />}
                    titleClassName="text-2xl"
                    description="Fast actions for today without entering full Care Plan configuration."
                >
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="primary"><Link href="/home/care-plan">Adjust care rules</Link></Button>
                            <Button asChild variant="outline"><Link href="/home/create">Add companion feature</Link></Button>
                            <Button asChild variant="outline"><Link href="/home/settings"><PhoneCall className="mr-2 h-4 w-4" />Update contacts</Link></Button>
                        </div>
                </FeatureCard>
            </section>
        </div>
    );
}
