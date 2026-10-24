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
    <div className="min-h-screen bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
      {/* App Bar */}
      <AppBar
        title="การตั้งค่า"
        leftAction={
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-zinc-800 transition-colors"
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
          <div className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg animate-in fade-in flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{syncMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. THEME SETTINGS (PROJECT_RULES.md §3: Light / Dark / System) */}
        <section className="rounded-3xl border border-surface-subtle bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <Sun className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-text-main dark:text-white">
                ธีมและการแสดงผล
              </h2>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
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
                  ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-500/30 text-sky-900 dark:border-sky-400 dark:bg-sky-950/40 dark:text-sky-200"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  theme === "light"
                    ? "bg-sky-600 text-white shadow-2xs"
                    : "bg-white text-amber-500 dark:bg-zinc-800 shadow-2xs"
                }`}
              >
                <Sun className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold leading-tight">สว่าง</span>
                <span className="block text-[10px] text-text-muted dark:text-zinc-400">Light</span>
              </div>
            </button>

            {/* Dark Option */}
            <button
              type="button"
              onClick={() => applyTheme("dark")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-500/30 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-200"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  theme === "dark"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white text-indigo-500 dark:bg-zinc-800 shadow-2xs"
                }`}
              >
                <Moon className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold leading-tight">มืด</span>
                <span className="block text-[10px] text-text-muted dark:text-zinc-400">Dark</span>
              </div>
            </button>

            {/* System Option */}
            <button
              type="button"
              onClick={() => applyTheme("system")}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-3.5 text-center transition-all cursor-pointer ${
                theme === "system"
                  ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/30 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 text-slate-700 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                  theme === "system"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-emerald-600 dark:bg-zinc-800 shadow-2xs"
                }`}
              >
                <Laptop className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs font-bold leading-tight">ตามระบบ</span>
                <span className="block text-[10px] text-text-muted dark:text-zinc-400">System</span>
              </div>
            </button>
          </div>

          {theme === "system" && mounted && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-zinc-800/60 dark:text-zinc-300 flex items-center justify-between">
              <span>สถานะระบบอุปกรณ์:</span>
              <strong className="font-bold text-text-main dark:text-white">
                {systemIsDark ? "โหมดมืด (Dark)" : "โหมดสว่าง (Light)"}
              </strong>
            </div>
          )}
        </section>

        {/* 2. DATA SYNCHRONIZATION (PROJECT_RULES.md §3) */}
        <section className="rounded-3xl border border-surface-subtle bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-sky-600" : ""}`} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-text-main dark:text-white">
                  การซิงก์ข้อมูลคลาวด์
                </h2>
                <p className="text-[11px] text-text-muted dark:text-zinc-400">
                  เชื่อมต่อฐานข้อมูล Supabase และสำรองข้อมูลอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Online / Offline Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                isOnline
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
              }`}
            >
              {isOnline ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Wifi className="h-3 w-3" />
                  <span>ออนไลน์</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <WifiOff className="h-3 w-3" />
                  <span>ออฟไลน์</span>
                </>
              )}
            </span>
          </div>

          {/* Sync Time Status Bar */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted dark:text-zinc-400">ซิงก์ล่าสุด:</span>
              <span className="font-bold text-text-main dark:text-zinc-200">
                {lastSyncTime || "ยังไม่มีข้อมูลบันทึก"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted dark:text-zinc-400">สถานะการทำงาน:</span>
              <span
                className={`font-extrabold ${
                  isSyncing
                    ? "text-sky-600 dark:text-sky-400 animate-pulse"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {isSyncing ? "กำลังเชื่อมต่อและซิงก์..." : "พร้อมใช้งาน (Synchronized)"}
              </span>
            </div>
          </div>

          {/* Big Sync Button */}
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "กำลังซิงก์ข้อมูล..." : "ซิงก์ข้อมูลทันที (Sync Now)"}</span>
          </button>
        </section>

        {/* 3. STORED DATA SUMMARY */}
        <section className="rounded-3xl border border-surface-subtle bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Briefcase className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-extrabold text-text-main dark:text-white">
                สรุปข้อมูลที่บันทึกในเครื่อง
              </h3>
            </div>
            <button
              type="button"
              onClick={refreshCounts}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-bold"
            >
              รีเฟรชยอด
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-0.5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <span className="flex items-center gap-1 text-[10px] text-text-muted dark:text-zinc-400 font-semibold">
                <CalendarDays className="h-3 w-3 text-sky-500" /> เวรโรงพยาบาล
              </span>
              <div className="text-base font-black text-text-main dark:text-white mt-0.5">
                {counts.shifts} <span className="text-[10px] font-normal text-text-muted">เวร</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <span className="flex items-center gap-1 text-[10px] text-text-muted dark:text-zinc-400 font-semibold">
                <HeartHandshake className="h-3 w-3 text-emerald-500" /> บริการลูกค้า
              </span>
              <div className="text-base font-black text-text-main dark:text-white mt-0.5">
                {counts.services} <span className="text-[10px] font-normal text-text-muted">เคส</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <span className="flex items-center gap-1 text-[10px] text-text-muted dark:text-zinc-400 font-semibold">
                <Users className="h-3 w-3 text-purple-500" /> ลูกค้า
              </span>
              <div className="text-base font-black text-text-main dark:text-white mt-0.5">
                {counts.customers} <span className="text-[10px] font-normal text-text-muted">คน</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <span className="flex items-center gap-1 text-[10px] text-text-muted dark:text-zinc-400 font-semibold">
                <Pill className="h-3 w-3 text-indigo-500" /> คลังยา/เวชภัณฑ์
              </span>
              <div className="text-base font-black text-text-main dark:text-white mt-0.5">
                {counts.medications} <span className="text-[10px] font-normal text-text-muted">รายการ</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <span className="flex items-center gap-1 text-[10px] text-text-muted dark:text-zinc-400 font-semibold">
                <CalendarCheck className="h-3 w-3 text-amber-500" /> งานคลินิก
              </span>
              <div className="text-base font-black text-text-main dark:text-white mt-0.5">
                {counts.clinicLogs} <span className="text-[10px] font-normal text-text-muted">บันทึก</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-800/30">
              <span className="flex items-center gap-1 text-[10px] text-text-muted dark:text-zinc-400 font-semibold">
                <Sparkles className="h-3 w-3 text-rose-500" /> ธุระส่วนตัว
              </span>
              <div className="text-base font-black text-text-main dark:text-white mt-0.5">
                {counts.personalEvents} <span className="text-[10px] font-normal text-text-muted">รายการ</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. ABOUT / APP INFORMATION */}
        <section className="rounded-3xl border border-surface-subtle bg-white p-4.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-2.5 text-xs text-text-muted dark:text-zinc-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-text-main dark:text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>VenDee Care Companion</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
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
