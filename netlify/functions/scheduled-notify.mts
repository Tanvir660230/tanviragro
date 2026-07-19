import type { Config } from "@netlify/functions";

// Runs every day at 08:00 UTC — replaces the Vercel Cron in vercel.json
const handler = async () => {
  const baseUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    console.error("scheduled-notify: missing URL or CRON_SECRET");
    return;
  }

  const res = await fetch(`${baseUrl}/api/notify/check`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json();
  console.log("scheduled-notify result:", JSON.stringify(data));
};

export default handler;

export const config: Config = {
  schedule: "0 8 * * *",
};
