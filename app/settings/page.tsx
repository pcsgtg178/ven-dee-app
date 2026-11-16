"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Sun,
  Moon,
  Laptop,
  RotateCw,
  Check,
  CalendarDays,
  Users,
  Pill,
  Briefcase,
  HeartHandshake,
  CalendarCheck,
  Wifi,
  WifiOff,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import moment from "moment";
import "moment/locale/th";
import AppBar from "../components/AppBar";
import BottomNav, { BottomNavSpacer } from "../components/BottomNav";
import {
  getShifts,
  getServices,
  getCustomers,
  getMedications,
  getClinicLogs,
  getPersonalEvents,
  syncAllDataFromApi,
  subscribeToSyncState,
  isDbSyncDisabled,
} from "../../lib/storage";

type ThemeOption = "light" | "dark" | "system";

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeOption>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isDevTestMode, setIsDevTestMode] = useState(false);

  // Data counts
  const [counts, setCounts] = useState({
    shifts: 0,
    services: 0,
    customers: 0,
    medications: 0,
    clinicLogs: 0,
    personalEvents: 0,
  });

  const refreshCounts = useCallback(() => {
    try {
      setCounts({
        shifts: getShifts().length,
        services: getServices().length,
        customers: getCustomers().length,
        medications: getMedications().length,
        clinicLogs: getClinicLogs().length,
        personalEvents: getPersonalEvents().length,
      });
    } catch {
      // Ignore if localStorage not accessible
    }
  }, []);

  // Initialize theme & sync info
  useEffect(() => {
    setMounted(true);
    refreshCounts();

    // Load stored theme
    try {
      const stored = localStorage.getItem("vendee_theme") as ThemeOption | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setTheme(stored);
      } else {
        setTheme("system");
      }

      const lastSync = localStorage.getItem("vendee_last_sync_time");
      if (lastSync) {
        setLastSyncTime(lastSync);
      }
    } catch {
      // Ignore error
    }

    // Media query listener for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemIsDark(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
      const stored = localStorage.getItem("vendee_theme");
      if (!stored || stored === "system") {
        if (e.matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);

    // Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    setIsDevTestMode(isDbSyncDisabled());
    const handleConfigChange = () => {
      setIsDevTestMode(isDbSyncDisabled());
    };
    window.addEventListener("vendee_sync_config_changed", handleConfigChange);

    // Sync state subscription
    const unsubSync = subscribeToSyncState((state) => {
      setIsSyncing(state.isSyncing);
      if (state.isOnline !== null) {
        setIsOnline(state.isOnline);
      }
    });

    return () => {
      mediaQuery.removeEventListener("change", handleMediaChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("vendee_sync_config_changed", handleConfigChange);
      unsubSync();
    };
  }, [refreshCounts]);

  const applyTheme = (option: ThemeOption) => {
    setTheme(option);
    try {
      localStorage.setItem("vendee_theme", option);
    } catch {
      // Ignore error
    }

    const isMediaDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let shouldBeDark = false;

    if (option === "dark") {
      shouldBeDark = true;
    } else if (option === "light") {
      shouldBeDark = false;
    } else {
      // system
      shouldBeDark = isMediaDark;
    }

    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    window.dispatchEvent(
      new CustomEvent("vendee_theme_changed", {
        detail: { theme: option, isDark: shouldBeDark },
      })
    );
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);

    if (isDbSyncDisabled()) {
      setIsSyncing(false);
      setSyncMessage("กำลังทำงานในโหมดทดสอบในเครื่อง (Local Test Only): ปิดการซิงก์ฐานข้อมูลเพื่อความปลอดภัย");
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }

    try {
      const res = await syncAllDataFromApi();
      const nowStr = moment().locale("th").format("D MMMM YYYY เวลา HH:mm น.");
      setLastSyncTime(nowStr);
      try {
        localStorage.setItem("vendee_last_sync_time", nowStr);
      } catch {
        // Ignore
      }
      refreshCounts();

      if (res.isOnline) {
        setSyncMessage("ซิงก์ข้อมูลกับ Supabase สำเร็จเรียบร้อยแล้ว");
      } else {
        setSyncMessage("ใช้งานโหมดออฟไลน์: บันทึกข้อมูลในเครื่องเรียบร้อย");
      }
    } catch (err: any) {
      setSyncMessage(err.message || "เกิดข้อผิดพลาดในการซิงก์ข้อมูล");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-ds-bg text-ds-text flex flex-col">
      {/* App Bar */}
      <AppBar
        title="การตั้งค่า"
        leftAction={
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ds-icon-secondary hover:bg-ds-surface-elevated hover:text-ds-text transition-colors"
            aria-label="กลับหน้าหลัก"
            title="กลับหน้าหลัก"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        }
        isSyncing={isSyncing}
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 space-y-4">
        {/* Toast / Sync Feedback */}
        {syncMessage && (
          <div className="rounded-2xl border border-ds-primary/40 bg-ds-surface-elevated px-4 py-2.5 text-xs font-bold text-ds-text shadow-ds-popover animate-in fade-in flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-ds-primary" />
              <span>{syncMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              aria-label="ปิดการแจ้งเตือน"
              className="text-ds-icon-secondary hover:text-ds-text cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. THEME SETTINGS (PROJECT_RULES.md §3: Light / Dark / System) */}
        <section className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-divider text-ds-icon-secondary">
              <Sun className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-ds-text">
                ธีมและการแสดงผล
              </h2>
              <p className="text-[11px] text-ds-text-secondary">
                เลือกรูปแบบสีที่สบายตาสำหรับการใช้งาน
              </p>
            </div>
          </div>

          {/* Theme Option Cards */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Light Option */}
            <button
              type="button"
              onClick={() => applyTheme("light")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all cursor-pointer ${
                theme === "light"
                  ? "border-ds-primary bg-ds-primary-container/50 ring-2 ring-ds-primary/25 text-ds-text"
                  : "border-ds-border bg-ds-surface-elevated hover:bg-ds-surface-variant text-ds-text-secondary"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  theme === "light"
                    ? "bg-ds-primary text-ds-on-primary shadow-2xs"
                    : "bg-ds-surface text-ds-icon-secondary border border-ds-divider"
                }`}
              >
                <Sun className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold leading-tight">สว่าง</span>
                <span className="block text-[10px] text-ds-text-tertiary">Light</span>
              </div>
            </button>

            {/* Dark Option */}
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-ds-primary bg-ds-primary-container/50 ring-2 ring-ds-primary/25 text-ds-text"
                  : "border-ds-border bg-ds-surface-elevated hover:bg-ds-surface-variant text-ds-text-secondary"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  theme === "dark"
                    ? "bg-ds-primary text-ds-on-primary shadow-2xs"
                    : "bg-ds-surface text-ds-icon-secondary border border-ds-divider"
                }`}
              >
                <Moon className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold leading-tight">มืด</span>
                <span className="block text-[10px] text-ds-text-tertiary">Dark</span>
              </div>
            </button>

            {/* System Option */}
            <button
              type="button"
              onClick={() => applyTheme("system")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all cursor-pointer ${
                theme === "system"
                  ? "border-ds-primary bg-ds-primary-container/50 ring-2 ring-ds-primary/25 text-ds-text"
                  : "border-ds-border bg-ds-surface-elevated hover:bg-ds-surface-variant text-ds-text-secondary"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  theme === "system"
                    ? "bg-ds-primary text-ds-on-primary shadow-2xs"
                    : "bg-ds-surface text-ds-icon-secondary border border-ds-divider"
                }`}
              >
                <Laptop className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold leading-tight">ตามระบบ</span>
                <span className="block text-[10px] text-ds-text-tertiary">System</span>
              </div>
            </button>
          </div>

          {theme === "system" && mounted && (
            <div className="rounded-xl border border-ds-divider bg-ds-surface-elevated px-3 py-2 text-[11px] text-ds-text-secondary flex items-center justify-between">
              <span>สถานะระบบอุปกรณ์:</span>
              <strong className="font-bold text-ds-text">
                {systemIsDark ? "โหมดมืด (Dark)" : "โหมดสว่าง (Light)"}
              </strong>
            </div>
          )}
        </section>

        {/* 2. DATA SYNCHRONIZATION (PROJECT_RULES.md §3) */}
        <section className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ds-surface-elevated border border-ds-divider text-ds-icon-secondary">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-ds-primary" : ""}`} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-ds-text">
                  การซิงก์ข้อมูลคลาวด์
                </h2>
                <p className="text-[11px] text-ds-text-secondary">
                  เชื่อมต่อฐานข้อมูล Supabase และสำรองข้อมูลอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Online / Offline / Test Mode Status Badge */}
            {isDevTestMode ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ds-warning-container px-2.5 py-1 text-[10px] font-extrabold text-ds-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                <ShieldCheck className="h-3 w-3" />
                <span>โหมดทดสอบในเครื่อง</span>
              </span>
            ) : (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                  isOnline
                    ? "bg-ds-success-container text-ds-success"
                    : "bg-ds-error-container text-ds-error"
                }`}
              >
                {isOnline ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    <Wifi className="h-3 w-3" />
                    <span>ออนไลน์</span>
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    <WifiOff className="h-3 w-3" />
                    <span>ออฟไลน์</span>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Test Mode Notice Banner */}
          {isDevTestMode && (
            <div className="rounded-2xl border border-ds-warning/30 bg-ds-warning-container p-3 text-xs text-ds-warning space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>เปิดโหมดทดสอบในเครื่อง (Local Test Only)</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                ระบบจะไม่ซิงก์ข้อมูลหรือบันทึกข้อมูลใดๆ ลงฐานข้อมูล Supabase ขณะทดสอบ (ข้อมูลจะถูกจัดเก็บใน localStorage ภายในเครื่องเท่านั้น)
              </p>
            </div>
          )}

          {/* Sync Time Status Bar */}
          <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ds-text-secondary">ซิงก์ล่าสุด:</span>
              <span className="font-bold text-ds-text">
                {isDevTestMode ? "ปิดการซิงก์ (โหมดทดสอบ)" : lastSyncTime || "ยังไม่มีข้อมูลบันทึก"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-ds-text-secondary">สถานะการทำงาน:</span>
              <span
                className={`font-extrabold ${
                  isDevTestMode
                    ? "text-ds-warning"
                    : isSyncing
                    ? "text-ds-info animate-pulse"
                    : "text-ds-success"
                }`}
              >
                {isDevTestMode
                  ? "ทำงานแบบออฟไลน์ในเครื่อง (Local Test Only)"
                  : isSyncing
                  ? "กำลังเชื่อมต่อและซิงก์..."
                  : "พร้อมใช้งาน (Synchronized)"}
              </span>
            </div>
          </div>

          {/* Big Sync Button */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-ds-primary py-3 text-xs font-bold text-ds-on-primary shadow-ds-card hover:bg-ds-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "กำลังซิงก์ข้อมูล..." : "ซิงก์ข้อมูลทันที (Sync Now)"}</span>
          </button>
        </section>

        {/* 3. STORED DATA SUMMARY */}
        <section className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ds-surface-elevated border border-ds-divider text-ds-icon-secondary">
                <Briefcase className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-extrabold text-ds-text">
                สรุปข้อมูลที่บันทึกในเครื่อง
              </h3>
            </div>
            <button
              type="button"
              onClick={refreshCounts}
              className="text-[11px] text-ds-primary hover:underline font-bold cursor-pointer"
            >
              รีเฟรชยอด
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
            <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-2.5">
              <span className="flex items-center gap-1 text-[10px] text-ds-text-secondary font-semibold">
                <CalendarDays className="h-3 w-3 text-ds-icon-secondary" /> เวรโรงพยาบาล
              </span>
              <div className="text-base font-black text-ds-text mt-0.5">
                {counts.shifts} <span className="text-[10px] font-normal text-ds-text-tertiary">เวร</span>
              </div>
            </div>

            <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-2.5">
              <span className="flex items-center gap-1 text-[10px] text-ds-text-secondary font-semibold">
                <HeartHandshake className="h-3 w-3 text-ds-icon-secondary" /> บริการลูกค้า
              </span>
              <div className="text-base font-black text-ds-text mt-0.5">
                {counts.services} <span className="text-[10px] font-normal text-ds-text-tertiary">เคส</span>
              </div>
            </div>

            <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-2.5">
              <span className="flex items-center gap-1 text-[10px] text-ds-text-secondary font-semibold">
                <Users className="h-3 w-3 text-ds-icon-secondary" /> ลูกค้า
              </span>
              <div className="text-base font-black text-ds-text mt-0.5">
                {counts.customers} <span className="text-[10px] font-normal text-ds-text-tertiary">คน</span>
              </div>
            </div>

            <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-2.5">
              <span className="flex items-center gap-1 text-[10px] text-ds-text-secondary font-semibold">
                <Pill className="h-3 w-3 text-ds-icon-secondary" /> คลังยา/เวชภัณฑ์
              </span>
              <div className="text-base font-black text-ds-text mt-0.5">
                {counts.medications} <span className="text-[10px] font-normal text-ds-text-tertiary">รายการ</span>
              </div>
            </div>

            <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-2.5">
              <span className="flex items-center gap-1 text-[10px] text-ds-text-secondary font-semibold">
                <CalendarCheck className="h-3 w-3 text-ds-icon-secondary" /> งานคลินิก
              </span>
              <div className="text-base font-black text-ds-text mt-0.5">
                {counts.clinicLogs} <span className="text-[10px] font-normal text-ds-text-tertiary">บันทึก</span>
              </div>
            </div>

            <div className="rounded-2xl border border-ds-divider bg-ds-surface-elevated p-2.5">
              <span className="flex items-center gap-1 text-[10px] text-ds-text-secondary font-semibold">
                <Sparkles className="h-3 w-3 text-ds-icon-secondary" /> ธุระส่วนตัว
              </span>
              <div className="text-base font-black text-ds-text mt-0.5">
                {counts.personalEvents} <span className="text-[10px] font-normal text-ds-text-tertiary">รายการ</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. ABOUT / APP INFORMATION */}
        <section className="rounded-3xl border border-ds-border bg-ds-surface p-4.5 shadow-ds-card space-y-2.5 text-xs text-ds-text-secondary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-ds-text">
              <ShieldCheck className="h-4 w-4 text-ds-icon-secondary" />
              <span>VenDee Care Companion</span>
            </div>
            <span className="rounded-full bg-ds-surface-variant px-2 py-0.5 text-[10px] font-bold text-ds-text-secondary border border-ds-border/60">
              v1.2.0
            </span>
          </div>
          <p className="text-[11px] leading-relaxed">
            ระบบบันทึกเวรโรงพยาบาล งานบริการเคหะบริบาลส่วนตัว และคำนวณรายได้ทางการพยาบาล
            ออกแบบสำหรับการใช้งานเฉพาะบุคคล (Single-User Companion PWA) รองรับการใช้งานแบบออฟไลน์
          </p>
        </section>

        <BottomNavSpacer />
      </main>

      <BottomNav />
    </div>
  );
}
