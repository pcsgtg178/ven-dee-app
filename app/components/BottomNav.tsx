"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, BarChart3, Plus, Pill, Users } from "lucide-react";
import { getMedications, subscribeToStorage } from "../../lib/storage";
import { isLowStock, isNegativeStock } from "../../lib/stock";

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
  const [lowStockBadgeCount, setLowStockBadgeCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      const meds = getMedications();
      const count = meds.filter((m) => !m.isArchived && (isNegativeStock(m) || isLowStock(m))).length;
      setLowStockBadgeCount(count);
    };
    refresh();
    return subscribeToStorage(refresh);
  }, []);

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
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ds-border bg-ds-surface/95 backdrop-blur-md pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-1 sm:px-3">
        {/* 1. หน้าหลัก / ตารางงาน */}
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isHomeActive
              ? "text-ds-primary font-bold"
              : "text-ds-text-secondary hover:text-ds-text"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isHomeActive
                ? "bg-ds-primary-container text-ds-primary shadow-2xs"
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
              ? "text-ds-primary font-bold"
              : "text-ds-text-secondary hover:text-ds-text"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isDashboardActive
                ? "bg-ds-primary-container text-ds-primary shadow-2xs"
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
          className="group relative -top-3 flex shrink-0 flex-col items-center justify-center transition-transform active:scale-95 touch-manipulation px-1 cursor-pointer"
          aria-label="บันทึกงานใหม่"
        >
          <div className="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-ds-primary text-ds-on-primary shadow-ds-popover ring-4 ring-ds-bg hover:bg-ds-primary-hover active:bg-ds-primary-pressed transition-all">
            <Plus className="h-6 w-6 sm:h-7 sm:w-7 transition-transform group-hover:rotate-90 duration-200" />
          </div>
          <span className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-ds-text">
            บันทึกงาน
          </span>
        </button>

        {/* 4. ตัวยาและเวชภัณฑ์ */}
        <Link
          href="/medications"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isMedicationsActive
              ? "text-ds-primary font-bold"
              : "text-ds-text-secondary hover:text-ds-text"
          }`}
        >
          <div
            className={`relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isMedicationsActive
                ? "bg-ds-primary-container text-ds-primary shadow-2xs"
                : ""
            }`}
          >
            <Pill className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            {lowStockBadgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ds-error px-1 text-[9px] font-extrabold text-white dark:text-[#171020] shadow-xs">
                {lowStockBadgeCount > 9 ? "9+" : lowStockBadgeCount}
              </span>
            )}
          </div>
          <span>ตัวยา</span>
        </Link>

        {/* 5. ลูกค้า */}
        <Link
          href="/customers"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] sm:text-[11px] font-medium transition-all ${
            isCustomerActive
              ? "text-ds-primary font-bold"
              : "text-ds-text-secondary hover:text-ds-text"
          }`}
        >
          <div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl transition-all ${
              isCustomerActive
                ? "bg-ds-primary-container text-ds-primary shadow-2xs"
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
