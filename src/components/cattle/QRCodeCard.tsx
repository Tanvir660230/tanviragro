"use client";

import { useState } from "react";
import { QrCode, Download, Printer, Copy, Check } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";
import { toast } from "sonner";

interface Props {
  cattleId: string;
  tagId: string;
}

export function QRCodeCard({ cattleId, tagId }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const qr = t.cattle_details.qr_code;
  const qrSrc = `/api/qr/${cattleId}`;

  function handlePrint() {
    const win = window.open("", "_blank", "width=400,height=500");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Cattle #${tagId} — QR Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 24px; }
    img { width: 220px; height: 220px; display: block; margin: 0 auto 12px; }
    h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 13px; }
  </style>
</head>
<body>
  <img src="${window.location.origin}${qrSrc}" alt="QR Code" />
  <h2>Cattle #${tagId}</h2>
  <p>${qr.print_heading}</p>
  <script>window.onload = function(){ window.print(); window.close(); }</script>
</body>
</html>`);
    win.document.close();
  }

  function handleCopyLink() {
    const fullUrl = `${window.location.origin}/dashboard/cattle/${cattleId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Cattle URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl bg-card p-5 border border-border/80 shadow-card">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <QrCode className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold tracking-tight">{qr.title}</h2>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Digital ID
        </span>
      </div>
      <div className="flex flex-wrap sm:flex-nowrap gap-5 items-start">
        {/* QR Image */}
        <div className="rounded-2xl overflow-hidden border border-border/80 shadow-xs p-3 bg-white dark:bg-slate-900 shrink-0 mx-auto sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR Code for cattle #${tagId}`}
            width={140}
            height={140}
            className="block aspect-square"
          />
        </div>

        {/* Info + Actions */}
        <div className="flex-1 min-w-0 space-y-3 pt-0.5">
          <div>
            <p className="text-sm font-bold text-foreground">Cattle #{tagId}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {qr.scan_hint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={qrSrc}
              download={`cattle-${tagId}-qr.svg`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              {qr.download}
            </a>
            <button
              onClick={handlePrint}
              aria-label={qr.print_label}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              {qr.print_label}
            </button>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/80 transition-colors shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {qr.attach_hint}
          </p>
        </div>
      </div>
    </div>
  );
}
