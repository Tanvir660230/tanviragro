import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

try {
  if (process.env.VAPID_EMAIL && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  }
} catch (e) {
  console.warn("Vapid keys are invalid or missing. Push notifications will not work.", e);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let title: string, body: string, url: string | undefined, urgent: boolean | undefined, tag: string | undefined;
  try {
    ({ title, body, url, urgent, tag } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }
  if (!title || !body) return NextResponse.json({ error: "title and body are required" }, { status: 400 });

  // Get all subscriptions for this user
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const payload = JSON.stringify({ title, body, url, urgent, tag });
  let sent = 0;
  const failed: string[] = [];

  await Promise.all(
    subs.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: unknown) {
        if (err instanceof Error && (err as { statusCode?: number }).statusCode === 410) {
          // Subscription expired — clean up
          failed.push(sub.endpoint);
        }
      }
    })
  );

  // Remove expired subscriptions
  if (failed.length > 0) {
    await Promise.all(
      failed.map((ep) =>
        supabase.from("push_subscriptions").delete().eq("endpoint", ep)
      )
    );
  }

  return NextResponse.json({ sent, expired: failed.length });
}
