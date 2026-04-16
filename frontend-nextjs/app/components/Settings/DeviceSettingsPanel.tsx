"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ESPLoader, Transport, type IEspLoaderTerminal } from "esptool-js";
import { ArrowRight, Check, Loader2, Plug, Volume2 } from "lucide-react";

import { connectUserToDevice } from "@/app/actions";
import { updateDevice } from "@/db/devices";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface DeviceSettingsPanelProps {
  selectedUser: IUser;
}

const skipDeviceRegistration =
  process.env.NEXT_PUBLIC_SKIP_DEVICE_REGISTRATION === "True";
const flashImages = [
  {
    url: "https://raw.githubusercontent.com/akdeb/paul-health/refs/heads/main/releases/latest/bootloader.bin",
    address: 0x0,
    label: "bootloader.bin",
  },
  {
    url: "https://raw.githubusercontent.com/akdeb/paul-health/refs/heads/main/releases/latest/partitions.bin",
    address: 0x8000,
    label: "partitions.bin",
  },
  {
    url: "https://raw.githubusercontent.com/akdeb/paul-health/refs/heads/main/releases/latest/boot_app0.bin",
    address: 0xe000,
    label: "boot_app0.bin",
  },
  {
    url: "https://raw.githubusercontent.com/akdeb/paul-health/refs/heads/main/releases/latest/firmware.bin",
    address: 0x10000,
    label: "firmware.bin",
  },
] as const;

type BrowserSerialPort = {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable?: ReadableStream<Uint8Array>;
  writable?: WritableStream<Uint8Array>;
  getInfo?: () => {
    usbVendorId?: number;
    usbProductId?: number;
  };
};

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
  const [serialSupported, setSerialSupported] = useState(false);
  const [approvedPortCount, setApprovedPortCount] = useState(0);
  const [selectedPort, setSelectedPort] = useState<BrowserSerialPort | null>(null);
  const [isFindingPort, setIsFindingPort] = useState(false);
  const [isConnectingPort, setIsConnectingPort] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<number | null>(null);
  const [chipName, setChipName] = useState("");
  const [serialLogs, setSerialLogs] = useState("");
  const transportRef = useRef<Transport | null>(null);
  const loaderRef = useRef<ESPLoader | null>(null);

  useEffect(() => {
    setIsConnected(!!selectedUser.device?.device_id);
    setVolume([selectedUser.device?.volume ?? 50]);
  }, [selectedUser.device?.device_id, selectedUser.device?.volume]);

  useEffect(() => {
    return () => {
      void disconnectLoader();
      if (selectedPort?.readable || selectedPort?.writable) {
        void selectedPort.close().catch((closeError) => {
          console.error("Failed to close selected serial port during cleanup", closeError);
        });
      }
    };
  }, [selectedPort]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const serialApi = (
      navigator as Navigator & {
        serial?: {
          getPorts: () => Promise<BrowserSerialPort[]>;
          addEventListener?: (type: string, listener: EventListener) => void;
          removeEventListener?: (type: string, listener: EventListener) => void;
        };
      }
    ).serial;

    if (!serialApi) {
      return;
    }

    setSerialSupported(true);

    const refreshPorts = async () => {
      try {
        const ports = await serialApi.getPorts();
        setApprovedPortCount(ports.length);
      } catch (portError) {
        console.error("Failed to inspect serial ports", portError);
      }
    };

    const handlePortChange = () => {
      void refreshPorts();
    };

    void refreshPorts();
    serialApi.addEventListener?.("connect", handlePortChange);
    serialApi.addEventListener?.("disconnect", handlePortChange);

    return () => {
      serialApi.removeEventListener?.("connect", handlePortChange);
      serialApi.removeEventListener?.("disconnect", handlePortChange);
    };
  }, []);

  const updateVolumeValue = (value: number[]) => {
    setVolume(value);
  };

  const appendLog = (message: string) => {
    setSerialLogs((prev) => {
      const line = message.endsWith("\n") ? message : `${message}\n`;
      const next = `${prev}${line}`;
      return next.length > 24000 ? next.slice(-24000) : next;
    });
  };

  const disconnectLoader = async () => {
    try {
      await transportRef.current?.disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect transport", disconnectError);
    }

    transportRef.current = null;
    loaderRef.current = null;
  };

  const findPort = async () => {
    const serialApi = (
      navigator as Navigator & {
        serial?: {
          requestPort: (options?: unknown) => Promise<BrowserSerialPort>;
          getPorts: () => Promise<BrowserSerialPort[]>;
        };
      }
    ).serial;

    if (!serialApi) {
      toast({
        description: "Web Serial is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsFindingPort(true);
      const port = await serialApi.requestPort({
        filters: [
          { usbVendorId: 0x10c4 },
          { usbVendorId: 0x1a86 },
          { usbVendorId: 0x0403 },
          { usbVendorId: 0x303a },
        ],
      });
      setSelectedPort(port);
      const latestPorts = await serialApi.getPorts();
      setApprovedPortCount(latestPorts.length);
      const portInfo = port.getInfo?.();
      appendLog(
        `Serial port selected${
          portInfo?.usbVendorId
            ? ` (VID: 0x${portInfo.usbVendorId.toString(16)}, PID: 0x${(portInfo.usbProductId ?? 0).toString(16)})`
            : ""
        }.`
      );
    } catch (portError) {
      console.error("Failed to find serial port", portError);
      toast({
        description: "Could not select the ESP32 serial port.",
        variant: "destructive",
      });
    } finally {
      setIsFindingPort(false);
    }
  };

  const connectToPort = async () => {
    if (!selectedPort) {
      toast({
        description: "Select a serial port first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnectingPort(true);
      setChipName("");
      setFlashProgress(null);
      setSerialLogs("");
      await disconnectLoader();

      if (selectedPort.readable || selectedPort.writable) {
        appendLog("Closing previously-open serial handle.");
        await selectedPort.close();
      }

      const terminal: IEspLoaderTerminal = {
        clean() {
          setSerialLogs("");
        },
        write(data: string) {
          appendLog(data);
        },
        writeLine(data: string) {
          appendLog(data);
        },
      };

      const transport = new Transport(selectedPort as never, false);
      const loader = new ESPLoader({
        transport,
        baudrate: 115200,
        terminal,
        debugLogging: false,
      });

      transportRef.current = transport;
      loaderRef.current = loader;

      const chip = await loader.main();
      setChipName(chip);
      appendLog(`Connected to ${chip}.`);
    } catch (connectError) {
      console.error("Failed to connect to ESP32", connectError);
      appendLog(
        connectError instanceof Error
          ? `Connect failed: ${connectError.message}`
          : "Connect failed."
      );
      await disconnectLoader();
      toast({
        description:
          connectError instanceof Error
            ? connectError.message.includes("Failed to open serial port")
              ? "The serial port is busy. Close Arduino/PlatformIO monitors or any other tab using the ESP32, then try again."
              : connectError.message
            : "Could not connect to the selected ESP32.",
        variant: "destructive",
      });
    } finally {
      setIsConnectingPort(false);
    }
  };

  const flashDevice = async () => {
    if (!loaderRef.current) {
      toast({
        description: "Connect to the ESP32 first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsFlashing(true);
      setFlashProgress(0);
      appendLog("Fetching flash images...");

      const fileArray: { data: Uint8Array; address: number }[] = [];

      for (const image of flashImages) {
        appendLog(`Fetching ${image.label}...`);
        const response = await fetch(image.url);
        if (!response.ok) {
          throw new Error(`${image.label} download failed with status ${response.status}`);
        }

        const imageData = new Uint8Array(await response.arrayBuffer());
        appendLog(`${image.label} downloaded (${imageData.length} bytes).`);
        fileArray.push({ data: imageData, address: image.address });
      }

      await loaderRef.current.writeFlash({
        fileArray,
        flashMode: "keep",
        flashFreq: "keep",
        flashSize: "16MB",
        eraseAll: false,
        compress: true,
        reportProgress: (_fileIndex, written, total) => {
          const progress = total > 0 ? Math.round((written / total) * 100) : 0;
          setFlashProgress(progress);
        },
      });

      appendLog("Flash complete. Resetting device.");
      await loaderRef.current.after("hard_reset");
      await disconnectLoader();
      setChipName("");
      toast({
        description: "Device flashed successfully.",
      });
    } catch (flashError) {
      console.error("Failed to flash device", flashError);
      appendLog(
        flashError instanceof Error ? `Flash failed: ${flashError.message}` : "Flash failed."
      );
      toast({
        description: "Could not flash the device.",
        variant: "destructive",
      });
    } finally {
      setIsFlashing(false);
      setFlashProgress(null);
    }
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

      <div className="space-y-3">
<div className="flex flex-row gap-2 items-center">
        <Label>Flash device</Label>
        <Plug className="w-4 h-4" />
</div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={!serialSupported || isFindingPort || isConnectingPort || isFlashing}
            onClick={findPort}
          >
            {isFindingPort ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Find port
          </Button>
          <ArrowRight className="w-4 h-4" />
          <Button
            type="button"
            variant="blue"
            size="sm"
            className="rounded-full"
            disabled={!serialSupported || !selectedPort || isConnectingPort || isFlashing}
            onClick={connectToPort}
          >
            {isConnectingPort ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect
          </Button>

          <ArrowRight className="w-4 h-4" />
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={!loaderRef.current || isConnectingPort || isFlashing}
            onClick={flashDevice}
          >
            {isFlashing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isFlashing && flashProgress !== null ? `Flash ${flashProgress}%` : "Flash"}
          </Button>
        </div>

        <p className="text-sm text-gray-500">
          {!serialSupported
            ? "Web Serial is not supported in this browser."
            : chipName
              ? `Connected to ${chipName}.`
              : selectedPort
                ? "Port selected."
                : "No port selected."}
        </p>

        <Textarea
          readOnly
          value={serialLogs}
          placeholder="Logs will appear here."
          className="min-h-48 font-mono text-xs"
        />
      </div>

      {isConnected ? (
        <div className="space-y-3">
<div className="flex flex-row gap-2 items-center"> <Label>Device volume</Label><Volume2 className="w-4 h-4" />  </div>
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
