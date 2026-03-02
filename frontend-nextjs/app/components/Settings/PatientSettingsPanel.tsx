"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { updateUser } from "@/db/users";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  userFormAgeDescription,
  userFormAgeLabel,
  userFormPersonaLabel,
  userFormPersonaPlaceholder,
} from "@/lib/data";

interface PatientSettingsPanelProps {
  selectedUser: IUser;
}

export default function PatientSettingsPanel({
  selectedUser,
}: PatientSettingsPanelProps) {
  const supabase = createClient();
  const { toast } = useToast();

  const [patientName, setPatientName] = useState(selectedUser.supervisee_name ?? "");
  const [patientAge, setPatientAge] = useState<number>(selectedUser.supervisee_age ?? 0);
  const [patientPersona, setPatientPersona] = useState(selectedUser.supervisee_persona ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const savePatientSettings = async () => {
    setIsSaving(true);
    await updateUser(
      supabase,
      {
        supervisee_name: patientName,
        supervisee_age: patientAge,
        supervisee_persona: patientPersona,
      },
      selectedUser.user_id,
    );
    toast({
      description: "Patient settings saved.",
    });
    setIsSaving(false);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Patient settings</h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient_name">Patient name</Label>
        <Input
          id="patient_name"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="e.g. Tom"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient_age">{userFormAgeLabel}</Label>
        <p className="text-sm text-gray-500">{userFormAgeDescription}</p>
        <Input
          id="patient_age"
          type="number"
          min={1}
          max={120}
          value={patientAge || ""}
          onChange={(e) => setPatientAge(Number(e.target.value))}
          placeholder="e.g. 72"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient_persona">{userFormPersonaLabel}</Label>
        <Textarea
          id="patient_persona"
          rows={6}
          value={patientPersona}
          onChange={(e) => setPatientPersona(e.target.value)}
          placeholder={userFormPersonaPlaceholder}
        />
      </div>

      <Button
        onClick={savePatientSettings}
        disabled={isSaving}
        className="rounded-full flex flex-row gap-2 items-center"
        size="sm"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        {!isSaving && <Check className="w-4 h-4" />}
      </Button>
    </section>
  );
}
