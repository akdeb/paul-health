import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BellRing, Brain, HeartHandshake, Mic, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import LandingImage from "./components/LandingPage/LandingImage";

export default async function LandingPage() {
    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const portalHref = user ? "/home" : "/login";

    return (
        <div className="bg-white relative text-[#20303a]">
            <main className="flex flex-col items-center justify-start min-h-screen mx-auto max-w-screen-xl">
                <section className="flex px-4 flex-col items-center justify-start mt-20 gap-8">
<div className="flex flex-row justify-start gap-2">
<h1 className="text-7xl font-bold font-shipporiMinchoB1">
                        PAUL
                    </h1>
<p className="text-gray-500">beta</p>
</div>
                    
                    <p className="text-2xl text-center font-medium font-shipporiMinchoB1">
                        Personal . Assistant . Unconditional . Listening
</p>
                <Button asChild size="lg" variant="primary">
                    <Link href={portalHref}>Portal <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>

                </section>
            </main>
            <LandingImage />
        </div>
    );
}
