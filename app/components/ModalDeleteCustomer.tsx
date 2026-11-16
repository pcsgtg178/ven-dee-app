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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-customer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ds-overlay backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!isDeleting) onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-ds-surface-elevated p-5 sm:p-6 shadow-ds-popover border border-ds-border space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-divider pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ds-error-container text-ds-error">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="delete-customer-title" className="text-base font-bold text-ds-text">
                ยืนยันการลบลูกค้า
              </h2>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-full p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-ds-error-container p-3 text-xs font-semibold text-ds-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Customer Badge Preview */}
        <div className="flex items-center gap-3 rounded-2xl border border-ds-border bg-ds-surface p-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-ds-border bg-ds-surface-elevated text-base font-bold text-ds-text">
            {customer.name.substring(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-ds-text truncate">
              {customer.name}
            </h3>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="rounded-2xl border border-ds-error/30 bg-ds-error-container p-3.5 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-ds-error">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>คำเตือน: ข้อมูลจะถูกลบอย่างถาวร</span>
          </div>
          <p className="text-ds-error leading-relaxed">
            เมื่อลบลูกค้าคนนี้ ระบบจะทำการ{" "}
            <strong>ลบประวัติการรับบริการและนัดหมายทั้งหมด</strong>{" "}
            ที่เชื่อมโยงกับลูกค้ารายนี้ออกจากระบบทันที ไม่สามารถกู้คืนได้
          </p>
        </div>

        {/* Related Services Summary */}
        <div className="rounded-2xl border border-ds-border bg-ds-surface p-3.5 text-xs space-y-2">
          <span className="font-bold text-ds-text block">
            ประวัติและนัดหมายที่จะถูกลบด้วย:
          </span>

          {relatedServices.length === 0 ? (
            <p className="text-ds-text-secondary text-[11px]">
              ไม่มีประวัติหรือนัดหมายบริการที่ค้างอยู่ในระบบ
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-ds-text-secondary text-xs">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-ds-icon-secondary" />
                  <span>นัดหมายล่วงหน้า</span>
                </span>
                <span className="font-bold text-ds-text">{upcomingCount} รายการ</span>
              </div>
              <div className="flex items-center justify-between text-ds-text-secondary text-xs">
                <span className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-ds-icon-secondary" />
                  <span>ประวัติบริการที่เสร็จสิ้น</span>
                </span>
                <span className="font-bold text-ds-text">{historyCount} รายการ</span>
              </div>
              <div className="border-t border-ds-divider pt-1.5 flex items-center justify-between font-bold text-ds-error text-xs">
                <span>รวมรายการที่ต้องลบทิ้งทั้งหมด</span>
                <span>{relatedServices.length} รายการ</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-ds-divider">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 rounded-xl border border-ds-border bg-ds-surface py-2.5 text-xs font-bold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-ds-error py-2.5 text-xs font-bold text-white dark:text-[#171020] shadow-xs hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
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
