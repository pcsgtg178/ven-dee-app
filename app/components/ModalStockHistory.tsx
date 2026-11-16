"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { X, History, RotateCcw, ExternalLink, ArrowUpDown } from "lucide-react";
import type { Medications, StockMovement } from "../../types/vendee";
import { getStockMovementsAction, reverseStockMovementAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";
import { sortStockMovements, type StockHistorySortOrder } from "../../lib/stock";

interface Props {
  isOpen: boolean;
  medication: Medications | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  receive: { label: "รับเข้า", cls: "bg-ds-success-container text-ds-success" },
  use: { label: "ใช้บริการ", cls: "bg-ds-info-container text-ds-info" },
  waste: { label: "สูญเสีย", cls: "bg-ds-error-container text-ds-error" },
  giveaway: { label: "แจกฟรี", cls: "bg-ds-warning-container text-ds-warning" },
  adjust: { label: "ปรับยอด", cls: "bg-ds-primary-container text-ds-primary" },
  reversal: { label: "กลับรายการ", cls: "bg-ds-surface-variant text-ds-text-tertiary" },
};

export default function ModalStockHistory({ isOpen, medication, onClose, onSuccess }: Props) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [sortOrder, setSortOrder] = useState<StockHistorySortOrder>("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [reversingId, setReversingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!medication) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const data = unwrap(await getStockMovementsAction(medication.id, { limit: 500 }));
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

  const sortedMovements = useMemo(
    () => sortStockMovements(movements, sortOrder),
    [movements, sortOrder]
  );

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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-history-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-ds-surface-elevated p-5 shadow-ds-popover border border-ds-border">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-ds-divider">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ds-surface-variant text-ds-icon-primary">
              <History className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 id="stock-history-title" className="text-sm font-bold text-ds-text truncate">
              ประวัติสต็อก: {medication.name}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
              className="inline-flex items-center gap-1 rounded-xl border border-ds-border bg-ds-surface px-2.5 py-1 text-[11px] font-bold text-ds-text-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer transition-colors"
              title="สลับการเรียงตามวันที่"
              aria-label={sortOrder === "desc" ? "เรียงจากล่าสุดก่อน กดเพื่อสลับเป็นเก่าสุดก่อน" : "เรียงจากเก่าสุดก่อน กดเพื่อสลับเป็นล่าสุดก่อน"}
            >
              <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
              <span>{sortOrder === "desc" ? "ล่าสุดก่อน" : "เก่าสุดก่อน"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดประวัติสต็อก"
              className="rounded-lg p-1 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl bg-ds-error-container px-3 py-2 text-xs font-semibold text-ds-error">
            {errorMsg}
          </div>
        )}

        <div className="mt-3 flex-1 overflow-y-auto overscroll-contain space-y-2 pr-1">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-ds-text-tertiary">กำลังโหลด...</p>
          ) : sortedMovements.length === 0 ? (
            <p className="py-8 text-center text-xs text-ds-text-tertiary">ยังไม่มีประวัติเคลื่อนไหวสต็อก</p>
          ) : (
            sortedMovements.map((mv) => {
              const badge = TYPE_BADGE[mv.type] || TYPE_BADGE.reversal;
              const canReverse =
                !mv.reversed && ["receive", "waste", "giveaway", "adjust"].includes(mv.type);
              const costBaht = (mv.costSatang / 100).toLocaleString("th-TH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              });
              const targetTab = mv.service?.status === "upcoming" ? "upcoming" : "history";
              const serviceHref =
                mv.serviceId && mv.service?.customerId
                  ? `/customers/${encodeURIComponent(mv.service.customerId)}?tab=${targetTab}&serviceId=${encodeURIComponent(mv.serviceId)}`
                  : mv.serviceId
                    ? "/customers"
                    : null;

              return (
                <div
                  key={mv.id}
                  className={`rounded-2xl border p-3 text-xs ${
                    mv.reversed
                      ? "border-ds-divider bg-ds-surface/50 opacity-60"
                      : "border-ds-border bg-ds-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span
                        className={`font-bold ${
                          mv.quantity >= 0 ? "text-ds-success" : "text-ds-error"
                        }`}
                      >
                        {mv.quantity >= 0 ? `+${mv.quantity}` : mv.quantity} {unit}
                      </span>
                      {mv.isEstimatedCost && (
                        <span className="rounded bg-ds-warning-container px-1.5 py-0.5 text-[10px] font-semibold text-ds-warning">
                          ต้นทุนประมาณ
                        </span>
                      )}
                      {mv.reversed && (
                        <span className="rounded bg-ds-surface-variant px-1.5 py-0.5 text-[10px] text-ds-text-tertiary">
                          ถูกกลับรายการแล้ว
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-ds-text">
                      ฿{costBaht}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-ds-text-secondary">
                    <div className="truncate">
                      <span>{new Date(mv.occurredAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</span>
                      {mv.service?.customerName && <span> · {mv.service.customerName}</span>}
                      {mv.supplier && <span> · {mv.supplier}</span>}
                      {mv.note && <span> · {mv.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {serviceHref && (
                        <Link
                          href={serviceHref}
                          onClick={onClose}
                          className="inline-flex items-center gap-0.5 font-semibold text-ds-primary hover:underline"
                          title={mv.service?.customerName ? `ไปที่งานบริการของ ${mv.service.customerName}` : "ไปที่งานบริการ"}
                        >
                          <span>งานบริการ</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      )}
                      {canReverse && (
                        <button
                          type="button"
                          disabled={reversingId === mv.id}
                          onClick={() => handleReverse(mv.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-ds-error/40 px-2 py-0.5 text-[10px] font-bold text-ds-error hover:bg-ds-error-container cursor-pointer transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
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
