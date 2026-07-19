"use client";

import { QrCode, Download, Printer } from "lucide-react";
import { useTranslation } from "@/i18n/I18nProvider";

interface Props {
  cattleId: string;
  tagId: string;
}

export function QRCodeCard({ cattleId, tagId }: Props) {
  const { t } = useTranslation();
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
    body { font-family: sans-serif; text-align: center; padding: 24px; }
    img { width: 200px; height: 200px; display: block; margin: 0 auto 12px; }
    h2 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0; color: #666; font-size: 13px; }
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

  return (
    <div className="rounded-xl bg-card p-5 border border-border/60 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <QrCode className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{qr.title}</h2>
      </div>
      <div className="flex flex-wrap gap-5 items-start">
        {/* QR Image */}
        <div className="rounded-xl overflow-hidden border border-border/60 shadow-card p-2 bg-white dark:bg-slate-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR Code for cattle #${tagId}`}
            width={160}
            height={160}
            className="block"
          />
        </div>

        {/* Info + Actions */}
        <div className="flex-1 min-w-0 space-y-3 pt-1">
          <div>
            <p className="text-sm font-semibold">Cattle #{tagId}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {qr.scan_hint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={qrSrc}
              download={`cattle-${tagId}-qr.svg`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {qr.download}
            </a>
            <button
              onClick={handlePrint}
              aria-label={qr.print_label}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/70 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              {qr.print_label}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {qr.attach_hint}
          </p>
        </div>
      </div>
    </div>
  );
}
