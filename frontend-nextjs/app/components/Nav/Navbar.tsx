"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LeftNavbarButtons from "./LeftNavbarButtons";
import { ArrowRight, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import RealtimeApp from "../Realtime/App";
import { createClient } from "@/utils/supabase/client";
import { createAction } from "@/db/actions";
import { toast } from "@/components/ui/use-toast";

export function Navbar({
    user,
}: {
    user: IUser | null;
}) {
    const pathname = usePathname();
    const isHome = pathname.startsWith("/home");
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [isTestOpen, setIsTestOpen] = useState(false);
    const [isStartingCheckIn, setIsStartingCheckIn] = useState(false);
    const [currentActionId, setCurrentActionId] = useState<string | null>(null);
    const [currentActionStartedAt, setCurrentActionStartedAt] = useState<number | null>(null);
    const supabase = createClient();

    useEffect(() => {
        if (typeof window !== "undefined" && isMobile) {
            const handleScroll = () => {
                const currentScrollY = window.scrollY;
                setIsVisible(
                    currentScrollY <= 0 || currentScrollY < lastScrollY
                );
                setLastScrollY(currentScrollY);
            };

            window.addEventListener("scroll", handleScroll, { passive: true });
            return () => window.removeEventListener("scroll", handleScroll);
        }
    }, [lastScrollY, isMobile]);

    const portalHref = user ? "/home" : "/login";

    const handleStartCheckIn = async () => {
        if (!user?.personality_id || isStartingCheckIn) {
            return;
        }

        setIsStartingCheckIn(true);
        const action = await createAction(supabase, {
            userId: user.user_id,
            type: "web_chat",
            metadata: {},
            sessionTime: 0,
            jobId: null,
        });

        if (!action) {
            setIsStartingCheckIn(false);
            toast({
                description: "Could not start this check-in session.",
                variant: "destructive",
            });
            return;
        }

        setCurrentActionId(action.action_id);
        setCurrentActionStartedAt(
            action.created_at ? new Date(action.created_at).getTime() : Date.now(),
        );
        setIsTestOpen(true);
        setIsStartingCheckIn(false);
    };

    const handleCloseCheckIn = () => {
        setIsTestOpen(false);
        setCurrentActionId(null);
        setCurrentActionStartedAt(null);
        setIsStartingCheckIn(false);
    };

    return (
        <>
        <div
            className={`backdrop-blur-[6px] bg-white/70 flex-none flex items-center sticky top-0 z-50 transition-transform duration-300 h-[64px] ${
                isVisible ? "translate-y-0" : "-translate-y-full"
            }`}
        >
            <nav className={`mx-auto flex w-full max-w-screen-lg items-center justify-between px-4`}>
                <LeftNavbarButtons user={user} />
                {!isHome && (
                    <Button asChild size="lg" variant="primary">
                        <Link href={portalHref}>Portal <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                )}
                {isHome &&               <Button
                type="button"
                variant="blue"
                size="sm"
                className="font-bold text-white"
                disabled={!user?.personality_id || isStartingCheckIn}
                onClick={() => void handleStartCheckIn()}
              >
                <Send size={16} className="mr-2" />
                {isStartingCheckIn ? "Starting..." : "Ask Paul"}
              </Button>}
            </nav>
        </div>
        {user &&
          isTestOpen &&
          user.personality_id && (
          <RealtimeApp
            personalityIdState={user.personality_id}
            isDoctor={false}
            user={user}
            usageLimitExceeded={false}
            autoStart={true}
            conversationTarget="caregiver"
            actionId={currentActionId}
            actionStartedAt={currentActionStartedAt}
            onClose={handleCloseCheckIn}
          />
        )}
        </>
        
    );
}
