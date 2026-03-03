"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const settingsTabs = [
  { value: "/home/settings/patient", label: "Patient" },
  { value: "/home/settings/caregiver", label: "Caregiver" },
  { value: "/home/settings/ai", label: "Agent" },
  { value: "/home/settings/device", label: "Device" },
];

export default function SettingsTabsNav() {
  const pathname = usePathname();
  const activeTab = settingsTabs.find((tab) => pathname.startsWith(tab.value))?.value
    ?? "/home/settings/caregiver";

  return (
    <div className="overflow-x-auto pb-1">
      <Tabs value={activeTab} className="w-max min-w-full">
        <TabsList className="h-auto w-max min-w-full justify-start gap-2 rounded-lg bg-muted/70 p-1">
          {settingsTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              asChild
              className="rounded-lg px-4 py-2"
            >
              <Link href={tab.value}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
