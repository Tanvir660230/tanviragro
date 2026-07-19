"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";
import { Button, buttonVariants } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadCattlePhoto, deleteCattlePhoto } from "@/app/dashboard/(app)/cattle/[id]/photo-actions";
import type { CattlePhoto, PhotoType } from "@/types/database";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BUCKET = "cattle-photos";

function photoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

interface Props {
  cattleId: string;
  photos: CattlePhoto[];
}

export function CattlePhotoGallery({ cattleId, photos: initialPhotos }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [photos, setPhotos] = useState<CattlePhoto[]>(initialPhotos);
  const [open, setOpen] = useState(false);
  const [photoType, setPhotoType] = useState<PhotoType>("current");
  const [takenAt, setTakenAt] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmPhoto, setConfirmPhoto] = useState<CattlePhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const purchasePhoto = photos.find((p) => p.photo_type === "purchase");
  const currentPhoto = [...photos]
    .filter((p) => p.photo_type === "current")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const TYPE_LABEL: Record<PhotoType, string> = {
    purchase: t.cattle_details.photos.purchase_photo,
    current: t.cattle_details.photos.current_photo,
    other: t.cattle_details.photos.other_photo,
  };

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError(t.cattle_details.photos.file_too_large);
      return;
    }
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("cattle_id", cattleId);
    fd.set("photo_type", photoType);
    setError(null);
    startTransition(async () => {
      const result = await uploadCattlePhoto(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setPreview(null);
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!confirmPhoto) return;
    const photo = confirmPhoto;
    setConfirmPhoto(null);
    startTransition(async () => {
      await deleteCattlePhoto(photo.id, photo.storage_path, cattleId);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {(["purchase", "current"] as const).map((type) => {
          const photo = type === "purchase" ? purchasePhoto : currentPhoto;
          return (
            <div key={type} className="relative">
              <div className="absolute top-2 left-2 z-10">
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                  {TYPE_LABEL[type]}
                </span>
              </div>
              {photo ? (
                <div className="group relative aspect-square overflow-hidden rounded-xl bg-muted border border-border/60 shadow-card">
                  <Image
                    src={photoUrl(photo.storage_path)}
                    alt={type}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 200px"
                  />
                  <button
                    onClick={() => setConfirmPhoto(photo)}
                    disabled={isPending}
                    className="absolute right-2 bottom-2 rounded-lg bg-destructive/90 p-1.5 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t.cattle_details.photos.delete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-32 md:h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-muted-foreground/50">
                  <Camera className="mb-2 h-8 w-8" />
                  <span className="text-xs">{t.cattle_details.photos.no_photo}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className={`${buttonVariants({ variant: "outline", size: "sm" })} gap-1.5`}>
          <Plus className="h-4 w-4" />
          {t.cattle_details.photos.upload_photo}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.cattle_details.photos.upload_cattle_photo}</DialogTitle>
          </DialogHeader>
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.cattle_details.photos.photo_type}</Label>
              <Select value={photoType} onValueChange={(v) => setPhotoType(v as PhotoType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">{t.cattle_details.photos.purchase_photo}</SelectItem>
                  <SelectItem value="current">{t.cattle_details.photos.current_photo}</SelectItem>
                  <SelectItem value="other">{t.cattle_details.photos.other_photo}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="taken_at">{t.cattle_details.photos.date_optional}</Label>
              <Input
                id="taken_at"
                name="taken_at"
                type="date"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="file">
                {t.cattle_details.photos.select_image} <span className="text-destructive">*</span>
              </Label>
              <Input
                ref={fileRef}
                id="file"
                name="file"
                type="file"
                accept="image/*"
                required
                onChange={onFileChange}
              />
              <p className="text-xs text-muted-foreground">{t.cattle_details.photos.max_size}</p>
            </div>

            {preview && (
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <Image src={preview} alt="Preview" fill className="object-contain" />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.cattle_details.photos.cancel}
              </Button>
              <Button type="submit" disabled={isPending} className="gap-1.5">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.cattle_details.photos.uploading}
                  </>
                ) : (
                  t.cattle_details.photos.upload
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmPhoto !== null}
        title="Delete Photo"
        description="Delete this photo permanently? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmPhoto(null)}
      />
    </div>
  );
}
