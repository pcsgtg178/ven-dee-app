"use client";

import React, { useState, useEffect } from "react";
import { X, PackagePlus } from "lucide-react";
import type { Medications } from "../../types/vendee";
import { receiveStockAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";
import { packsToUnits, isPackSizeUnset } from "../../lib/stock";
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
      const occurredAt = date ? `${date}T09:00:00+07:00` : new Date().toISOString();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              รับเข้าสต็อก: {medication.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                จำนวน ({packUnit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="เช่น 2"
                value={packs}
                onChange={(e) => setPacks(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                ราคาต่อ{packUnit} (บาท) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="เช่น 2500"
                value={packCostThb}
                onChange={(e) => setPackCostThb(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          {packSizeUnset && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠️ ตัวยานี้ยังตั้งไว้ว่า 1 {packUnit} = 1 {unit} — ถ้า 1 {packUnit} มีหลาย{unit} (เช่น 200 {unit})
              กรุณาไปแก้ &quot;ขนาดบรรจุ&quot; ในหน้าแก้ไขตัวยาก่อนรับเข้า ไม่งั้นยอดสต็อกและต้นทุนต่อ{unit}จะผิด
            </div>
          )}

          {packsNum > 0 && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 space-y-0.5">
              <div>
                {packsNum.toLocaleString()} {packUnit} × {packSize.toLocaleString()} {unit} = รับเข้า{" "}
                {totalUnits.toLocaleString()} {unit}
              </div>
              {packCostNum > 0 && (
                <div className="font-medium text-emerald-700 dark:text-emerald-300">
                  รวม ฿{totalCostThb.toLocaleString("th-TH", { maximumFractionDigits: 2 })} · เฉลี่ย ฿
                  {unitCostThb.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/{unit}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                ร้านที่ซื้อ / Supplier
              </label>
              <input
                type="text"
                placeholder="เช่น บริษัท A"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                วันที่รับเข้า
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="เลข Lot หรือรายละเอียดเพิ่มเติม"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันรับเข้า"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
