import { useEffect } from "react";

let lockCounter = 0;

/**
 * Manages body scroll locking safely, preventing race conditions where 
 * multiple components try to unlock the scroll while others still need it locked.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) {
      lockCounter++;
      if (lockCounter === 1) {
        document.body.style.overflow = "hidden";
      }
    } else {
      if (lockCounter > 0) {
        lockCounter--;
        if (lockCounter === 0) {
          document.body.style.overflow = "";
        }
      }
    }
    return () => {
      if (locked) {
        lockCounter = Math.max(0, lockCounter - 1);
        if (lockCounter === 0) {
          document.body.style.overflow = "";
        }
      }
    };
  }, [locked]);
}
