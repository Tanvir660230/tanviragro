/** Display helpers for partner pages. The money figures come from lib/partners/position.ts. */

export function bdt(n: number): string {
  return `৳${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

const AVATAR_PAL = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-600",
  "bg-indigo-500",
  "bg-pink-500",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return AVATAR_PAL[h % AVATAR_PAL.length];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
