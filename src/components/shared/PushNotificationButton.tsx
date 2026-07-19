"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n/I18nProvider";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushNotificationButton() {
  const { t } = useTranslation();
  const ns = t.settings;
  const [status, setStatus] = useState<"unsupported" | "denied" | "subscribed" | "unsubscribed">("unsubscribed");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setStatus(sub ? "subscribed" : "unsubscribed");
      });
    });
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  async function toggleSubscription() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (status === "subscribed") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
          setStatus("unsubscribed");
        }
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus("denied");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        setStatus("subscribed");
      }
    } catch {
      // Push setup failed
    } finally {
      setLoading(false);
    }
  }

  if (status === "unsupported") return null;

  return (
    <Button
      variant={status === "subscribed" ? "default" : "outline"}
      size="sm"
      onClick={toggleSubscription}
      disabled={loading || status === "denied"}
      className="gap-1.5"
      aria-label={ns.notifications}
      title={status === "denied" ? ns.notification_blocked : undefined}
    >
      {status === "subscribed" ? (
        <>
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">{ns.notification_enabled}</span>
        </>
      ) : status === "denied" ? (
        <>
          <BellOff className="h-4 w-4" />
          <span className="hidden sm:inline">{ns.notification_blocked}</span>
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          <span className="hidden sm:inline">{ns.notification_enable}</span>
        </>
      )}
    </Button>
  );
}
