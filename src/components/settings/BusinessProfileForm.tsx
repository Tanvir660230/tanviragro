"use client";

import { useActionState, useRef, useState, startTransition, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Building2 } from "lucide-react";
import {
  updateBusinessProfile,
  type SettingsFormState,
} from "@/app/dashboard/(app)/settings/actions";

interface BusinessProfileFormProps {
  initialData: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export function BusinessProfileForm({ initialData }: BusinessProfileFormProps) {
  const [state, formAction, isPending] = useActionState<
    SettingsFormState,
    FormData
  >(updateBusinessProfile, undefined);

  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      toast.success("Business profile saved");
      router.refresh();
    }
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state?.success, state?.error, router]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData.logo_url || null);
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
    
    // Override the logo file with the compressed one if available
    if (compressedFile) {
      formData.set("logo", compressedFile);
    }

    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <div 
          className="relative h-16 w-16 overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center shrink-0 cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Business Logo" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload className="h-5 w-5 text-white" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Business Logo</p>
          <p className="text-xs text-muted-foreground">Square image recommended</p>
        </div>
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          disabled={isCompressing}
          onChange={handleFileChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz_name">Business Name</Label>
        <Input
          id="biz_name"
          name="business_name"
          defaultValue={initialData.name}
          placeholder="e.g. Chowdhury Agro"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz_email">Business Email</Label>
        <Input
          id="biz_email"
          name="email"
          type="email"
          defaultValue={initialData.email || ""}
          placeholder="e.g. contact@yourfarm.com"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz_phone">Business Phone</Label>
        <Input
          id="biz_phone"
          name="phone"
          defaultValue={initialData.phone || ""}
          placeholder="e.g. +8801700000000"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          defaultValue={initialData.address || ""}
          placeholder="e.g. Savar, Dhaka"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save Business Profile
      </Button>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
