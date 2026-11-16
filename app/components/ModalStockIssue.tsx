"use client";

import React, { useState, useEffect } from "react";
import { X, PackageMinus } from "lucide-react";
import type { Medications, StockIssueReason } from "../../types/vendee";
import { issueStockAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";
import { updateLocalMedicationStock } from "../../lib/storage";

interface Props {
  isOpen: boolean;
  medication: Medications | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const REASON_OPTIONS: { value: StockIssueReason; label: string }[] = [
  { value: "expired", label: "หมดอายุ" },
  { value: "damaged", label: "ชำรุด / แตกเสียหาย" },
  { value: "personal", label: "ใช้ส่วนตัว" },
  { value: "free", label: "แจกฟรี / แถมลูกค้า" },
  { value: "sample", label: "ตัวอย่าง / ทดลอง" },
  { value: "other", label: "อื่นๆ" },
];

export default function ModalStockIssue({ isOpen, medication, onClose, onSuccess }: Props) {
  const [type, setType] = useState<"waste" | "giveaway">("waste");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<StockIssueReason>("expired");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setType("waste");
    setQty("");
    setReason("expired");
    setNote("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, medication?.id]);

  if (!isOpen || !medication) return null;

  const unit = medication.unit || "ยูนิต";
  const qtyNum = Number(qty) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (qtyNum <= 0) {
      setErrorMsg("กรุณาระบุปริมาณที่ตัดออกมากกว่า 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await issueStockAction({
        medId: medication.id,
        qty: qtyNum,
        type,
        reason,
        note: note.trim() || undefined,
      });
      const data = unwrap(res);
      updateLocalMedicationStock(medication.id, data.stockOnHand);
      const warnText =
        res.success && res.warnings && res.warnings.length > 0
          ? " (คำเตือน: สต็อกติดลบ)"
          : "";
      resetForm();
      onSuccess(`ตัดออก ${medication.name} -${qtyNum.toLocaleString()} ${unit}${warnText}`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถตัดสต็อกออกได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-issue-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-ds-surface-elevated p-5 shadow-ds-popover border border-ds-border">
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-ds-divider">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ds-surface-variant text-ds-icon-primary">
              <PackageMinus className="h-4 w-4" />
            </div>
            <h3 id="stock-issue-title" className="text-sm font-bold text-ds-text">
              ตัดสต็อกออก: {medication.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-lg p-1 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex-1 overflow-y-auto overscroll-contain space-y-3 pr-1">
          {errorMsg && (
            <div className="rounded-xl bg-ds-error-container px-3 py-2 text-xs font-semibold text-ds-error">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ds-text-secondary mb-1.5">
              ประเภทการตัดออก
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("waste");
                  setReason("expired");
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold border cursor-pointer transition-colors ${
                  type === "waste"
                    ? "border-ds-error/60 bg-ds-error-container text-ds-error"
                    : "border-ds-border bg-ds-surface text-ds-text-secondary hover:text-ds-text"
                }`}
              >
                ทิ้ง / เสีย / หมดอายุ
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("giveaway");
                  setReason("free");
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold border cursor-pointer transition-colors ${
                  type === "giveaway"
                    ? "border-ds-warning/60 bg-ds-warning-container text-ds-warning"
                    : "border-ds-border bg-ds-surface text-ds-text-secondary hover:text-ds-text"
                }`}
              >
                ใช้ส่วนตัว / แจกฟรี
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                ปริมาณ ({unit}) <span className="text-ds-error">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder={`เช่น 10`}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                เหตุผล
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as StockIssueReason)}
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text outline-none focus:border-ds-primary"
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="รายละเอียดเพิ่มเติม"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-ds-border bg-ds-surface px-4 py-2 text-xs font-semibold text-ds-text-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-ds-primary px-4 py-2 text-xs font-bold text-ds-on-primary hover:bg-ds-primary-hover active:bg-ds-primary-pressed disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันตัดออก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
