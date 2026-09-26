import { cache } from "react";

/**
 * One promise per key for the whole request (React's request cache), whichever Supabase client
 * the caller holds. `cache(fn)` keys on its arguments, and a client object is a new key for
 * every caller that made its own client — so the same big read ran again and again in one page.
 * Outside a server render (tests) nothing is memoized. A failed read is not kept.
 */
export function requestMemo<A extends unknown[], R>(keyOf: (...args: A) => string, fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  const store = cache(() => new Map<string, Promise<R>>());
  return (...args: A) => {
    const memo = store();
    const key = keyOf(...args);
    let p = memo.get(key);
    if (!p) {
      p = fn(...args);
      memo.set(key, p);
      p.catch(() => memo.delete(key));
    }
    return p;
  };
}
