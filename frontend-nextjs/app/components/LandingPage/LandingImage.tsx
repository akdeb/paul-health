"use client";

import Image from "next/image";
import { useMediaQuery } from "@/hooks/use-media-query";

export default function LandingImage() {
    const isMobile = useMediaQuery("(max-width: 768px)");
    return (
        <Image src="/paul.png" alt="Hero" width={isMobile ? 300 : 400} height={isMobile ? 300 : 400} className="absolute bottom-0 right-0" />
    );
}