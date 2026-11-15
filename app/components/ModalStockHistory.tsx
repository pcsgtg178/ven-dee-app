"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, History, RotateCcw, ExternalLink } from "lucide-react";
import type { Medications, StockMovement } from "../../types/vendee";
import { getStockMovementsAction, reverseStockMovementAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";

interface Props {
  isOpen: boolean;
  medication: Medications | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  receive: { label: "รับเข้า", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  use: { label: "ใช้บริการ", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
  waste: { label: "สูญเสีย", cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  giveaway: { label: "แจกฟรี", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  adjust: { label: "ปรับยอด", cls: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" },
  reversal: { label: "กลับรายการ", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" },
};

export default function ModalStockHistory({ isOpen, medication, onClose, onSuccess }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [reversingId, setReversingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!medication) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const data = unwrap(await getStockMovementsAction(medication.id, { limit: 100 }));
      setMovements(data);
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถโหลดประวัติสต็อกได้");
    } finally {
      setIsLoading(false);
    }
  }, [medication]);

  useEffect(() => {
    if (isOpen && medication) {
      loadHistory();
    }
  }, [isOpen, medication, loadHistory]);

  if (!isOpen || !medication) return null;

  const unit = medication.unit || "ยูนิต";

  const handleReverse = async (movId: string) => {
    setErrorMsg("");
    setReversingId(movId);
    try {
      unwrap(await reverseStockMovementAction(movId));
      await loadHistory();
      onSuccess(`กลับรายการสต็อก ${medication.name} เรียบร้อย`);
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถกลับรายการได้");
    } finally {
      setReversingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              ประวัติสต็อก: {medication.name}
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

        {errorMsg && (
          <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-slate-400">กำลังโหลด...</p>
          ) : movements.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">ยังไม่มีประวัติเคลื่อนไหวสต็อก</p>
          ) : (
            movements.map((mv) => {
              const badge = TYPE_BADGE[mv.type] || TYPE_BADGE.reversal;
              const canReverse =
                !mv.reversed && ["receive", "waste", "giveaway", "adjust"].includes(mv.type);
              const costBaht = (mv.costSatang / 100).toLocaleString("th-TH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              });

              return (
                <div
                  key={mv.id}
                  className={`rounded-2xl border p-3 text-xs ${
                    mv.reversed
                      ? "border-slate-100 bg-slate-50/60 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/40"
                      : "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span
                        className={`font-bold ${
                          mv.quantity >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {mv.quantity >= 0 ? `+${mv.quantity}` : mv.quantity} {unit}
                      </span>
                      {mv.isEstimatedCost && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          ต้นทุนประมาณ
                        </span>
                      )}
                      {mv.reversed && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                          ถูกกลับรายการแล้ว
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-700 dark:text-zinc-200">
                      ฿{costBaht}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <div className="truncate">
                      <span>{new Date(mv.occurredAt).toLocaleString("th-TH")}</span>
                      {mv.supplier && <span> · {mv.supplier}</span>}
                      {mv.note && <span> · {mv.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {mv.serviceId && (
                        <Link
                          href="/customers"
                          className="inline-flex items-center gap-0.5 text-sky-600 hover:underline dark:text-sky-400"
                        >
                          <span>งานบริการ</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {canReverse && (
                        <button
                          type="button"
                          disabled={reversingId === mv.id}
                          onClick={() => handleReverse(mv.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>{reversingId === mv.id ? "กำลังกลับ..." : "กลับรายการ"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
