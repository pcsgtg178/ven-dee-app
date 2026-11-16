"use client";

import React, { useState, useEffect } from "react";
import { X, PackagePlus } from "lucide-react";
import type { Medications } from "../../types/vendee";
import { receiveStockAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";
import { packsToUnits, isPackSizeUnset, resolveReceiveOccurredAt } from "../../lib/stock";
import { getTodayDateStringBangkok } from "../../lib/dateUtils";
import { updateLocalMedicationStock } from "../../lib/storage";

interface Props {
  isOpen: boolean;
  medication: Medications | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function ModalStockReceive({ isOpen, medication, onClose, onSuccess }: Props) {
  const [packs, setPacks] = useState("");
  const [packCostThb, setPackCostThb] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setPacks("");
    setPackCostThb("");
    setSupplier("");
    setDate(getTodayDateStringBangkok());
    setNote("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, medication?.id]);

  if (!isOpen || !medication) return null;

  const packSize = Math.max(1, Number(medication.packSize ?? 1));
  const packUnit = medication.packUnit || "ขวด";
  const unit = medication.unit || "ยูนิต";

  const packsNum = Number(packs) || 0;
  const packCostNum = Number(packCostThb) || 0;
  const totalUnits = packsToUnits(packsNum, packSize);
  const unitCostThb = packSize > 0 ? packCostNum / packSize : 0;
  const totalCostThb = packsNum * packCostNum;
  const packSizeUnset = isPackSizeUnset(medication);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (packsNum <= 0) {
      setErrorMsg("กรุณาระบุจำนวนที่รับเข้ามากกว่า 0");
      return;
    }
    if (packCostThb === "" || packCostNum < 0) {
      setErrorMsg("กรุณาระบุราคาต่อแพ็ค/ขวด (0 ขึ้นไป)");
      return;
    }

    setIsSubmitting(true);
    try {
      const occurredAt = resolveReceiveOccurredAt(date);
      const res = unwrap(
        await receiveStockAction({
          medId: medication.id,
          packs: packsNum,
          packCostSatang: Math.round(packCostNum * 100),
          supplier: supplier.trim() || undefined,
          occurredAt,
          note: note.trim() || undefined,
        })
      );
      updateLocalMedicationStock(medication.id, res.stockOnHand);
      resetForm();
      onSuccess(`รับเข้า ${medication.name} +${totalUnits.toLocaleString()} ${unit} เรียบร้อย`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถรับเข้าสต็อกได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-receive-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-ds-surface-elevated p-5 shadow-ds-popover border border-ds-border">
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-ds-divider">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ds-surface-variant text-ds-icon-primary">
              <PackagePlus className="h-4 w-4" />
            </div>
            <h3 id="stock-receive-title" className="text-sm font-bold text-ds-text">
              รับเข้าสต็อก: {medication.name}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                จำนวน ({packUnit}) <span className="text-ds-error">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="เช่น 2"
                value={packs}
                onChange={(e) => setPacks(e.target.value)}
                required
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                ราคาต่อ{packUnit} (บาท) <span className="text-ds-error">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="เช่น 2500"
                value={packCostThb}
                onChange={(e) => setPackCostThb(e.target.value)}
                required
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
              />
            </div>
          </div>

          {packSizeUnset && (
            <div className="rounded-xl bg-ds-warning-container px-3 py-2 text-xs font-semibold text-ds-warning">
              ⚠️ ตัวยานี้ยังตั้งไว้ว่า 1 {packUnit} = 1 {unit} — ถ้า 1 {packUnit} มีหลาย{unit} (เช่น 200 {unit})
              กรุณาไปแก้ &quot;ขนาดบรรจุ&quot; ในหน้าแก้ไขตัวยาก่อนรับเข้า ไม่งั้นยอดสต็อกและต้นทุนต่อ{unit}จะผิด
            </div>
          )}

          {packsNum > 0 && (
            <div className="rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs font-semibold text-ds-success space-y-0.5">
              <div>
                {packsNum.toLocaleString()} {packUnit} × {packSize.toLocaleString()} {unit} = รับเข้า{" "}
                {totalUnits.toLocaleString()} {unit}
              </div>
              {packCostNum > 0 && (
                <div className="font-medium text-ds-text-secondary">
                  รวม ฿{totalCostThb.toLocaleString("th-TH", { maximumFractionDigits: 2 })} · เฉลี่ย ฿
                  {unitCostThb.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{unit}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                ร้านที่ซื้อ / Supplier
              </label>
              <input
                type="text"
                placeholder="เช่น บริษัท A"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                วันที่รับเข้า
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text outline-none focus:border-ds-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="เลข Lot หรือรายละเอียดเพิ่มเติม"
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
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันรับเข้า"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
