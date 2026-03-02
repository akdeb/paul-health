"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Info, Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { updateUser } from "@/db/users";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import PickLanguage from "../Playground/PickLanguage";
import { Separator } from "@/components/ui/separator";

interface CaregiverSettingsPanelProps {
  selectedUser: IUser;
  allLanguages: ILanguage[];
}

export default function CaregiverSettingsPanel({
  selectedUser,
  allLanguages,
}: CaregiverSettingsPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [supervisorName, setSupervisorName] = useState(selectedUser.name ?? "");
  const [languageState, setLanguageState] = useState(selectedUser.language_code ?? "en-US");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSupervisorName(selectedUser.name ?? "");
    setLanguageState(selectedUser.language_code ?? "en-US");
  }, [selectedUser.language_code, selectedUser.name]);

  const saveCaregiverSettings = async () => {
    setIsSaving(true);
    await updateUser(
      supabase,
      {
        name: supervisorName,
        language_code: languageState,
      },
      selectedUser.user_id,
    );
    toast({
      description: "Caregiver settings saved.",
    });
    setIsSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Caregiver settings</h2>
        <p className="text-sm text-gray-500">
          Customize your name and language settings.
        </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Caregiver name</Label>
          <Input
            id="name"
            value={supervisorName}
            onChange={(e) => setSupervisorName(e.target.value)}
            placeholder="e.g. Aria"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Default language</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="link" size="icon" className="h-6 w-6">
                  <Info size={12} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <p className="text-xs">
                  The AI model uses this as the default language for your character and settings experience.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          <PickLanguage
            onLanguagePicked={setLanguageState}
            allLanguages={allLanguages}
            languageState={languageState}
            isDisabled={false}
          />
        </div>

        <Button
          onClick={saveCaregiverSettings}
          disabled={isSaving}
          className="rounded-full flex flex-row gap-2 items-center"
          size="sm"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          {!isSaving && <Check className="w-4 h-4" />}
        </Button>
      </section>

      <Separator className="my-6" />
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="text-sm text-gray-500">
            Review the signed-in account and log out if needed.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Logged in as</Label>
          <Input disabled value={selectedUser.email} className="bg-white" />
        </div>

        <form action={signOutAction}>
          <Button
            variant="destructive_outline"
            size="sm"
            className="rounded-full"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </Button>
        </form>
      </section>
    </div>
  );
}
