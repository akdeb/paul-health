import { redirect } from "next/navigation";

import HomePageSubtitles from "@/app/components/HomePageSubtitles";
import CarePlanManager from "@/app/components/CarePlan/CarePlanManager";
import { Card, CardContent } from "@/components/ui/card";
import { getCareActivitiesByPatientId } from "@/db/careActivities";
import { getUserById } from "@/db/users";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Care Plan",
};

export default async function CarePlanPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await getUserById(supabase, user.id);
  if (!dbUser) {
    redirect("/login");
  }

  const patient = dbUser.patient;
  const activities = patient?.patient_id
    ? await getCareActivitiesByPatientId(supabase, patient.patient_id)
    : [];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-normal">Care Plan</h1>
        <HomePageSubtitles user={dbUser} page="care-plan" />
      </div>

      {!patient ? (
        <Card className="rounded-3xl border-dashed shadow-none">
          <CardContent className="p-8 text-sm text-gray-500">
            Patient details are still being prepared. Return to patient settings first and then come back to configure activities.
          </CardContent>
        </Card>
      ) : (
        <CarePlanManager
          caregiverId={dbUser.user_id}
          patientId={patient.patient_id}
          patientTimezone={patient.timezone || "UTC"}
          initialActivities={activities}
        />
      )}
    </div>
  );
}
