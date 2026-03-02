import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BellRing, Brain, HeartHandshake, Mic, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    return (
        <div className="min-h-screen bg-[#fff9f3] text-[#20303a]">
            <main>
                <section className="relative overflow-hidden border-b border-[#ffe1d4] bg-[#fff3e8]">
                    <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#ffd8c0]" />
                    <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-[#d8f4e8]" />
                    <div className="container relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20">
                        <div className="space-y-6">
                            <h1 className="font-[var(--font-inter-tight)] text-4xl leading-tight text-[#1e2f39] md:text-6xl">
                                Paul, a voice companion for people living with dementia.
                            </h1>
                            <p className="max-w-xl text-lg text-[#384a53]">
                                Paul helps create steady, familiar conversation at home while giving caregivers practical tools to personalize care and respond earlier.
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Button asChild size="lg" variant="primary">
                                    <Link href="/home">
                                        Open Caregiver Portal
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline">
                                    <Link href={"mailto:miguel@studiomorfar.com"} target="_blank" rel="noopener noreferrer">Talk to our team</Link>
                                </Button>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="rounded-3xl border border-[#ffd8c9] bg-white/85 p-4 shadow-xl backdrop-blur">
                                <div className="relative overflow-hidden rounded-2xl border border-[#ffe8de] bg-[#fff7f1]">
                                    <Image
                                        src="/products/landing.png"
                                        alt="Voice companion device for dementia care"
                                        width={900}
                                        height={900}
                                        className="h-[340px] w-full object-cover"
                                        priority
                                    />
                                </div>
                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-xl bg-[#e8fff3] p-3">
                                        <Mic className="mb-2 h-4 w-4 text-[#0f8a64]" />
                                        Voice-first interaction
                                    </div>
                                    <div className="rounded-xl bg-[#fff2ea] p-3">
                                        <BellRing className="mb-2 h-4 w-4 text-[#d15d2f]" />
                                        Safeguarding alerts
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="container mx-auto max-w-6xl px-4 py-14 md:px-6">
                    <div className="mb-8 max-w-2xl">
                        <h2 className="text-3xl font-bold text-[#1e2f39] md:text-4xl">Designed for real caregiver workflows</h2>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                        {coreBenefits.map((benefit) => (
                            <article key={benefit.title} className="rounded-2xl border border-[#ffe2d3] bg-white p-6 shadow-sm">
                                <benefit.icon className="mb-4 h-6 w-6 text-[#ff6f61]" />
                                <h3 className="mb-2 text-xl font-semibold text-[#1e2f39]">{benefit.title}</h3>
                                <p className="text-[#4a5a63]">{benefit.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="border-y border-[#ffd9c7] bg-[#ff7d66] py-14 text-white">
                    <div className="container mx-auto max-w-6xl px-4 md:px-6">
                        <p className="mb-3 text-sm uppercase tracking-[0.15em] text-[#fff4d9]">Care Path</p>
                        <h2 className="mb-10 text-3xl font-bold text-white md:text-4xl">From setup to everyday support</h2>
                        <div className="grid gap-4 md:grid-cols-3">
                            {howItWorks.map((item) => (
                                <article key={item.title} className="rounded-2xl border border-white/30 bg-white/15 p-6 backdrop-blur-sm">
                                    <p className="mb-4 text-sm font-semibold text-[#fff8cf]">{item.step}</p>
                                    <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                                    <p className="text-white/90">{item.description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
