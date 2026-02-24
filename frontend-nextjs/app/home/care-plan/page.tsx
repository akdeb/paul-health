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
    { day: "Mon", mood: "Calm", tone: "bg-[#d9efe3] text-[#1f6d4a]" },
    { day: "Tue", mood: "Irritated", tone: "bg-[#fde5d8] text-[#9b4a1f]" },
    { day: "Wed", mood: "Happy", tone: "bg-[#fff3d0] text-[#875d00]" },
    { day: "Thu", mood: "Steady", tone: "bg-[#e0eef8] text-[#1d4f7a]" },
    { day: "Fri", mood: "Lonely", tone: "bg-[#ebe3f8] text-[#54317f]" },
    { day: "Sat", mood: "Calm", tone: "bg-[#d9efe3] text-[#1f6d4a]" },
    { day: "Sun", mood: "Warm", tone: "bg-[#ffeada] text-[#8f4c12]" },
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
            <section className="grid gap-4 xl:grid-cols-5">
                <FeatureCard
                    className="xl:col-span-3 border-[#ffe2d4] bg-[#fffefb]"
                    title="Context Builder"
                    icon={<BookOpenText className="h-5 w-5 text-[#1f6c6d]" />}
                    titleClassName="text-2xl"
                    description="Add details to help the companion speak naturally while staying sensitive to memory and emotional needs."
                    contentClassName="space-y-4"
                >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="full-name">Name</Label>
                                <Input id="full-name" placeholder="Paul Jensen" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="age">Age</Label>
                                <Input id="age" placeholder="72" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lived">Where they have lived</Label>
                                <Input id="lived" placeholder="Copenhagen, Aarhus" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="jobs">Past jobs</Label>
                                <Input id="jobs" placeholder="Mechanic, music teacher" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="interests">Interests, dislikes, and personal stories</Label>
                            <Textarea
                                id="interests"
                                rows={4}
                                placeholder="Music, favourite films, routines, meaningful stories, and calming topics."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="relations">Relations map</Label>
                            <Textarea
                                id="relations"
                                rows={3}
                                placeholder="Torsten is Paul's son. Matt is Paul's carer and friend. Rodney was Paul's childhood cat."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="avoid">Topics to avoid</Label>
                            <Input id="avoid" placeholder="Politics, distressing news, financial stress" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="media">Optional family photos or memory prompts</Label>
                            <Input id="media" type="file" multiple accept="image/*" />
                        </div>

                        <div className="flex flex-wrap gap-3 pt-1">
                            <Button variant="primary">Save Context</Button>
                            <Button variant="outline">Start Guided Onboarding</Button>
                        </div>
                </FeatureCard>

                <FeatureCard
                    className="xl:col-span-2 border-[#ffe2d4] bg-[#fffefb]"
                    title="Mood Calendar"
                    icon={<CalendarHeart className="h-5 w-5 text-[#5a3f9c]" />}
                    titleClassName="text-2xl"
                    description="Confidential, carefully filtered sentiment signals from recent conversations."
                    contentClassName="space-y-3"
                >
                        {weeklyMood.map((entry) => (
                            <div key={entry.day} className="flex items-center justify-between rounded-xl border border-[#ece9f6] bg-[#faf9fe] px-3 py-2">
                                <span className="font-medium text-[#2e3251]">{entry.day}</span>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.tone}`}>{entry.mood}</span>
                            </div>
                        ))}

                        <div className="rounded-xl border border-[#ffd8c9] bg-[#fff2e9] p-4 text-sm text-[#724725]">
                            <p className="font-semibold">Suggested action</p>
                            <p className="mt-1">Friday shows elevated loneliness markers. Consider a family call or in-person check-in.</p>
                        </div>
                </FeatureCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <FeatureCard
                    className="border-[#ffe2d4] bg-[#fffefb]"
                    title="Tone of Voice"
                    icon={<HeartPulse className="h-5 w-5 text-[#1f6c6d]" />}
                    titleClassName="text-2xl"
                    description="Choose the style the assistant should follow in day-to-day conversations."
                    contentClassName="space-y-3"
                >
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d6e4e9] p-3">
                            <input type="radio" name="tone" defaultChecked className="mt-1" />
                            <div>
                                <p className="font-medium text-[#22343f]">Warm and patient</p>
                                <p className="text-sm text-[#52636d]">Slower pace, frequent reassurance, short sentences.</p>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ecdccf] p-3">
                            <input type="radio" name="tone" className="mt-1" />
                            <div>
                                <p className="font-medium text-[#22343f]">Story-focused</p>
                                <p className="text-sm text-[#52636d]">Prompts memories through gentle follow-up questions.</p>
                            </div>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3d8f6] p-3">
                            <input type="radio" name="tone" className="mt-1" />
                            <div>
                                <p className="font-medium text-[#22343f]">Grounding and calming</p>
                                <p className="text-sm text-[#52636d]">Focuses on orientation, breathing, and reassurance cues.</p>
                            </div>
                        </label>
                        <Button variant="primary">Update Tone</Button>
                </FeatureCard>

                <FeatureCard
                    className="border-[#ffe2d4] bg-[#fffefb]"
                    title="Safeguarding Notifications"
                    icon={<BellRing className="h-5 w-5 text-[#b85d2a]" />}
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
                        <div className="rounded-xl border border-[#ffd8cc] bg-[#fff0ec] p-3 text-sm text-[#6f413a]">
                            Alerts include summary context only and should be handled with strict confidentiality.
                        </div>
                        <Button variant="primary">Save Notification Rules</Button>
                </FeatureCard>
            </section>
        </div>
    );
}
