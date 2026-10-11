"use client";

import React, { useState, useMemo } from "react";
import { X, Trash2, AlertTriangle, CalendarDays, History, AlertCircle, Loader2 } from "lucide-react";
import { Customer } from "../../types/vendee";
import { deleteCustomer, getServices } from "../../lib/storage";

interface ModalDeleteCustomerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ModalDeleteCustomer({
  customer,
  isOpen,
  onClose,
  onSuccess,
}: ModalDeleteCustomerProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Calculate service records that will be cascade deleted
  const relatedServices = useMemo(() => {
    if (!customer) return [];
    const allServices = getServices();
    return allServices.filter((s) => s.customerId === customer.id);
  }, [customer, isOpen]);

  const upcomingCount = useMemo(() => {
    return relatedServices.filter((s) => s.status === "upcoming").length;
  }, [relatedServices]);

  const historyCount = useMemo(() => {
    return relatedServices.filter((s) => s.status === "completed").length;
  }, [relatedServices]);

  if (!isOpen || !customer) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg("");
    try {
      await deleteCustomer(customer.id);
      setIsDeleting(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการลบข้อมูลลูกค้า");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isDeleting) onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-card-bg p-5 sm:p-6 shadow-2xl border border-surface-subtle dark:bg-zinc-900 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                ยืนยันการลบลูกค้า
              </h2>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
                การดำเนินการนี้จะลบข้อมูลและประวัติทั้งหมด
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-main dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Customer Badge Preview */}
        <div className="flex items-center gap-3 rounded-2xl border border-surface-subtle bg-surface-subtle/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-xs ${
              customer.avatarColor || "bg-primary"
            }`}
          >
            {customer.name.substring(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-text-main dark:text-white truncate">
              {customer.name}
            </h3>
            <p className="text-[11px] text-text-muted dark:text-zinc-400">
              รหัสลูกค้า: {customer.id}
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/30 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>คำเตือน: ข้อมูลจะถูกลบอย่างถาวร</span>
          </div>
          <p className="text-rose-700 dark:text-rose-300/90 leading-relaxed">
            เมื่อลบลูกค้าคนนี้ ระบบจะทำการ{" "}
            <strong>ลบประวัติการรับบริการและนัดหมายทั้งหมด</strong>{" "}
            ที่เชื่อมโยงกับลูกค้ารายนี้ออกจากระบบทันที ไม่สามารถกู้คืนได้
          </p>
        </div>

        {/* Related Services Summary */}
        <div className="rounded-2xl border border-surface-subtle bg-card-bg p-3.5 dark:border-zinc-800 dark:bg-zinc-900 text-xs space-y-2">
          <span className="font-bold text-text-main dark:text-zinc-200 block">
            ประวัติและนัดหมายที่จะถูกลบด้วย:
          </span>

          {relatedServices.length === 0 ? (
            <p className="text-text-muted dark:text-zinc-400 text-[11px]">
              ไม่มีประวัติหรือนัดหมายบริการที่ค้างอยู่ในระบบ
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-text-main dark:text-zinc-300 text-xs">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span>นัดหมายล่วงหน้า</span>
                </span>
                <span className="font-bold">{upcomingCount} รายการ</span>
              </div>
              <div className="flex items-center justify-between text-text-main dark:text-zinc-300 text-xs">
                <span className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-secondary" />
                  <span>ประวัติบริการที่เสร็จสิ้น</span>
                </span>
                <span className="font-bold">{historyCount} รายการ</span>
              </div>
              <div className="border-t border-surface-subtle pt-1.5 flex items-center justify-between font-bold text-rose-600 dark:text-rose-400 text-xs">
                <span>รวมรายการที่ต้องลบทิ้งทั้งหมด</span>
                <span>{relatedServices.length} รายการ</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-surface-subtle dark:border-zinc-800">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 rounded-xl border border-surface-subtle bg-surface-subtle py-2.5 text-xs font-bold text-text-main hover:bg-slate-200 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-all disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>กำลังลบ...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>ยืนยันลบลูกค้าและประวัติ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
