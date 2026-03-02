import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOpenGraphMetadata } from "@/lib/utils";

export const metadata: Metadata = {
    title: "Settings",
    ...getOpenGraphMetadata("Settings"),
};

export default async function Home() {
    return <div>Actions</div>;
}
