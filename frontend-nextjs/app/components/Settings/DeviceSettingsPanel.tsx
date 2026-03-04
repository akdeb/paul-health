"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { connectUserToDevice } from "@/app/actions";
import { updateDevice } from "@/db/devices";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/use-toast";

interface DeviceSettingsPanelProps {
  selectedUser: IUser;
}

const skipDeviceRegistration =
  process.env.NEXT_PUBLIC_SKIP_DEVICE_REGISTRATION === "True";

export default function DeviceSettingsPanel({
  selectedUser,
}: DeviceSettingsPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(!!selectedUser.device?.device_id);
  const [deviceCode, setDeviceCode] = useState("");
  const [error, setError] = useState("");
  const [volume, setVolume] = useState([selectedUser.device?.volume ?? 50]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsConnected(!!selectedUser.device?.device_id);
    setVolume([selectedUser.device?.volume ?? 50]);
  }, [selectedUser.device?.device_id, selectedUser.device?.volume]);

  const updateVolumeValue = (value: number[]) => {
    setVolume(value);
  };

  const saveDeviceSettings = async () => {
    if (!selectedUser.device?.device_id) {
      toast({
        description: "No registered device was found for this user.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateDevice(
        supabase,
        { volume: volume[0] },
        selectedUser.device.device_id,
      );
      toast({
        description: "Device settings saved.",
      });
      router.refresh();
    } catch (saveError) {
      console.error("Failed to save device settings", saveError);
      toast({
        description: "Device settings could not be saved.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Device settings</h2>
      </div>

      {skipDeviceRegistration ? (
        <p className="text-xs text-purple-500">
          Device registration is skipped because `NEXT_PUBLIC_SKIP_DEVICE_REGISTRATION=True`.
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Register your device</Label>
          <div
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-amber-500"
            }`}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={deviceCode}
            disabled={isConnected || skipDeviceRegistration}
            onChange={(e) => setDeviceCode(e.target.value)}
            placeholder={isConnected ? "**********" : "Enter your device code"}
            maxLength={100}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isConnected || skipDeviceRegistration}
            onClick={async () => {
              const result = await connectUserToDevice(selectedUser.user_id, deviceCode);
              if (!result) {
                setError("Error registering device");
              } else {
                setError("");
                setDeviceCode("");
                toast({
                  description: "Device registered.",
                });
                router.refresh();
              }
            }}
          >
            Register
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          {isConnected ? (
            <span className="font-medium text-gray-800">Registered!</span>
          ) : error ? (
            <span className="text-red-500">{error}.</span>
          ) : (
            "Enter your device code to register it."
          )}
        </p>
      </div>

      {isConnected ? (
        <div className="space-y-3">
          <Label>Device volume</Label>
          <div className="flex items-center gap-3">
            <Slider
              value={volume}
              onValueChange={updateVolumeValue}
              className="w-full sm:max-w-sm"
              max={100}
              min={1}
              step={1}
            />
            <p className="min-w-10 text-sm text-gray-500">{volume[0]}%</p>
          </div>
          <Button
            onClick={saveDeviceSettings}
            disabled={isSaving}
            className="rounded-full flex flex-row gap-2 items-center"
            size="sm"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            {!isSaving && <Check className="w-4 h-4" />}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
