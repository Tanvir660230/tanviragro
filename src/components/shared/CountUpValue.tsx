"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/** Mirror of fmtBDT — runs on the client during animation */
function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}৳${(abs / 10_000_000).toFixed(2)} Cr`;
  if (abs >= 100_000) return `${sign}৳${(abs / 100_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}৳${(abs / 1_000).toFixed(1)}K`;
  return `${sign}৳${abs.toLocaleString("en-IN")}`;
}

/**
 * Parses a StatCard value string → { prefix, numericValue, isCurrency }
 * Handles: "12", "৳1.23K", "+৳1.23 L", "-৳45,678"
 */
function parse(value: string): { sign: string; numeric: number; isCurrency: boolean } {
  const sign = value.startsWith("+") ? "+" : value.startsWith("-") ? "-" : "";
  const withoutSign = sign ? value.slice(1) : value;
  const isCurrency = withoutSign.startsWith("৳");
  const raw = isCurrency ? withoutSign.slice(1).trim() : withoutSign.trim();

  let numeric = 0;
  if (raw.endsWith(" Cr")) numeric = parseFloat(raw) * 10_000_000;
  else if (raw.endsWith(" L")) numeric = parseFloat(raw) * 100_000;
  else if (raw.endsWith("K")) numeric = parseFloat(raw) * 1_000;
  else numeric = parseFloat(raw.replace(/,/g, "")) || 0;

  if (sign === "-") numeric = -numeric;
  return { sign, numeric, isCurrency };
}

interface Props {
  value: string;
  className?: string;
  duration?: number;
}

export function CountUpValue({ value, className, duration = 700 }: Props) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  const prevValue = useRef<string | null>(null);

  useEffect(() => {
    // Skip animation on first render if value hasn't changed
    if (prevValue.current === value) return;
    prevValue.current = value;

    const { sign, numeric, isCurrency } = parse(value);
    const absTarget = Math.abs(numeric);

    // Plain integer (e.g. cattle count) — just count up
    const isPlain = !isCurrency;

    if (absTarget === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }

    let startTime: number | null = null;

    const tick = (ts: number) => {
      if (startTime === null) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = eased * absTarget * (numeric < 0 ? -1 : 1);

      if (isPlain) {
        const rounded = Math.round(Math.abs(current));
        setDisplay((numeric < 0 ? "-" : "") + rounded.toString());
      } else {
        const withSign = sign === "+" && current >= 0 ? "+" + fmt(current) : fmt(current);
        setDisplay(withSign);
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value); // snap to exact final string
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display}</span>;
}
