"use client";

import React, { useState, useEffect } from "react";
import { X, User, Check, AlertCircle, Trash2 } from "lucide-react";
import { Customer } from "../../types/vendee";
import { saveCustomer } from "../../lib/storage";
import ModalDeleteCustomer from "./ModalDeleteCustomer";

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
  const [openDeleteModal, setOpenDeleteModal] = useState(false);

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-customer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ds-overlay backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-ds-surface-elevated p-5 sm:p-6 shadow-ds-popover border border-ds-border space-y-4 max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-divider pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-ds-border bg-ds-surface font-bold text-ds-text">
              {customer.name.substring(0, 2)}
            </div>
            <div>
              <h2 id="edit-customer-title" className="text-base font-bold text-ds-text">
                แก้ไขข้อมูลลูกค้า
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-full p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text transition-colors cursor-pointer"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text">
              <User className="h-3.5 w-3.5 text-ds-icon-secondary" />
              <span>ชื่อ <strong className="text-ds-error">*</strong></span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ระบุชื่อจริง นามสกุล หรือชื่อเรียก"
              className="w-full rounded-xl border border-ds-border bg-ds-surface px-3.5 py-2.5 text-sm text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-ds-divider">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-ds-border bg-ds-surface py-2.5 text-xs font-bold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-ds-primary py-2.5 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover active:scale-95 transition-all cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>บันทึกการแก้ไข</span>
            </button>
          </div>

          {/* Danger zone: ลบลูกค้า */}
          <div className="pt-2 border-t border-ds-divider flex justify-center">
            <button
              type="button"
              onClick={() => setOpenDeleteModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-ds-error hover:underline py-1 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>ลบลูกค้ารายนี้และประวัติทั้งหมด</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal Delete Customer */}
      <ModalDeleteCustomer
        customer={customer}
        isOpen={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        onSuccess={() => {
          setOpenDeleteModal(false);
          onClose();
          if (onSuccess) onSuccess(customer);
        }}
      />
    </div>
  );
}
