"use client";

import React, { useState, useEffect } from "react";
import { X, User, Check, AlertCircle } from "lucide-react";
import { Customer } from "../../types/vendee";
import { saveCustomer } from "../../lib/storage";

interface ModalEditCustomerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: Customer) => void;
}

export default function ModalEditCustomer({
  customer,
  isOpen,
  onClose,
  onSuccess,
}: ModalEditCustomerProps) {
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (customer && isOpen) {
      setName(customer.name || "");
      setErrorMsg("");
    }
  }, [customer, isOpen]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("กรุณากรอกชื่อ-นามสกุลลูกค้า");
      return;
    }

    try {
      const updated = await saveCustomer({
        id: customer.id,
        name: name.trim(),
        avatarColor: customer.avatarColor,
        createdAt: customer.createdAt,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลลูกค้า");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-card-bg p-5 sm:p-6 shadow-2xl border border-surface-subtle dark:bg-zinc-900 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-xs ${
                customer.avatarColor || "bg-primary"
              }`}
            >
              {customer.name.substring(0, 2)}
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                แก้ไขข้อมูลลูกค้า
              </h2>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
                รหัสลูกค้า: {customer.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-main dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <User className="h-3.5 w-3.5 text-primary" />
              <span>ชื่อ <strong className="text-rose-500">*</strong></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ระบุชื่อจริง นามสกุล หรือชื่อเรียก"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2.5 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-subtle dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-subtle bg-surface-subtle py-2.5 text-xs font-bold text-text-main hover:bg-slate-200 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>บันทึกการแก้ไข</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
