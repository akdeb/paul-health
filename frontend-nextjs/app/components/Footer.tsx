"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function Footer() {
    const pathname = usePathname();
    const isHome = pathname.includes("/home");
    const isMobile = useMediaQuery("(max-width: 768px)");

    return (
        <footer
            className={`w-full ${
                isHome ? "pb-16" : "pb-2"
            } border-[#ffd8c9] bg-white/80 flex flex-col sm:flex-row items-center sm:justify-center border-t-[1px] mx-auto text-center text-xs sm:gap-8 sm:py-2 py-3`}
        >
            <div className="flex flex-row items-center gap-8">
                <a href={"mailto:miguel@studiomorfar.com"} target="_blank" rel="noreferrer">
                    <Button
                        variant="link"
                        size="sm"
                        className="font-normal text-xs"
                        aria-label="Mail"
                    >
                        <Mail size={18} className="mr-2" />
                        Send feedback
                    </Button>
                </a>
                <Label className="font-normal text-xs text-[#865042]">
                    Paul © {new Date().getFullYear()}
                </Label>
            </div>
            <div className={`${isHome && isMobile ? "hidden" : "flex"} flex-row items-center gap-2 text-xs text-[#865042]`}>
                <span>Project by Studio Paul</span>
                <span>·</span>
                <span>Copenhagen</span>
            </div>
        </footer>
    );
}
