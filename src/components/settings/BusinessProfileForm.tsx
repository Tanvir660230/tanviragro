"use client";

import { useActionState, useRef, useState, startTransition, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Building2, Mail, Phone, MapPin, CheckCircle2 } from "lucide-react";
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Logo upload row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload farm logo"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="relative h-18 w-18 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-background flex items-center justify-center shrink-0 cursor-pointer group transition-all shadow-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Business Logo" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
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
          <p className="text-sm font-semibold text-foreground">Farm logo</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            PNG, JPG, or WebP. Displayed on printable documents and invoices.
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
            Choose image
          </Button>
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

      {/* Form Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="biz_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Enterprise Name <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="biz_name"
              name="business_name"
              defaultValue={initialData.name}
              placeholder="e.g. Tanvir Agro Farm"
              required
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="biz_email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Official Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="biz_email"
              name="email"
              type="email"
              defaultValue={initialData.email || ""}
              placeholder="e.g. contact@agrofarm.com"
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="biz_phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contact Phone
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="biz_phone"
              name="phone"
              defaultValue={initialData.phone || ""}
              placeholder="e.g. +880 1700-000000"
              className="pl-9 h-10"
            />
          </div>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Farm / Office Address
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="address"
              name="address"
              defaultValue={initialData.address || ""}
              placeholder="e.g. Savar, Dhaka, Bangladesh"
              className="pl-9 h-10"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <p className="text-xs text-muted-foreground">
          Changes reflect immediately across all system reports and headers.
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
              Save Changes
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
