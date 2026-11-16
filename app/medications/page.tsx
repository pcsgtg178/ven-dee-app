"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Pill,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  RotateCw,
  PackagePlus,
  PackageMinus,
  ClipboardCheck,
  History,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import ModalStockReceive from "../components/ModalStockReceive";
import ModalStockIssue from "../components/ModalStockIssue";
import ModalStockCount from "../components/ModalStockCount";
import ModalStockHistory from "../components/ModalStockHistory";
import { formatOnHand, isLowStock, isNegativeStock, isPackSizeUnset } from "../../lib/stock";
import { archiveMedicationAction } from "../actions/medicationActions";
import { unwrap } from "../../lib/actionHelper";
import {
  Medications,
  MedicationCategory,
  MEDICATION_CATEGORIES,
  MEDICATION_CATEGORY_CONFIG,
  resolveMedicationCategory,
} from "../../types/vendee";
import {
  getMedications,
  syncMedicationsFromApi,
  saveMedication,
  deleteMedication,
  subscribeToStorage,
} from "../../lib/storage";

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medications[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medications | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MedicationCategory>("other");
  const [categoryFilter, setCategoryFilter] = useState<"all" | MedicationCategory>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "negative" | "archived">("all");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("ยูนิต");
  const [packSize, setPackSize] = useState("1");
  const [packUnit, setPackUnit] = useState("ขวด");
  const [refCostPerPackThb, setRefCostPerPackThb] = useState("");
  const [reorderPointPacks, setReorderPointPacks] = useState("1");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stockModal, setStockModal] = useState<{
    type: "receive" | "issue" | "count" | "history";
    med: Medications;
  } | null>(null);

  const loadData = useCallback(async (syncFromDb = true) => {
    // 1. Instant load from local storage cache
    const local = getMedications();
    setMedications(local);

    // 2. Asynchronously synchronize with Supabase API / Database
    if (syncFromDb) {
      setIsSyncing(true);
      try {
        const res = await syncMedicationsFromApi();
        setMedications(res.medications);
      } catch (err) {
        console.warn("Failed to load medications from API:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const unsub = subscribeToStorage(() => loadData(false));
    return () => unsub();
  }, [loadData]);

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isSubmitting]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Legacy "size" (e.g. "100") from before Phase 14 — offer it as a one-click pack size fix.
  const legacySizeNum = parseFloat(String(editingMed?.size ?? ""));
  const legacySizeHint =
    editingMed && (Number(packSize) || 1) <= 1 && Number.isFinite(legacySizeNum) && legacySizeNum > 1
      ? legacySizeNum
      : null;

  const handleOpenAdd = () => {
    setEditingMed(null);
    setName("");
    setCategory("other");
    setSize("");
    setPrice("");
    setUnit("ยูนิต");
    setPackSize("1");
    setPackUnit("ขวด");
    setRefCostPerPackThb("");
    setReorderPointPacks("1");
    setDescription("");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (med: Medications) => {
    setEditingMed(med);
    setName(med.name);
    setCategory(resolveMedicationCategory(med.name, med.category));
    setSize(med.size || "");
    setPrice(med.price !== undefined ? String(med.price) : "");
    setUnit(med.unit || "ยูนิต");
    setPackSize(med.packSize !== undefined ? String(med.packSize) : med.size || "1");
    setPackUnit(med.packUnit || "ขวด");
    setRefCostPerPackThb(
      med.refCostPerPackSatang !== undefined && med.refCostPerPackSatang > 0
        ? String(med.refCostPerPackSatang / 100)
        : ""
    );
    setReorderPointPacks(
      med.reorderPointPacks !== undefined ? String(med.reorderPointPacks) : "1"
    );
    setDescription(med.description || med.note || "");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("กรุณาระบุชื่อตัวยา");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const parsedPackSize = Math.max(1, Number(packSize) || 1);
      const parsedRefCostSatang = refCostPerPackThb !== "" ? Math.round(Math.max(0, Number(refCostPerPackThb) || 0) * 100) : 0;
      const parsedReorder = Math.max(0, Number(reorderPointPacks) || 0);

      await saveMedication({
        id: editingMed ? editingMed.id : undefined,
        name: name.trim(),
        category,
        size: String(parsedPackSize),
        price: price.trim() || undefined,
        unit: unit.trim() || undefined,
        packSize: parsedPackSize,
        packUnit: packUnit.trim() || "ขวด",
        refCostPerPackSatang: parsedRefCostSatang,
        reorderPointPacks: parsedReorder,
        description: description.trim() || undefined,
        note: description.trim() || undefined,
      });

      setIsModalOpen(false);
      await loadData(false);
      showToast(editingMed ? `อัปเดตตัวยา "${name.trim()}" เรียบร้อยแล้ว` : `เพิ่มตัวยา "${name.trim()}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวยา");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async (med: Medications) => {
    try {
      const nextArchived = !med.isArchived;
      unwrap(await archiveMedicationAction(med.id, nextArchived));
      await loadData(true);
      showToast(nextArchived ? `เก็บถาวร "${med.name}" แล้ว` : `นำ "${med.name}" กลับมาใช้งานแล้ว`);
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err.message || err}`);
    }
  };

  const handleDelete = async (med: Medications) => {
    if (confirm(`คุณต้องการลบตัวยา "${med.name}" ออกจากคลังใช่หรือไม่?`)) {
      try {
        await deleteMedication(med.id);
        await loadData(false);
        showToast(`ลบตัวยา "${med.name}" เรียบร้อยแล้ว`);
      } catch (err: any) {
        showToast(`เกิดข้อผิดพลาดในการลบ: ${err.message || err}`);
      }
    }
  };

  // Filtered medications by search, category, and stock status
  const filteredMeds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return medications
      .filter((m) => {
        if (stockFilter === "archived") {
          if (!m.isArchived) return false;
        } else {
          if (m.isArchived) return false;
          if (stockFilter === "low" && !isLowStock(m)) return false;
          if (stockFilter === "negative" && !isNegativeStock(m)) return false;
        }
        if (categoryFilter !== "all" && resolveMedicationCategory(m.name, m.category) !== categoryFilter) return false;
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          (m.size && m.size.toLowerCase().includes(q)) ||
          (m.unit && m.unit.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q)) ||
          (m.note && m.note.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  }, [medications, searchQuery, categoryFilter, stockFilter]);

  return (
    <div className="min-h-screen bg-ds-bg text-ds-text">
      {/* App Bar */}
      <AppBar title="คลังตัวยาและเวชภัณฑ์" />

      {/* Toast Banner */}
      {toastMessage && (
        <div className="sticky top-14 z-50 mx-auto max-w-lg px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl border border-ds-primary/40 bg-ds-surface-elevated px-4 py-2.5 text-xs font-bold text-ds-text shadow-ds-popover animate-in fade-in slide-in-from-top-2 duration-200">
            <Check className="h-4 w-4 shrink-0 text-ds-primary" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-lg px-4 pt-3 space-y-4">
        {/* Top Summary & Action Bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold tracking-tight text-ds-text flex items-center gap-1.5">
                <span>รายการตัวยา</span>
                <span className="rounded-full bg-ds-surface-variant px-2 py-0.5 text-xs font-bold text-ds-text-secondary border border-ds-border/60">
                  {medications.length} รายการ
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isSyncing}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-ds-border bg-ds-surface-elevated px-3 py-2 text-xs font-semibold text-ds-text-secondary hover:text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer disabled:opacity-60"
              title="รีเฟรชข้อมูล"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-ds-primary" : ""}`} />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ds-primary px-3.5 py-2 text-xs font-bold text-ds-on-primary shadow-ds-card hover:bg-ds-primary-hover active:bg-ds-primary-pressed active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มตัวยา</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อตัวยา หรือหน่วยนับ..."
            className="w-full rounded-2xl border border-ds-border bg-ds-surface-elevated pl-11 pr-10 py-3 text-sm text-ds-text placeholder:text-ds-text-tertiary shadow-2xs focus:border-ds-primary focus:outline-none"
          />
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-ds-icon-secondary" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="ล้างคำค้นหา"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ds-icon-secondary hover:text-ds-text cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Stock Status Filter */}
        <div className="flex flex-wrap gap-1.5">
          {([
            { id: "all", label: "ใช้งานอยู่" },
            { id: "low", label: "สต็อกต่ำ" },
            { id: "negative", label: "ติดลบ" },
            { id: "archived", label: "เก็บถาวร" },
          ] as const).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStockFilter(f.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer border ${
                stockFilter === f.id
                  ? f.id === "negative"
                    ? "border-ds-error/40 bg-ds-error-container text-ds-error"
                    : f.id === "low"
                      ? "border-ds-warning/40 bg-ds-warning-container text-ds-warning"
                      : "border-transparent bg-ds-primary text-ds-on-primary"
                  : "border-ds-border bg-ds-surface text-ds-text-secondary hover:bg-ds-surface-elevated"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...MEDICATION_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer border ${
                categoryFilter === c
                  ? "border-transparent bg-ds-primary text-ds-on-primary shadow-xs"
                  : "border-ds-border bg-ds-surface text-ds-text-secondary hover:bg-ds-surface-elevated"
              }`}
            >
              {c === "all" ? "ทั้งหมด" : MEDICATION_CATEGORY_CONFIG[c].label}
            </button>
          ))}
        </div>

        {/* Medication Cards List */}
        <div className="space-y-2.5">
          {filteredMeds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ds-border bg-ds-surface p-8 text-center">
              <Pill className="mx-auto h-10 w-10 text-ds-icon-disabled mb-2" />
              <p className="text-sm font-bold text-ds-text">
                {searchQuery ? "ไม่พบตัวยาที่ตรงกับคำค้นหา" : "ยังไม่มีรายการตัวยาในระบบ"}
              </p>
              <p className="text-xs text-ds-text-secondary mt-1">
                {searchQuery
                  ? "ลองเปลี่ยนคำค้นหา หรือกดล้างการค้นหา"
                  : "กดปุ่ม 'เพิ่มตัวยา' ด้านบนเพื่อเริ่มต้นสร้างฐานข้อมูลตัวยา"}
              </p>
            </div>
          ) : (
            filteredMeds.map((med) => {
              const refCostThb = (Number(med.refCostPerPackSatang || 0)) / 100;
              const low = isLowStock(med);
              const neg = isNegativeStock(med);
              const onHandText = formatOnHand(
                med.stockOnHand ?? 0,
                med.unit || "ยูนิต",
                med.packSize ?? (Number(med.size) || 1),
                med.packUnit || "ขวด"
              );

              return (
                <div
                  key={med.id}
                  className="group relative flex flex-col gap-3 rounded-2xl border border-ds-border bg-ds-surface p-4 shadow-ds-card transition-colors hover:border-ds-text-tertiary/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left Pill Icon & Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ds-surface-elevated text-ds-icon-secondary border border-ds-divider">
                        <Pill className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-ds-text truncate">
                            {med.name}
                          </span>
                          {(med.packSize || med.size || med.unit) && (
                            <span className="shrink-0 rounded-md bg-ds-surface-variant px-2 py-0.5 text-[10px] font-bold text-ds-text-secondary border border-ds-border/60">
                              1 {med.packUnit || "ขวด"} = {(med.packSize ?? (Number(med.size) || 1)).toLocaleString()} {med.unit || "ยูนิต"}
                            </span>
                          )}
                          {isPackSizeUnset(med) && (
                            <span className="shrink-0 rounded-md bg-ds-warning-container px-2 py-0.5 text-[10px] font-bold text-ds-warning">
                              ยังไม่ตั้งขนาดบรรจุ
                            </span>
                          )}
                          {(() => {
                            const cat = resolveMedicationCategory(med.name, med.category);
                            return (
                              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${MEDICATION_CATEGORY_CONFIG[cat].badge}`}>
                                {MEDICATION_CATEGORY_CONFIG[cat].label}
                              </span>
                            );
                          })()}
                          {neg && (
                            <span className="shrink-0 rounded-md bg-ds-error-container px-2 py-0.5 text-[10px] font-bold text-ds-error">
                              ติดลบ
                            </span>
                          )}
                          {!neg && low && (
                            <span className="shrink-0 rounded-md bg-ds-warning-container px-2 py-0.5 text-[10px] font-bold text-ds-warning">
                              สต็อกต่ำ
                            </span>
                          )}
                          {med.isArchived && (
                            <span className="shrink-0 rounded-md bg-ds-surface-variant px-2 py-0.5 text-[10px] font-bold text-ds-text-tertiary">
                              เก็บถาวร
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className={`font-bold ${neg ? "text-ds-error" : low ? "text-ds-warning" : "text-ds-success"}`}>
                            คงเหลือ: {onHandText}
                          </span>
                          {refCostThb > 0 && (
                            <span className="text-[11px] text-ds-text-secondary">
                              ต้นทุนอ้างอิง ฿{refCostThb.toLocaleString()}/{med.packUnit || "ขวด"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Edit / Archive / Delete Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(med)}
                        className="rounded-lg p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer transition-colors"
                        title="แก้ไขข้อมูลตัวยา"
                        aria-label={`แก้ไข ${med.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(med)}
                        className="rounded-lg p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer transition-colors"
                        title={med.isArchived ? "นำกลับมาใช้งาน" : "เก็บถาวร (Archive)"}
                        aria-label={med.isArchived ? `นำ ${med.name} กลับมาใช้งาน` : `เก็บถาวร ${med.name}`}
                      >
                        {med.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(med)}
                        className="rounded-lg p-1.5 text-ds-icon-secondary hover:bg-ds-error-container hover:text-ds-error cursor-pointer transition-colors"
                        title="ลบตัวยานี้"
                        aria-label={`ลบ ${med.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stock Action Buttons — Neutral surface with muted icons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-ds-divider">
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "receive", med })}
                      className="flex items-center justify-center gap-1 rounded-xl border border-ds-border bg-ds-surface-elevated py-2 text-[11px] font-semibold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
                    >
                      <PackagePlus className="h-3.5 w-3.5 text-ds-icon-secondary" />
                      <span>รับเข้า</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "issue", med })}
                      className="flex items-center justify-center gap-1 rounded-xl border border-ds-border bg-ds-surface-elevated py-2 text-[11px] font-semibold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
                    >
                      <PackageMinus className="h-3.5 w-3.5 text-ds-icon-secondary" />
                      <span>ตัดออก</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "count", med })}
                      className="flex items-center justify-center gap-1 rounded-xl border border-ds-border bg-ds-surface-elevated py-2 text-[11px] font-semibold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5 text-ds-icon-secondary" />
                      <span>นับสต็อก</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "history", med })}
                      className="flex items-center justify-center gap-1 rounded-xl border border-ds-border bg-ds-surface-elevated py-2 text-[11px] font-semibold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5 text-ds-icon-secondary" />
                      <span>ประวัติ</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add / Edit Medication Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="med-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-ds-surface-elevated shadow-ds-popover border border-ds-border">
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-ds-divider px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ds-surface-variant text-ds-icon-primary">
                  <Pill className="h-4 w-4" />
                </div>
                <h3 id="med-modal-title" className="font-extrabold text-base text-ds-text">
                  {editingMed ? "แก้ไขข้อมูลตัวยา" : "เพิ่มตัวยาใหม่"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="rounded-full p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-ds-error-container p-3 text-xs font-semibold text-ds-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ds-text">
                  ชื่อตัวยา / เวชภัณฑ์ <span className="text-ds-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Botox, Vitamin B12, NSS 100ml"
                  className="w-full rounded-xl border border-ds-border bg-ds-surface px-3.5 py-2.5 text-sm text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                />
              </div>

              {/* Units & Packaging */}
              <div className="space-y-3 rounded-2xl border border-ds-border bg-ds-surface p-3.5">
                <div className="text-xs font-extrabold text-ds-text">
                  หน่วยนับ & บรรจุภัณฑ์
                </div>

                {/* Usage unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ds-text-secondary">
                    หน่วยที่ใช้กับลูกค้า
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="เช่น ยูนิต, cc, เข็ม"
                    className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated px-3 py-2 text-sm text-ds-text focus:border-ds-primary focus:outline-none font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["ยูนิต", "cc", "เข็ม", "ชิ้น", "เม็ด"].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                          unit === u
                            ? "bg-ds-primary text-ds-on-primary"
                            : "bg-ds-surface-variant text-ds-text-secondary hover:text-ds-text"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Purchase unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ds-text-secondary">
                    หน่วยที่ซื้อ / รับเข้า
                  </label>
                  <input
                    type="text"
                    value={packUnit}
                    onChange={(e) => setPackUnit(e.target.value)}
                    placeholder="เช่น กล่อง, ขวด"
                    className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated px-3 py-2 text-sm text-ds-text focus:border-ds-primary focus:outline-none font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["กล่อง", "ขวด", "แพ็ค", "ชุด", "แผง", "กระปุก"].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setPackUnit(u)}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer ${
                          packUnit === u
                            ? "bg-ds-primary text-ds-on-primary"
                            : "bg-ds-surface-variant text-ds-text-secondary hover:text-ds-text"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversion: 1 packUnit = N unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-ds-text-secondary">
                    ขนาดบรรจุ
                  </label>
                  <div className="flex items-center gap-2 text-sm font-semibold text-ds-text">
                    <span className="shrink-0">1 {packUnit || "ขวด"} =</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={packSize}
                      onChange={(e) => setPackSize(e.target.value)}
                      placeholder="200"
                      aria-label="ขนาดบรรจุ"
                      className="w-24 rounded-xl border border-ds-border bg-ds-surface-elevated px-2.5 py-2 text-sm text-ds-text focus:border-ds-primary focus:outline-none font-semibold"
                    />
                    <span className="shrink-0">{unit || "ยูนิต"}</span>
                  </div>
                  {isPackSizeUnset({ packSize: Number(packSize) || 1, unit, packUnit }) && (
                    <div className="rounded-lg bg-ds-warning-container px-2.5 py-1.5 text-[11px] font-semibold text-ds-warning">
                      ⚠️ ตอนนี้ 1 {packUnit || "ขวด"} = 1 {unit || "ยูนิต"} — ถ้า 1 {packUnit || "ขวด"} มีหลาย{unit || "ยูนิต"} (เช่น 200) กรุณาแก้ให้ถูก ไม่งั้นยอดสต็อกและต้นทุนต่อ{unit || "ยูนิต"}จะผิด
                    </div>
                  )}
                  {legacySizeHint && (
                    <button
                      type="button"
                      onClick={() => setPackSize(String(legacySizeHint))}
                      className="text-[11px] font-bold text-ds-primary underline hover:text-ds-primary-hover cursor-pointer"
                    >
                      ข้อมูลเดิมระบุขนาด {legacySizeHint} — ใช้ค่านี้
                    </button>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ds-text">หมวดหมู่ตัวยา</label>
                <div className="flex flex-wrap gap-1.5">
                  {MEDICATION_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        category === c
                          ? "bg-ds-primary text-ds-on-primary"
                          : "bg-ds-surface-variant text-ds-text-secondary hover:text-ds-text"
                      }`}
                    >
                      {MEDICATION_CATEGORY_CONFIG[c].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference cost per pack */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ds-text">
                  ต้นทุนอ้างอิง ต่อ{packUnit || "ขวด"} (บาท)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={refCostPerPackThb}
                  onChange={(e) => setRefCostPerPackThb(e.target.value)}
                  placeholder="เช่น 2500"
                  className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none font-semibold"
                />
                {Number(refCostPerPackThb) > 0 && (Number(packSize) || 1) > 0 && (
                  <p className="text-[11px] text-ds-text-secondary">
                    ≈ ฿{(Number(refCostPerPackThb) / (Number(packSize) || 1)).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ต่อ{unit || "ยูนิต"} · ใช้เมื่อยังไม่มีล็อตรับเข้า
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ds-text">
                  แจ้งเตือนเมื่อเหลือต่ำกว่า ({packUnit || "ขวด"}) — 0 = ไม่เตือน
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={reorderPointPacks}
                  onChange={(e) => setReorderPointPacks(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none font-semibold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ds-text">
                  รายละเอียด / คุณสมบัติ
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น นาบูตะ *นำเข้า, เก็บในอุณหภูมิห้อง 2-8°C..."
                  className="w-full rounded-xl border border-ds-border bg-ds-surface p-3 text-sm text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-ds-border bg-ds-surface py-2.5 text-xs font-bold text-ds-text hover:bg-ds-surface-variant cursor-pointer disabled:opacity-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-ds-primary py-2.5 text-xs font-bold text-ds-on-primary hover:bg-ds-primary-hover active:bg-ds-primary-pressed active:scale-95 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSubmitting ? "กำลังบันทึก..." : editingMed ? "บันทึกการแก้ไข" : "เพิ่มตัวยา"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modals */}
      <ModalStockReceive
        isOpen={stockModal?.type === "receive"}
        medication={stockModal?.med ?? null}
        onClose={() => setStockModal(null)}
        onSuccess={async (msg) => {
          showToast(msg);
          await loadData(true);
        }}
      />
      <ModalStockIssue
        isOpen={stockModal?.type === "issue"}
        medication={stockModal?.med ?? null}
        onClose={() => setStockModal(null)}
        onSuccess={async (msg) => {
          showToast(msg);
          await loadData(true);
        }}
      />
      <ModalStockCount
        isOpen={stockModal?.type === "count"}
        medication={stockModal?.med ?? null}
        onClose={() => setStockModal(null)}
        onSuccess={async (msg) => {
          showToast(msg);
          await loadData(true);
        }}
      />
      <ModalStockHistory
        isOpen={stockModal?.type === "history"}
        medication={stockModal?.med ?? null}
        onClose={() => setStockModal(null)}
        onSuccess={async (msg) => {
          showToast(msg);
          await loadData(true);
        }}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
