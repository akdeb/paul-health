import SettingsTabsNav from "@/app/components/Settings/SettingsTabsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pb-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-normal">Settings</h1>
        <p className="text-sm text-gray-500">
          Configure caregiver, patient, agent, and device settings.
        </p>
      </div>
      <SettingsTabsNav />
      {children}
    </div>
  );
}
