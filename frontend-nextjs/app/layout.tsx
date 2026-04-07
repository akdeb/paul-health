import { GeistSans } from "geist/font/sans";
import { Product, WithContext } from "schema-dts";
import {
    Inter,
    Baloo_2,
    Comic_Neue,
    Quicksand,
    Fredoka,
    Lora,
    Inter_Tight,
    Borel,
    Silkscreen,
    Luckiest_Guy,
    Shippori_Mincho_B1
} from "next/font/google";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { Toaster } from "@/components/ui/toaster";
import Footer from "./components/Footer";
import { Metadata, Viewport } from "next";
import NextTopLoader from "nextjs-toploader";
import { Karla } from "next/font/google";

const karla = Karla({
	subsets: ["latin"],
	variable: "--font-karla",
});


import Script from "next/script";
import { Navbar } from "./components/Nav/Navbar";
import { getUserById } from "@/db/users";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

const inter_tight = Inter_Tight({
    weight: ["500", "600", "700"],
    style: ["normal", "italic"],
    subsets: ["latin"],
    variable: "--font-inter-tight",
    display: "swap",
});

const baloo2 = Baloo_2({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-baloo2",
});

const comicNeue = Comic_Neue({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-comic-neue",
    weight: ["300", "400", "700"],
});

const quicksand = Quicksand({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-quicksand",
});

const fredoka = Fredoka({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-fredoka",
});

const lora = Lora({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-lora",
});

const borel = Borel({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-borel",
    weight: ["400"],
});

const silkscreen = Silkscreen({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-silkscreen",
    weight: ["400"],
});

const luckiestGuy = Luckiest_Guy({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-luckiest-guy",
    weight: ["400"],
});

const shipporiMinchoB1 = Shippori_Mincho_B1({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-shippori-mincho-b1",
    weight: ["400", "700", "800"],
});

const fonts = `${inter.variable} ${inter_tight.variable} ${baloo2.variable} ${comicNeue.variable} ${quicksand.variable} ${fredoka.variable} ${lora.variable} ${karla.variable} ${borel.variable} ${silkscreen.variable} ${luckiestGuy.variable} ${shipporiMinchoB1.variable}`;

const defaultUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
    metadataBase: new URL(defaultUrl),
    title: {
        default: "Paul",
        template: "%s | Paul",
    },
    applicationName: "Paul",
    description:
        "Paul is a voice companion for people living with dementia, with caregiver tools for personalization, routines, and conversation support.",
    authors: [
        {
            name: "Akashdeep Deb",
            url: "https://linkedin.com/in/akashdeep-deb",
        },
    ],
    keywords: [
        "AI toy",
        "AI companion",
        "dementia care",
        "caregiver tools",
        "voice companion",
        "memory support",
        "Paul",
        "conversational AI",
        "care plan",
        "patient support",
        "elder care",
    ],
    openGraph: {
        title: "Paul",
        description:
            "Paul is a voice companion for people living with dementia, designed to support familiar conversation and help caregivers personalize care.",
        siteName: "Paul",
        locale: "en-US",
        type: "website",
        images: [],
    },
    robots: {
        index: true,
        follow: true,
    },
    generator: "Next.js",
    creator: "Paul",
    publisher: "Paul",
    twitter: {
        card: "summary_large_image",
        title: "Paul",
        description:
            "Paul is a voice companion for people living with dementia, with caregiver tools for routines, personalization, and conversation support.",
        images: [],
    },
    formatDetection: {
        telephone: false,
    },
    appleWebApp: {
        capable: true,
        title: "Paul",
        statusBarStyle: "black-translucent",
    },
    category: "Healthcare technology",
    classification: "Dementia support and caregiver software",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
};

const jsonLd: WithContext<Product> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Paul",
    description:
        "Paul is a voice companion for people living with dementia, designed to support familiar conversation and help caregivers personalize care.",
    brand: {
        "@type": "Brand",
        name: "Paul",
    },
    offers: {
        "@type": "Offer"
    },
    aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "14",
    },
    review: [
        {
            "@type": "Review",
            author: {
                "@type": "Person",
                name: "Kai L.",
            },
            reviewRating: {
                "@type": "Rating",
                ratingValue: "5",
            },
            reviewBody:
                "I wished to have a toy for my friends kids, chatting just for fun ... and hearing all is 'out-of-the-.box' is a unbelievable awesome",
        },
        {
            "@type": "Review",
            author: {
                "@type": "Person",
                name: "Lauren A. W.",
            },
            reviewRating: {
                "@type": "Rating",
                ratingValue: "5",
            },
            reviewBody:
                "I want to make a mini me. I think this box will really help!",
        },
        {
            "@type": "Review",
            author: {
                "@type": "Person",
                name: "Steven Z.",
            },
            reviewRating: {
                "@type": "Rating",
                ratingValue: "5",
            },
            reviewBody: "this is fantastic, extremely useful. Thanks so much.",
        },
        {
            "@type": "Review",
            author: {
                "@type": "Person",
                name: "Big cube",
            },
            reviewRating: {
                "@type": "Rating",
                ratingValue: "4.5",
            },
            reviewBody:
                "Really cool project you've got going on, hoping one day it might use a local llm",
        },
    ],
    image: "https://elatoai.com/images/orange.png",
    category: "Interactive AI Device",
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    let dbUser: IUser | undefined;
    if (user) {
        dbUser = await getUserById(supabase, user.id);
    }


    return (
        <html
            lang="en"
            className={`${GeistSans.className} h-full ${fonts}`}
            suppressHydrationWarning
        >
            <head>
                <link rel="canonical" href="https://www.elatoai.com" />
                <Script
                    id="product-schema"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(jsonLd),
                    }}
                />
            </head>
            <body className="min-h-screen bg-background text-foreground flex flex-col bg-white font-karla">
                <NextTopLoader showSpinner={false} color="orange" />

                {/* <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                > */}
                <main className="mx-auto flex min-h-screen w-full flex-1 flex-col">
                    <Navbar user={dbUser ?? null} />
                    <div className="flex-1">
                        {children}
                    </div>
                    <Footer />
                </main>
                {/* <Analytics /> */}
                <Toaster />
                {/* </ThemeProvider> */}
            </body>
        </html>
    );
}
