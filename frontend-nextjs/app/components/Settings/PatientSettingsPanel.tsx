"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, Trash2, Upload } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { createPhoto, deletePhoto, getPhotosByPatientId } from "@/db/photos";
import { updatePatient } from "@/db/patients";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface PatientSettingsPanelProps {
  selectedUser: IUser;
}

const GENDER_OPTIONS: Array<IPatient["gender"]> = [
  "male",
  "female",
  "non-binary",
];

const IANA_TIMEZONES = typeof Intl.supportedValuesOf === "function"
  ? Intl.supportedValuesOf("timeZone")
  : [
      "UTC",
      "Europe/London",
      "America/New_York",
      "America/Los_Angeles",
      "Asia/Kolkata",
      "Australia/Sydney",
    ];

export default function PatientSettingsPanel({
  selectedUser,
}: PatientSettingsPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const patient = selectedUser.patient;

  const [name, setName] = useState(patient?.name ?? "");
  const [age, setAge] = useState<number>(patient?.age ?? 0);
  const [gender, setGender] = useState<IPatient["gender"]>(
    patient?.gender ?? "male",
  );
  const [address, setAddress] = useState(patient?.address ?? "");
  const [about, setAbout] = useState(patient?.about ?? "");
  const [timezone, setTimezone] = useState(patient?.timezone ?? "UTC");
  const [jobs, setJobs] = useState<string[]>(patient?.jobs ?? []);
  const [relations, setRelations] = useState<string[]>(patient?.relations ?? []);
  const [stories, setStories] = useState<string[]>(patient?.stories ?? []);
  const [avoid, setAvoid] = useState<string[]>(patient?.avoid ?? []);
  const [photos, setPhotos] = useState<IPhoto[]>([]);
  const [draftPhotoFile, setDraftPhotoFile] = useState<File | null>(null);
  const [draftPhotoPreviewUrl, setDraftPhotoPreviewUrl] = useState<string | null>(null);
  const [draftPhotoCaption, setDraftPhotoCaption] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    setName(patient?.name ?? "");
    setAge(patient?.age ?? 0);
    setGender(patient?.gender ?? "male");
    setAddress(patient?.address ?? "");
    setAbout(patient?.about ?? "");
    setTimezone(patient?.timezone ?? "UTC");
    setJobs(patient?.jobs ?? []);
    setRelations(patient?.relations ?? []);
    setStories(patient?.stories ?? []);
    setAvoid(patient?.avoid ?? []);
  }, [patient]);

  useEffect(() => {
    if (!patient?.patient_id) {
      setPhotos([]);
      return;
    }

    const loadPhotos = async () => {
      const items = await getPhotosByPatientId(supabase, patient.patient_id);
      setPhotos(items.filter((item) => item.type === "album"));
    };

    void loadPhotos();
  }, [patient?.patient_id, supabase]);

  useEffect(() => {
    if (!draftPhotoFile) {
      setDraftPhotoPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(draftPhotoFile);
    setDraftPhotoPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [draftPhotoFile]);

  const photoCountLabel = useMemo(
    () => `${photos.length}/5 photos uploaded`,
    [photos.length],
  );

  const updateListValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? value : item
    )));
  };

  const addListValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) => [...prev, ""]);
  };

  const removeListValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) => {
    setter((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const resetDraftPhoto = () => {
    setDraftPhotoFile(null);
    setDraftPhotoCaption("");
  };

  const invalidateUserContextCache = async () => {
    const response = await fetch("/api/cache/user-context", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to invalidate user context cache");
    }
  };

  const savePatientSettings = async () => {
    if (!patient?.patient_id) {
      toast({
        description: "Patient record not found.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const updatedPatient = await updatePatient(supabase, patient.patient_id, {
      name,
      age,
      gender,
      address,
      about,
      timezone,
      jobs: jobs.filter(Boolean),
      relations: relations.filter(Boolean),
      stories: stories.filter(Boolean),
      avoid: avoid.filter(Boolean),
    });

    if (!updatedPatient) {
      setIsSaving(false);
      toast({
        description: "Patient settings could not be saved.",
        variant: "destructive",
      });
      return;
    }

    try {
      await invalidateUserContextCache();
      toast({
        description: "Patient settings saved.",
      });
      router.refresh();
    } catch (error) {
      console.error("Error invalidating patient cache:", error);
      toast({
        description: "Patient saved, but cache refresh failed.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const savePhoto = async () => {
    if (!patient?.patient_id || !draftPhotoFile) {
      return;
    }

    if (photos.length >= 5) {
      toast({
        description: "You can upload up to 5 patient photos.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    const fileExt = draftPhotoFile.name.split(".").pop() ?? "jpg";
    const objectPath = `${patient.patient_id}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("patient_photos")
      .upload(objectPath, draftPhotoFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setIsUploadingPhoto(false);
      toast({
        description: "Failed to upload photo.",
        variant: "destructive",
      });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("patient_photos")
      .getPublicUrl(objectPath);

    const createdPhoto = await createPhoto(supabase, {
      patient_id: patient.patient_id,
      type: "album",
      url: publicUrlData.publicUrl,
      caption: draftPhotoCaption.slice(0, 160),
    });

    setIsUploadingPhoto(false);

    if (!createdPhoto) {
      toast({
        description: "Photo metadata could not be saved.",
        variant: "destructive",
      });
      return;
    }

    setPhotos((prev) => [createdPhoto, ...prev].slice(0, 5));
    resetDraftPhoto();
    toast({
      description: "Photo uploaded.",
    });
    router.refresh();
  };

  const removePhoto = async (photo: IPhoto) => {
    const removed = await deletePhoto(supabase, photo.photo_id);

    if (!removed) {
      toast({
        description: "Failed to remove photo.",
        variant: "destructive",
      });
      return;
    }

    const storagePath = getPatientPhotoStoragePath(photo.url, patient?.patient_id);
    if (storagePath) {
      const { error } = await supabase.storage
        .from("patient_photos")
        .remove([storagePath]);

      if (error) {
        toast({
          description: "Photo removed, but storage cleanup needs attention.",
          variant: "destructive",
        });
      }
    }

    setPhotos((prev) => prev.filter((item) => item.photo_id !== photo.photo_id));
    router.refresh();
  };

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Patient settings</h2>
        <p className="text-sm text-gray-500">
          Capture personal context that helps the companion speak naturally and avoid harmful topics.
        </p>
      </div>

      <PatientPhotoAlbumEditor
        canAddPhoto={photos.length < 5}
        isUploadingPhoto={isUploadingPhoto}
        photoCountLabel={photoCountLabel}
        photos={photos}
        draftPhotoFile={draftPhotoFile}
        draftPhotoPreviewUrl={draftPhotoPreviewUrl}
        draftPhotoCaption={draftPhotoCaption}
        onDraftPhotoSelected={setDraftPhotoFile}
        onDraftPhotoCaptionChange={setDraftPhotoCaption}
        onDraftPhotoCancel={resetDraftPhoto}
        onDraftPhotoSave={savePhoto}
        onDeletePhoto={removePhoto}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="patient_name">Patient name</Label>
          <Input
            id="patient_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paul"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="patient_age">Age</Label>
          <Input
            id="patient_age"
            type="number"
            min={0}
            max={120}
            value={age || ""}
            onChange={(e) => setAge(Number(e.target.value))}
            placeholder="e.g. 72"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="patient_gender">Gender</Label>
          <Select
            value={gender}
            onValueChange={(value: IPatient["gender"]) => setGender(value)}
          >
            <SelectTrigger id="patient_gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="patient_address">Address</Label>
          <Input
            id="patient_address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 12 Church Lane, London"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient_timezone">Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="patient_timezone">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {IANA_TIMEZONES.map((timeZone) => (
              <SelectItem key={timeZone} value={timeZone}>
                {timeZone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="patient_about">About</Label>
        <Textarea
          id="patient_about"
          rows={5}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="A short overview of the patient, their personality, routines, and preferences."
        />
      </div>

      <PatientListEditor
        label="Jobs"
        description="Roles, occupations, or identities that are important to remember."
        items={jobs}
        onAdd={() => addListValue(setJobs)}
        onChange={(index, value) => updateListValue(setJobs, index, value)}
        onRemove={(index) => removeListValue(setJobs, index)}
        placeholder="e.g. Retired mechanic"
      />

      <PatientListEditor
        label="Relations"
        description='Examples: "Torsten is Paul’s son, Matt is Paul’s carer and friend", "Rodney was Paul’s childhood cat".'
        items={relations}
        onAdd={() => addListValue(setRelations)}
        onChange={(index, value) => updateListValue(setRelations, index, value)}
        onRemove={(index) => removeListValue(setRelations, index)}
        placeholder="e.g. Torsten is Paul’s son."
      />

      <PatientListEditor
        label="Stories"
        description='Example: "Paul used to play in a blues brothers tribute band called the boogie brothers blues band".'
        items={stories}
        onAdd={() => addListValue(setStories)}
        onChange={(index, value) => updateListValue(setStories, index, value)}
        onRemove={(index) => removeListValue(setStories, index)}
        placeholder="e.g. Paul used to play in a tribute band."
      />

      <PatientListEditor
        label="Topics to avoid"
        description='Examples: "Politics".'
        items={avoid}
        onAdd={() => addListValue(setAvoid)}
        onChange={(index, value) => updateListValue(setAvoid, index, value)}
        onRemove={(index) => removeListValue(setAvoid, index)}
        placeholder="e.g. Politics"
      />

      <Button
        onClick={savePatientSettings}
        disabled={isSaving}
        className="flex flex-row items-center gap-2 rounded-full"
        size="sm"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        {!isSaving && <Check className="h-4 w-4" />}
      </Button>
    </section>
  );
}

function PatientPhotoAlbumEditor({
  canAddPhoto,
  isUploadingPhoto,
  photoCountLabel,
  photos,
  draftPhotoFile,
  draftPhotoPreviewUrl,
  draftPhotoCaption,
  onDraftPhotoSelected,
  onDraftPhotoCaptionChange,
  onDraftPhotoCancel,
  onDraftPhotoSave,
  onDeletePhoto,
}: {
  canAddPhoto: boolean;
  isUploadingPhoto: boolean;
  photoCountLabel: string;
  photos: IPhoto[];
  draftPhotoFile: File | null;
  draftPhotoPreviewUrl: string | null;
  draftPhotoCaption: string;
  onDraftPhotoSelected: (file: File | null) => void;
  onDraftPhotoCaptionChange: (caption: string) => void;
  onDraftPhotoCancel: () => void;
  onDraftPhotoSave: () => Promise<void>;
  onDeletePhoto: (photo: IPhoto) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onDraftPhotoSelected(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {canAddPhoto ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              "group flex min-h-[220px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-300 px-6 py-10 text-center transition hover:border-gray-500 hover:bg-gray-50",
              draftPhotoFile ? "border-gray-500 bg-gray-50" : "",
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full transition group-hover:scale-105">
              <Plus className="h-7 w-7" />
            </span>
            <span className="mt-4 text-base font-medium text-gray-800">
              Add album photo
            </span>
            <span className="mt-1 text-sm text-gray-500">
              Choose a familiar image and add a short caption.
            </span>
          </button>
        ) : null}
        {photos.map((photo) => (
          <div
            key={photo.photo_id}
            className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] bg-gray-100">
              <Image
                src={photo.url}
                alt={photo.caption || "Patient album photo"}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="space-y-3 p-4">
              <p className="min-h-4 text-sm leading-5 text-gray-600">
                {photo.caption || "No caption yet."}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => void onDeletePhoto(photo)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {draftPhotoFile && draftPhotoPreviewUrl ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[180px,1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100">
              <Image
                src={draftPhotoPreviewUrl}
                alt="Selected patient photo"
                fill
                sizes="180px"
                className="object-cover"
                unoptimized
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draft_photo_caption">Photo caption</Label>
                <Textarea
                  id="draft_photo_caption"
                  rows={4}
                  maxLength={160}
                  value={draftPhotoCaption}
                  onChange={(event) => onDraftPhotoCaptionChange(event.target.value)}
                  placeholder="e.g. Paul and Torsten at the beach in Brighton."
                />
                <p className="text-xs text-gray-400">
                  Keep it short and concrete. {draftPhotoCaption.length}/160
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={isUploadingPhoto}
                  onClick={() => void onDraftPhotoSave()}
                >
                  {isUploadingPhoto ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Save photo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={isUploadingPhoto}
                  onClick={onDraftPhotoCancel}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
          {photoCountLabel}
        </p>
      </div>
    </div>
  );
}

function PatientListEditor({
  label,
  description,
  items,
  onAdd,
  onChange,
  onRemove,
  placeholder,
}: {
  label: string;
  description: string;
  items: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-start gap-2">
          <Label>{label}</Label>
          <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" />
            <span>Add</span>
          </Button>
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No entries added yet.</p>
        ) : null}

        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-start gap-2">
            <Input
              value={item}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={placeholder}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${label} entry ${index + 1}`}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPatientPhotoStoragePath(url: string, patientId?: string) {
  const marker = "/storage/v1/object/public/patient_photos/";
  const markerIndex = url.indexOf(marker);

  if (markerIndex >= 0) {
    return url.slice(markerIndex + marker.length);
  }

  if (!patientId) {
    return null;
  }

  const patientFolderIndex = url.indexOf(`${patientId}/`);
  if (patientFolderIndex >= 0) {
    return url.slice(patientFolderIndex);
  }

  return null;
}
