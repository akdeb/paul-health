import Link from "next/link";
import { Brain } from "lucide-react";

interface LeftNavbarButtonsProps {
    user: IUser | null;
}

export default function LeftNavbarButtons({ user: _user }: LeftNavbarButtonsProps) {
    return (
        <Link href="/" aria-label="Paul home" className="group inline-flex items-center gap-3">
            <span className="font-shipporiMinchoB1 text-3xl font-bold text-[#1f2f3a] transition-colors group-hover:text-[#ff6f61]">
                PAUL
            </span>
        </Link>
    );
}
