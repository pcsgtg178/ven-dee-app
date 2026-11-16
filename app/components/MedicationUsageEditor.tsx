"use client";

import React, { useMemo } from "react";
import { Plus, Trash2, Pill, Syringe } from "lucide-react";
import {
  Medications,
  MedicationUsageLine,
  MEDICATION_CATEGORY_CONFIG,
  resolveMedicationCategory,
} from "../../types/vendee";
import {
  calculateMedicationCostSatang,
  calculateMedicationLineCostSatang,
  calculateUnitCostSatang,
} from "../../lib/conflictEngine";
import { estimateFifoCost } from "../../lib/stock";
import { getStockLayers } from "../../lib/storage";

/** Editable row (string quantity for free typing). `snapshot` keeps historical unit cost when editing. */
export interface MedicationUsageRow {
  medicationId: string;
  quantity: string;
  snapshot?: MedicationUsageLine;
}

export const EMPTY_USAGE_ROWS: MedicationUsageRow[] = [];

export function usageRowsFromLines(lines?: MedicationUsageLine[]): MedicationUsageRow[] {
  return (lines || []).map((l) => ({
    medicationId: l.medicationId,
    quantity: String(l.quantity),
    snapshot: l,
  }));
}

/** Convert editable rows into persisted usage lines (snapshotting name/unit/unit cost). */
export function buildUsageLines(rows: MedicationUsageRow[], masterMeds: Medications[]): MedicationUsageLine[] {
  const lines: MedicationUsageLine[] = [];
  for (const row of rows) {
    const quantity = parseFloat(row.quantity);
    if (!row.medicationId || !Number.isFinite(quantity) || quantity <= 0) continue;

    const med = masterMeds.find((m) => m.id === row.medicationId);
    const snap = row.snapshot && row.snapshot.medicationId === row.medicationId ? row.snapshot : undefined;

    const name = snap?.name ?? med?.name;
    if (!name) continue;
    const unitCostSatang = snap?.unitCostSatang ?? calculateUnitCostSatang(med?.price, med?.size);
    lines.push({
      medicationId: row.medicationId,
      name,
      category: snap?.category ?? (med ? resolveMedicationCategory(med.name, med.category) : undefined),
      quantity,
      unit: snap?.unit ?? med?.unit ?? "",
      unitCostSatang,
      lineCostSatang: calculateMedicationLineCostSatang(quantity, unitCostSatang),
    });
  }
  return lines;
}

interface Props {
  rows: MedicationUsageRow[];
  onChange: (rows: MedicationUsageRow[]) => void;
  masterMeds: Medications[];
  onOpenManager: () => void;
  /** Free-text medication names from legacy records without usage lines */
  legacyNames?: string[];
}

const fmtBaht = (satang: number) =>
  `฿${(satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function MedicationUsageEditor({ rows, onChange, masterMeds, onOpenManager, legacyNames }: Props) {
  const lines = buildUsageLines(rows, masterMeds);
  const totalSatang = calculateMedicationCostSatang(lines);

  const sortedMasterMeds = useMemo(() => {
    return [...masterMeds]
      .filter((m) => !m.isArchived)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  }, [masterMeds]);

  const update = (idx: number, patch: Partial<MedicationUsageRow>) => {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], ...patch };
    onChange(copy);
  };

  return (
    <div className="space-y-2 rounded-2xl border border-ds-border bg-ds-surface-elevated p-3.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text">
          <Syringe className="h-3.5 w-3.5 text-ds-icon-secondary" />
          <span>รายการยาที่ใช้</span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenManager}
            className="flex items-center gap-1 text-[11px] font-bold text-ds-text-secondary hover:text-ds-text hover:underline cursor-pointer"
          >
            <Pill className="h-3 w-3" />
            <span>จัดการยา</span>
          </button>
          <button
            type="button"
            onClick={() => onChange([...rows, { medicationId: "", quantity: "" }])}
            className="flex items-center gap-1 text-[11px] font-bold text-ds-primary hover:underline cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>เพิ่มยา</span>
          </button>
        </div>
      </div>

      {rows.length === 0 && (
        <p className="text-[11px] text-ds-text-tertiary">
          ยังไม่ได้เลือกยา — แตะ “เพิ่มยา” เพื่อระบุยาและปริมาณที่ใช้
        </p>
      )}

      {legacyNames && legacyNames.length > 0 && rows.length === 0 && (
        <p className="rounded-lg bg-ds-surface px-2 py-1 text-[11px] text-ds-text-secondary border border-ds-divider">
          รายการเดิม (ไม่ระบุปริมาณ): {legacyNames.join(", ")}
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const med = masterMeds.find((m) => m.id === row.medicationId);
          const snap = row.snapshot && row.snapshot.medicationId === row.medicationId ? row.snapshot : undefined;
          const unit = snap?.unit ?? med?.unit ?? "";
          const qty = parseFloat(row.quantity);
          const refUnitCost = calculateUnitCostSatang(med?.price, med?.packSize ?? med?.size, med?.refCostPerPackSatang);
          const fifoPreview =
            med && Number.isFinite(qty) && qty > 0 && !snap
              ? estimateFifoCost(getStockLayers(med.id), qty, refUnitCost)
              : null;
          const unitCost = snap?.unitCostSatang ?? fifoPreview?.unitCostSatang ?? refUnitCost;
          const lineCost = fifoPreview ? fifoPreview.costSatang : calculateMedicationLineCostSatang(qty, unitCost);
          const onHand = med ? Number(med.stockOnHand ?? 0) : null;
          const isOverStock = onHand !== null && Number.isFinite(qty) && qty > onHand;
          const hasMedOption = sortedMasterMeds.some((m) => m.id === row.medicationId);

          return (
            <div
              key={idx}
              className="flex flex-col gap-1.5 rounded-xl border border-ds-border bg-ds-surface p-2"
            >
              <div className="flex items-center gap-1.5">
                <select
                  value={row.medicationId}
                  onChange={(e) => update(idx, { medicationId: e.target.value, snapshot: undefined })}
                  className="min-w-0 flex-1 truncate rounded-lg border border-ds-border bg-ds-surface-elevated px-2 py-1.5 text-xs text-ds-text focus:border-ds-primary focus:outline-none"
                >
                  <option value="">-- เลือกจากคลังยา --</option>
                  {!hasMedOption && snap && <option value={snap.medicationId}>{snap.name} (เดิม)</option>}
                  {!hasMedOption && !snap && med && (
                    <option value={med.id}>{med.name} (เก็บถาวร)</option>
                  )}
                  {sortedMasterMeds.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{MEDICATION_CATEGORY_CONFIG[resolveMedicationCategory(m.name, m.category)].label}] {m.name}
                      {` (คงเหลือ ${(m.stockOnHand ?? 0).toLocaleString()} ${m.unit || ""})`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ds-icon-secondary transition-colors hover:bg-ds-error-container hover:text-ds-error cursor-pointer"
                  title="ลบรายการยานี้"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => update(idx, { quantity: e.target.value })}
                  className="w-20 rounded-lg border border-ds-border bg-ds-surface-elevated px-2 py-1.5 text-xs text-ds-text text-end outline-none focus:border-ds-primary"
                />
                <span className="text-xs font-semibold text-ds-text-secondary">{unit || "หน่วย"}</span>
                <span className="ml-auto text-xs font-bold text-ds-text">
                  {lineCost > 0 ? fmtBaht(lineCost) : "—"}
                  {fifoPreview?.isEstimated && lineCost > 0 && (
                    <span className="ml-1 text-[10px] font-normal text-ds-warning">(ประมาณ)</span>
                  )}
                </span>
              </div>
              {isOverStock && (
                <p className="text-[11px] font-semibold text-ds-warning">
                  ⚠️ ใช้เกินสต็อกคงเหลือ ({onHand?.toLocaleString()} {unit}) — บันทึกได้แต่สต็อกจะติดลบ
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-ds-divider pt-2 text-xs">
        <span className="font-bold text-ds-text-secondary">ต้นทุนยารวม</span>
        <span className="text-sm font-extrabold text-ds-text">{fmtBaht(totalSatang)}</span>
      </div>
    </div>
  );
}
