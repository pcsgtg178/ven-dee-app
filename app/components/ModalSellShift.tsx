"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Ambulance,
  DollarSign,
  User,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import moment from "moment";
import "moment/locale/th";
import { ShiftRecord, SHIFT_CONFIG } from "../../types/vendee";
import { sellShift } from "../../lib/storage";

interface ModalSellShiftProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftRecord | null;
  onSuccess?: (updatedShift: ShiftRecord) => void;
}

export default function ModalSellShift({
  isOpen,
  onClose,
  shift,
  onSuccess,
}: ModalSellShiftProps) {
  // Form fields adhere to PROJECT_RULES.md (Form State Reset Policy: empty defaults)
  const [buyerName, setBuyerName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [soldDate, setSoldDate] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State Reset Policy: Reset all inputs whenever modal opens or shift changes
  useEffect(() => {
    if (isOpen && shift) {
      setBuyerName("");
      setSalePrice("");
      setPaymentStatus("unpaid");
      setSoldDate(new Date().toISOString().split("T")[0]);
      setNote("");
      setErrorMsg("");
      setLoading(false);
    }
  }, [isOpen, shift]);

  if (!isOpen || !shift) return null;

  const shiftInfo = SHIFT_CONFIG[shift.shiftType];
  const formattedShiftDate = moment(shift.date).isValid()
    ? moment(shift.date).locale("th").format("ddddที่ D MMMM YYYY")
    : shift.date;

  const priceNum = parseFloat(salePrice) || 0;
  const satangVal = Math.round(priceNum * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!buyerName.trim()) {
      setErrorMsg("กรุณาระบุชื่อพยาบาลผู้ซื้อ / ผู้รับเวรแทน");
      return;
    }

    if (salePrice.trim() === "" || isNaN(priceNum) || priceNum < 0) {
      setErrorMsg("กรุณาระบุราคาขายเวรที่ถูกต้อง (เป็นตัวเลข 0 บาทขึ้นไป)");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const updated = await sellShift({
        shiftId: shift.id,
        buyerName: buyerName.trim(),
        salePriceSatang: satangVal,
        soldDate: soldDate || new Date().toISOString().split("T")[0],
        paymentStatus,
        note: note.trim() || undefined,
      });

      // Post-submission clean-up
      setBuyerName("");
      setSalePrice("");
      setPaymentStatus("unpaid");
      setNote("");

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกการขายเวร");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 dark:border-zinc-800 dark:bg-zinc-900 transition-all max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Emerald Refer Accent */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md text-white shadow-xs">
                <Ambulance className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  ขายเวร Refer
                </h2>
                <p className="text-xs text-emerald-100/90 font-medium">
                  ส่งต่อเวรให้พยาบาลคนอื่นไปปฏิบัติหน้าที่แทน (One-Way Transfer)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/90 hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Shift Details Highlight Card */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{formattedShiftDate}</span>
              </span>
              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                {shiftInfo?.label || "เวร Refer"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Standby 24 ชั่วโมง (เวรเตรียมพร้อมฉุกเฉิน)</span>
            </div>

            <div className="rounded-xl bg-white/80 dark:bg-zinc-900/80 p-2 text-[11px] text-slate-600 dark:text-zinc-300 border border-emerald-100 dark:border-emerald-900/40 leading-relaxed">
              💡 <strong>กฎเวร:</strong> การขายเวร Refer เป็นการส่งต่อทิศทางเดียว ไม่กระทบโควตาเวรดำ (14 เวร) และวันดังกล่าวในตารางของคุณจะกลายเป็นวันว่าง/ออฟ (Off) ทันที
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Field 1: Buyer Name */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-200">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-emerald-600" />
                <span>ชื่อพยาบาลผู้ซื้อ / ผู้รับเวรแทน</span>
                <span className="text-shift-red">*</span>
              </span>
              <span className="text-[10px] text-text-muted">บังคับระบุ</span>
            </label>
            <input
              type="text"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="เช่น พี่ยุ้ย, น้องมายด์, พยาบาลแนน"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-text-main placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-emerald-400 transition-all"
            />
          </div>

          {/* Field 2: Sale Price in THB (Satang standard) */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-zinc-200">
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <span>ราคาขายเวร / ค่าตอบแทน (บาท)</span>
                <span className="text-shift-red">*</span>
              </span>
              {salePrice && !isNaN(priceNum) && priceNum >= 0 && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  = {satangVal.toLocaleString()} สตางค์
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="any"
                required
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-3.5 pr-12 py-2.5 text-xs text-text-main placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-emerald-400 transition-all"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 dark:text-zinc-500">
                บาท
              </span>
            </div>
            <p className="text-[10px] text-text-muted dark:text-zinc-400">
              ตัวเลขจะถูกจัดเก็บเป็นหน่วยสตางค์ (Satang Standard: 1 บาท = 100 สตางค์) เพื่อความแม่นยำทางบัญชี
            </p>
          </div>

          {/* Field 3: Payment Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>สถานะการชำระเงิน</span>
              <span className="text-shift-red">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus("unpaid")}
                className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold border transition-all cursor-pointer ${
                  paymentStatus === "unpaid"
                    ? "border-amber-400 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                    : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/60"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>ยังไม่ได้รับเงิน (รอโอน)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatus("paid")}
                className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold border transition-all cursor-pointer ${
                  paymentStatus === "paid"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-2xs dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
                    : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/60"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>ได้รับเงินแล้ว (ชำระแล้ว)</span>
              </button>
            </div>
            {paymentStatus === "paid" && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ ยอดเงินนี้จะถูกนำไปรวมในรายงานสรุปรายรับสุทธิประจำเดือนทันที
              </p>
            )}
          </div>

          {/* Field 4: Sold Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>วันที่ทำรายการขาย</span>
            </label>
            <input
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-text-main focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white transition-all"
            />
          </div>

          {/* Field 5: Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-emerald-600" />
              <span>หมายเหตุเพิ่มเติม (ถ้ามี)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น โอนเข้ากสิกรเรียบร้อย, นัดชำระเงินสด, รายละเอียดเคสสแตนด์บาย"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-text-main placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:border-emerald-400 transition-all resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 active:scale-95 transition-all dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>

            <button
              type="submit"
              disabled={loading || !buyerName.trim() || salePrice.trim() === ""}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>ยืนยันการขายเวร</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
