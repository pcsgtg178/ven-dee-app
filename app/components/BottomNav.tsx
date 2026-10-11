"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, BarChart3, Plus, Pill, Users } from "lucide-react";

export function BottomNavSpacer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full shrink-0 pointer-events-none ${className}`}
      style={{
        height: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-hidden="true"
    />
  );
}

interface BottomNavProps {
  onOpenAdd?: () => void;
  hideSpacer?: boolean;
}

export default function BottomNav({ onOpenAdd, hideSpacer = false }: BottomNavProps) {
  const pathname = usePathname();

  const isHomeActive = pathname === "/";
  const isDashboardActive = pathname.startsWith("/dashboard");
  const isMedicationsActive = pathname.startsWith("/medications");
  const isCustomerActive = pathname.startsWith("/customer");

  const handleOpenAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenAdd) {
      onOpenAdd();
    } else {
      window.dispatchEvent(new CustomEvent("vendee_open_add_modal"));
    }
  };

  return (
    <>
      {!hideSpacer && <BottomNavSpacer />}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-subtle bg-white/95 backdrop-blur-md pb-safe dark:border-zinc-800 dark:bg-zinc-950/95 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-1 sm:px-3">
        {/* 1. หน้าหลัก / ตารางงาน */}
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isHomeActive
              ? "text-secondary dark:text-secondary-light font-bold"
              : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isHomeActive
                ? "bg-secondary-light text-secondary dark:bg-secondary-dark/40 dark:text-secondary-light shadow-2xs"
                : ""
            }`}
          >
            <CalendarDays className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <span>หน้าหลัก</span>
        </Link>

        {/* 2. แดชบอร์ดสรุปรายได้ */}
        <Link
          href="/dashboard"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isDashboardActive
              ? "text-primary dark:text-primary-light font-bold"
              : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isDashboardActive
                ? "bg-primary-light text-primary-dark dark:bg-primary-dark/40 dark:text-primary-light shadow-2xs"
                : ""
            }`}
          >
            <BarChart3 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <span>แดชบอร์ด</span>
        </Link>

        {/* 3. ปุ่มบันทึกงานตรงกลาง (FAB Style) */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="group relative -top-3 flex shrink-0 flex-col items-center justify-center transition-transform active:scale-95 touch-manipulation px-1"
          aria-label="บันทึกงานใหม่"
        >
          <div className="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-app-bg dark:ring-zinc-950 hover:brightness-105 transition-all">
            <Plus className="h-6 w-6 sm:h-7 sm:w-7 transition-transform group-hover:rotate-90 duration-200" />
          </div>
          <span className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-text-main dark:text-zinc-300">
            บันทึกงาน
          </span>
        </button>

        {/* 4. ตัวยาและเวชภัณฑ์ */}
        <Link
          href="/medications"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isMedicationsActive
              ? "text-purple-600 dark:text-purple-400 font-bold"
              : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isMedicationsActive
                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 shadow-2xs"
                : ""
            }`}
          >
            <Pill className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <span>ตัวยา</span>
        </Link>

        {/* 5. ลูกค้า */}
        <Link
          href="/customers"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isCustomerActive
              ? "text-emerald-700 dark:text-emerald-400 font-bold"
              : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isCustomerActive
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-2xs"
                : ""
            }`}
          >
            <Users className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <span>ลูกค้า</span>
        </Link>
      </div>
    </nav>
    </>
  );
}
