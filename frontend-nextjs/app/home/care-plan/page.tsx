import { getUserById } from "@/db/users";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureCard } from "@/components/feature-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BellRing, BookOpenText, CalendarHeart, HeartPulse } from "lucide-react";

export const metadata = {
    title: "Care Plan",
};

const weeklyMood = [
    { day: "Mon", mood: "Calm", tone: "bg-green-500 text-white" },
    { day: "Tue", mood: "Irritated", tone: "bg-red-500 text-white" },
    { day: "Wed", mood: "Happy", tone: "bg-yellow-500 text-white" },
    { day: "Thu", mood: "Steady", tone: "bg-blue-500 text-white" },
    { day: "Fri", mood: "Lonely", tone: "bg-purple-500 text-white" },
    { day: "Sat", mood: "Calm", tone: "bg-green-500 text-white" },
    { day: "Sun", mood: "Warm", tone: "bg-orange-500 text-white" },
];

export default async function CarePlanPage() {
    const supabase = createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const dbUser = await getUserById(supabase, user.id);
    if (!dbUser) {
        redirect("/login");
    }

    return (
        <div className="space-y-6 pb-10">
                <FeatureCard
                    className="xl:col-span-2 border-gray-200 bg-white"
                    title="Mood Calendar"
                    icon={<CalendarHeart className="h-5 w-5" />}
                    titleClassName="text-2xl"
                    description="Confidential, carefully filtered sentiment signals from recent conversations."
                    contentClassName="space-y-3"
                >
                        {weeklyMood.map((entry) => (
                            <div key={entry.day} className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                                <span className="font-medium text-[#2e3251]">{entry.day}</span>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.tone}`}>{entry.mood}</span>
                            </div>
                        ))}

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                            <p className="font-semibold">Suggested action</p>
                            <p className="mt-1">Friday shows elevated loneliness markers. Consider a family call or in-person check-in.</p>
                        </div>
                </FeatureCard>
                <FeatureCard
                    className="border-gray-200 bg-white"
                    title="Tone of Voice"
                    icon={<HeartPulse className="h-5 w-5" />}
                    titleClassName="text-2xl"
                    description="Choose the style the assistant should follow in day-to-day conversations."
                    contentClassName="space-y-3"
                >
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d6e4e9] p-3">
                            <input type="radio" name="tone" defaultChecked className="mt-1" />
                            <div>
                                    <p className="font-medium text-gray-700">Warm and patient</p>
                                <p className="text-sm text-gray-700">Slower pace, frequent reassurance, short sentences.</p>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ecdccf] p-3">
                            <input type="radio" name="tone" className="mt-1" />
                            <div>
                                <p className="font-medium text-gray-700">Story-focused</p>
                                <p className="text-sm text-gray-700">Prompts memories through gentle follow-up questions.</p>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3d8f6] p-3">
                            <input type="radio" name="tone" className="mt-1" />
                            <div>
                                <p className="font-medium text-gray-700">Grounding and calming</p>
                                <p className="text-sm text-gray-700">Focuses on orientation, breathing, and reassurance cues.</p>
                            </div>
                        </label>
                        <Button variant="primary">Update Tone</Button>
                </FeatureCard>

                <FeatureCard
                    className="border-gray-200 bg-white"
                    title="Safeguarding Notifications"
                    icon={<BellRing className="h-5 w-5" />}
                    titleClassName="text-2xl"
                    description="Automatically notify caregivers if the user may be distressed or in immediate need of support."
                    contentClassName="space-y-3"
                >
                        <div className="space-y-2">
                            <Label htmlFor="caregivers">Caregiver contacts</Label>
                            <Input id="caregivers" placeholder="name@email.com, +45 12 34 56 78" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="triggers">Alert triggers</Label>
                            <Textarea id="triggers" rows={3} placeholder="Escalating anxiety, repeated confusion, explicit request for help." />
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                            Alerts include summary context only and should be handled with strict confidentiality.
                        </div>
                        <Button variant="primary">Save Notification Rules</Button>
                </FeatureCard>
        </div>
    );
}
