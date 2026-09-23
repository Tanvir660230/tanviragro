"use client";

import { useActionState, useRef, useState, startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, User, Mail, Phone, Briefcase, CheckCircle2 } from "lucide-react";
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div 
          role="button"
          tabIndex={0}
          aria-label="Upload profile avatar"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="relative h-18 w-18 sm:h-20 sm:w-20 overflow-hidden rounded-full border-2 border-dashed border-border hover:border-primary/60 bg-background flex items-center justify-center shrink-0 cursor-pointer group transition-all shadow-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <User className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-medium">
            <Upload className="h-4 w-4 mb-0.5" />
            <span>Upload</span>
          </div>
          {isCompressing && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">User Profile Avatar</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your personal picture shown in the top navigation, activity feed, and team list.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 mt-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing}
          >
            <Upload className="h-3 w-3" />
            Choose photo
          </Button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="full_name"
              name="full_name"
              defaultValue={initialData.full_name || ""}
              placeholder="e.g. Tanvir Ahmed"
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Job Title / Position
          </Label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="title"
              name="title"
              defaultValue={initialData.title || ""}
              placeholder="e.g. Managing Director / Owner"
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Direct Phone Number
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              name="phone"
              defaultValue={initialData.phone || ""}
              placeholder="e.g. +880 1700-000000"
              className="pl-9 h-10"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          Your personal details are used for activity auditing and team communication.
        </p>
        <Button type="submit" disabled={isPending || isCompressing} className="gap-1.5 shadow-sm">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Save Profile
            </>
          )}
        </Button>
      </div>

      {state?.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-medium">
          {state.error}
        </div>
      )}
    </form>
  );
}
