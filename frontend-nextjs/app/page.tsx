import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BellRing, Brain, HeartHandshake, Mic, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import { getUserById } from "@/db/users";

const coreBenefits = [
    {
        icon: HeartHandshake,
        title: "Built for families",
        description:
            "A voice companion designed for people living with dementia and the caregivers who support them every day.",
    },
    {
        icon: Brain,
        title: "Memory-aware conversations",
        description:
            "The assistant can be configured with personal context so interactions feel familiar, calm, and grounded.",
    },
    {
        icon: ShieldAlert,
        title: "Caregiver safety signals",
        description:
            "Sensitive safeguarding alerts can notify caregivers when anxiety or distress patterns are detected.",
    },
];

const howItWorks = [
    {
        step: "01",
        title: "Set up the device",
        description:
            "Place the companion in a familiar room and connect it to your caregiver account.",
    },
    {
        step: "02",
        title: "Add personal context",
        description:
            "Share life stories, names, routines, preferences, and topics to avoid in a guided setup.",
    },
    {
        step: "03",
        title: "Support with confidence",
        description:
            "Track mood trends, tune tone of voice, and receive notifications when support is needed.",
    },
];

// export default function LandingPage() {
//     return (
//         <div className="min-h-screen bg-[#fff9f3] text-[#20303a]">
//             <main>
//                 Paul Health
//             </main>
//         </div>
//     );
// }


export default async function LandingPage() {
    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const portalHref = user ? "/home" : "/login";

    return (
        <div className="bg-white text-[#20303a]">
            <main className="flex flex-col items-center justify-start min-h-screen mx-auto max-w-screen-xl">
                <section className="flex flex-col items-center justify-start mt-20 gap-8">
<div className="flex flex-row justify-start gap-2">
<h1 className="text-7xl font-bold font-shipporiMinchoB1">
                        PAUL
                    </h1>
<p className="text-gray-500">beta</p>
</div>
                    
                    <p className="text-2xl font-medium font-shipporiMinchoB1">
                        Personal . Assistant . Unconditional . Listening
</p>
                <Button asChild size="lg" variant="primary">
                    <Link href={portalHref}>Portal <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                </section>
            </main>
        </div>
    );
}
