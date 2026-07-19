// ── Notification helpers ──────────────────────────────────────────

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  urgent?: boolean;
  tag?: string;
}

// ── Web Push ──────────────────────────────────────────────────────

export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload,
  baseUrl: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Push failure is non-critical
  }
}

// ── WhatsApp via Fonnte.com ───────────────────────────────────────
// Get your token from: https://fonnte.com
// Set env vars: WHATSAPP_TOKEN and WHATSAPP_NUMBER

export type WhatsAppResult =
  | { sent: true }
  | { sent: false; reason: "no_config" | "token_invalid" | "network_error" | "api_error"; detail?: string };

export async function sendWhatsApp(
  message: string,
  targetNumber?: string
): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const defaultNumber = process.env.WHATSAPP_NUMBER;
  const to = targetNumber ?? defaultNumber;

  if (!token || !to) return { sent: false, reason: "no_config" };

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: to,
        message,
        delay: "0",
        countryCode: "880",
      }),
    });
    const json = await res.json() as { status: boolean; reason?: string; message?: string };

    if (json.status === true) return { sent: true };

    // Fonnte returns status:false with a reason string when token is bad
    const detail = json.reason ?? json.message ?? "unknown";
    const isTokenBad =
      /not authenticated|token|unauthorized|invalid/i.test(detail) || res.status === 401;

    if (isTokenBad) {
      console.error("[WhatsApp] Token invalid or expired — update WHATSAPP_TOKEN in env vars. Detail:", detail);
      return { sent: false, reason: "token_invalid", detail };
    }

    return { sent: false, reason: "api_error", detail };
  } catch (err) {
    return { sent: false, reason: "network_error", detail: String(err) };
  }
}

// ── Fallback alert email (used when WhatsApp fails) ───────────────

export async function sendAlertEmail(subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BACKUP_EMAIL;
  if (!apiKey || !to) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Chowdhury Agro Alerts <backup@chowdhury-agro.com>",
        to: [to],
        subject,
        text: body,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Send with email fallback ──────────────────────────────────────

export async function sendWhatsAppWithFallback(
  message: string,
  emailSubject: string
): Promise<void> {
  const result = await sendWhatsApp(message);
  if (result.sent) return;

  console.warn(`[WhatsApp] Failed (${result.reason}). Falling back to email.`);
  const sent = await sendAlertEmail(emailSubject, message);
  if (!sent) {
    console.error("[Alert] Both WhatsApp and email fallback failed. Subject:", emailSubject);
  }
}

// ── Alert: Low Stock ─────────────────────────────────────────────

export async function sendLowStockAlert(
  itemName: string,
  daysLeft: number,
  currentStock: number,
  unit: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const message =
    `⚠️ *Chowdhury Agro — Low Stock Alert*\n\n` +
    `📦 আইটেম: *${itemName}*\n` +
    `📊 বর্তমান স্টক: ${currentStock.toFixed(1)} ${unit}\n` +
    `⏰ আর মাত্র *${daysLeft} দিন* বাকি\n\n` +
    `👉 এখনই রিস্টক করুন: ${appUrl}/dashboard/inventory`;

  await sendWhatsAppWithFallback(message, `Low Stock: ${itemName}`);
}

// ── Alert: Expiring Stock ──────────────────────────────────────────

export async function sendExpiringStockAlert(
  items: { name: string; expiryDate: string; qty: number; unit: string }[]
): Promise<void> {
  if (items.length === 0) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const lines = items
    .map((i) => `- ${i.name}: ${i.qty.toFixed(1)} ${i.unit} (expires ${i.expiryDate})`)
    .join("\n");
  const message =
    `⏳ *Chowdhury Agro — Expiring Soon*\n\n` +
    `${lines}\n\n` +
    `👉 Check stock: ${appUrl}/dashboard/inventory`;

  await sendWhatsAppWithFallback(message, "Inventory Expiring Soon");
}

// ── Alert: Health Event Overdue ──────────────────────────────────

export async function sendHealthEventAlert(
  cattleTag: string,
  eventTitle: string,
  scheduledAt: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const message =
    `🐄 *Chowdhury Agro — Health Alert*\n\n` +
    `গরু: *${cattleTag}*\n` +
    `ইভেন্ট: *${eventTitle}*\n` +
    `নির্ধারিত ছিল: ${new Date(scheduledAt).toLocaleDateString("bn-BD")}\n` +
    `⚠️ এই ইভেন্টটি মেয়াদ পেরিয়ে গেছে!\n\n` +
    `👉 Dashboard: ${appUrl}/dashboard/cattle`;

  await sendWhatsAppWithFallback(message, `Health Alert: Cow #${cattleTag} — ${eventTitle}`);
}

// ── Alert: Upcoming Health Event (tomorrow) ──────────────────────

export async function sendUpcomingHealthAlert(
  cattleTag: string,
  eventTitle: string,
  scheduledAt: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const message =
    `📅 *Chowdhury Agro — আগামীকাল Health Event*\n\n` +
    `গরু: *${cattleTag}*\n` +
    `ইভেন্ট: *${eventTitle}*\n` +
    `তারিখ: ${new Date(scheduledAt).toLocaleDateString("bn-BD")}\n\n` +
    `✅ সময়মতো সম্পন্ন করুন!\n` +
    `👉 ${appUrl}/dashboard/cattle`;

  await sendWhatsAppWithFallback(message, `Upcoming Health Event: Cow #${cattleTag} tomorrow`);
}

// ── Alert: Missing Weight (weekly) ───────────────────────────────

export async function sendMissingWeightAlert(tags: string[]): Promise<void> {
  if (tags.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const list = tags.map((t) => `• ${t}`).join("\n");
  const message =
    `⚖️ *Chowdhury Agro — ওজন নেওয়া হয়নি*\n\n` +
    `নিচের *${tags.length}টি গরু*র ওজন গত ৭ দিনে নেওয়া হয়নি:\n\n` +
    `${list}\n\n` +
    `📊 সঠিক ADG ট্র্যাক করতে নিয়মিত ওজন নিন।\n` +
    `👉 ${appUrl}/dashboard/cattle`;

  await sendWhatsAppWithFallback(message, `Missing Weight: ${tags.length} cattle not weighed`);
}

// ── Alert: Sell Window ────────────────────────────────────────────

export interface SellWindowCattle {
  tag: string;
  daysInPen: number;
  currentWeightKg: number;
  adgKg: number;
}

export async function sendSellWindowAlert(
  cattle: SellWindowCattle[]
): Promise<void> {
  if (cattle.length === 0) return;

  const list = cattle
    .map(
      (c) =>
        `• *${c.tag}* — ${c.currentWeightKg.toFixed(0)} kg | ${c.daysInPen} দিন | ADG: ${c.adgKg.toFixed(2)} kg/day`
    )
    .join("\n");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const message =
    `💰 *Chowdhury Agro — Sell Window Alert*\n\n` +
    `নিচের *${cattle.length}টি গরু* বিক্রির উপযুক্ত সময়ে এসে গেছে:\n\n` +
    `${list}\n\n` +
    `📈 ৯০+ দিন পেনে এবং ৩০%+ ওজন বৃদ্ধি হয়েছে।\n` +
    `👉 বিক্রির পরিকল্পনা করুন: ${appUrl}/dashboard/cattle`;

  await sendWhatsAppWithFallback(message, `Sell Window Alert: ${cattle.length} cattle ready`);
}

// ── Alert: Weekly Digest ─────────────────────────────────────────

export interface WeeklyDigestStats {
  activeCattle: number;
  sellReady: number;
  overdueHealth: number;
  lowStockItems: number;
  missingWeightCattle: number;
  weeklyAlerts: string[];
}

export async function sendWeeklyDigest(
  stats: WeeklyDigestStats
): Promise<void> {
  const statusLine = (count: number, ok: string, warn: string) =>
    count === 0 ? `✅ ${ok}` : `⚠️ ${warn}: ${count}টি`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://caagro.netlify.app";
  const message =
    `📊 *Chowdhury Agro — সাপ্তাহিক সারসংক্ষেপ*\n` +
    `${new Date().toLocaleDateString("bn-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n` +
    `🐄 সক্রিয় গরু: *${stats.activeCattle}টি*\n` +
    `💰 বিক্রির উপযুক্ত: *${stats.sellReady}টি*\n\n` +
    `${statusLine(stats.overdueHealth, "সব health event সময়মতো", "মেয়াদ পেরিয়ে গেছে")}\n` +
    `${statusLine(stats.lowStockItems, "সব স্টক পর্যাপ্ত", "কম স্টক আইটেম")}\n` +
    `${statusLine(stats.missingWeightCattle, "সব গরুর ওজন আপডেট", "ওজন মিসিং (৭+ দিন)")}\n\n` +
    (stats.weeklyAlerts.length > 0
      ? `🔔 এই সপ্তাহের alerts:\n${stats.weeklyAlerts.map((a) => `• ${a}`).join("\n")}\n\n`
      : ``) +
    `👉 Dashboard: ${appUrl}/dashboard`;

  await sendWhatsAppWithFallback(message, "Chowdhury Agro — Weekly Digest");
}
