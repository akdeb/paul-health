"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LeftNavbarButtons from "./LeftNavbarButtons";
import { ArrowRight, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import RealtimeApp from "../Realtime/App";

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
                disabled={!user?.personality_id}
                onClick={() => setIsTestOpen(true)}
              >
                <Send size={16} className="mr-2" />
                Check-in
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
          />
        )}
        </>
        
    );
}
