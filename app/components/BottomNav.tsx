"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Plus, Users } from "lucide-react";

interface BottomNavProps {
  onOpenAdd?: () => void;
}

export default function BottomNav({ onOpenAdd }: BottomNavProps) {
  const pathname = usePathname();

  const isHomeActive = pathname === "/";
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
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-subtle bg-white/95 backdrop-blur-md pb-safe dark:border-zinc-800 dark:bg-zinc-950/95 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {/* หน้าหลัก / ตารางงาน (Secondary Sea Blue Theme) */}
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-all ${
            isHomeActive
              ? "text-secondary dark:text-secondary-light font-bold"
              : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isHomeActive
                ? "bg-secondary-light text-secondary dark:bg-secondary-dark/40 dark:text-secondary-light shadow-2xs"
                : ""
            }`}
          >
            <CalendarDays className="h-5 w-5" />
          </div>
          <span>หน้าหลัก</span>
        </Link>

        {/* ปุ่มบันทึกงานตรงกลาง (FAB Style) - Gradient from-sky-500 to-emerald-600 */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="group relative -top-3.5 flex flex-col items-center justify-center transition-transform active:scale-95 touch-manipulation"
          aria-label="บันทึกงานใหม่"
        >
          <div className="flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-app-bg dark:ring-zinc-950 hover:brightness-105 transition-all">
            <Plus className="h-7 w-7 transition-transform group-hover:rotate-90 duration-200" />
          </div>
          <span className="mt-0.5 text-[11px] font-semibold text-text-main dark:text-zinc-300">
            บันทึกงาน
          </span>
        </button>

        {/* ลูกค้า (Primary Health Green Theme) */}
        <Link
          href="/customers"
          className={`flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-all ${
            isCustomerActive
              ? "text-primary dark:text-primary-light font-bold"
              : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              isCustomerActive
                ? "bg-primary-light text-primary-dark dark:bg-primary-dark/40 dark:text-primary-light shadow-2xs"
                : ""
            }`}
          >
            <Users className="h-5 w-5" />
          </div>
          <span>ลูกค้า</span>
        </Link>
      </div>
    </nav>
  );
}
