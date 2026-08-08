"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const PlayerDbView = dynamic(() => import("./player-db-view"), { ssr: false });
const MePreview = dynamic(() => import("./me-preview"), { ssr: false });

export default function DeferredEnhancers() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (windowWithIdle.requestIdleCallback) {
      const handle = windowWithIdle.requestIdleCallback(() => setReady(true), { timeout: 1_500 });
      return () => windowWithIdle.cancelIdleCallback?.(handle);
    }
    const handle = window.setTimeout(() => setReady(true), 500);
    return () => window.clearTimeout(handle);
  }, []);

  return ready ? <><PlayerDbView /><MePreview /></> : null;
}
