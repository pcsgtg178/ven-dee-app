"use client";

import React, { useState, useEffect } from "react";
import { Share, PlusSquare, X } from "lucide-react";

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Check if dismissed before
    const dismissed = localStorage.getItem("vendee_pwa_prompt_dismissed");
    if (dismissed) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isIOSDevice);

    // Show banner after a brief delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("vendee_pwa_prompt_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-secondary/30 bg-card-bg/95 p-3.5 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-600 text-white shadow-xs">
              <PlusSquare className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-main dark:text-white">
                ติดตั้ง VenDee ลงหน้าจอโฮม
              </h4>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
                {isIOS
                  ? "แตะปุ่มแชร์ด้านล่าง แล้วเลือก 'เพิ่มไปยังหน้าจอโฮม'"
                  : "ติดตั้งเป็นแอปเพื่อเปิดใช้งานได้รวดเร็วเต็มหน้าจอ"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-text-muted hover:bg-surface-subtle dark:hover:bg-zinc-800 touch-manipulation"
            aria-label="ปิดการแจ้งเตือน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {isIOS && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-surface-subtle/80 py-1.5 px-3 text-[11px] font-medium text-text-main dark:bg-zinc-800 dark:text-zinc-300">
            <span>แตะปุ่ม</span>
            <Share className="h-3.5 w-3.5 text-secondary inline" />
            <span>➔ เพิ่มไปยังหน้าจอโฮม</span>
          </div>
        )}
      </div>
    </div>
  );
}
