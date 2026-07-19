"use client";

import { useActionState, useRef, useState, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, User } from "lucide-react";
import {
  updateProfile,
  type SettingsFormState,
} from "@/app/dashboard/(app)/settings/actions";

interface ProfileFormProps {
  initialData: {
    full_name?: string | null;
    title?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState<
    SettingsFormState,
    FormData
  >(updateProfile, undefined);

  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Profile updated successfully");
      router.refresh();
    }
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.success, state?.error, router]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData.avatar_url || null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      try {
        setIsCompressing(true);
        const { compressImage } = await import("@/lib/imageCompression");
        const compressed = await compressImage(file, { maxWidthOrHeight: 500, maxSizeMB: 0.2 });
        setCompressedFile(compressed);
      } catch (error) {
        console.error("Compression failed", error);
        toast.error("Image compression failed. Please try a smaller file.");
        setPreviewUrl(null);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Override the avatar file with the compressed one if available
    if (compressedFile) {
      formData.set("avatar", compressedFile);
    }

    // Call the server action directly since we are intercepting the form
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <div 
          className="relative h-16 w-16 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center shrink-0 cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="h-5 w-5 text-white" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Profile Picture</p>
          <p className="text-xs text-muted-foreground">Click to upload a new avatar</p>
        </div>
        <input
          type="file"
          name="avatar"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          disabled={isCompressing}
          onChange={handleFileChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="full_name">Full Name</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={initialData.full_name || ""}
          placeholder="e.g. Tanvir Ahmed"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">Job Title / Role</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initialData.title || ""}
          placeholder="e.g. Farm Manager"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={initialData.phone || ""}
          placeholder="e.g. +8801700000000"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Profile
      </Button>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {state.success}
        </p>
      )}
    </form>
  );
}
