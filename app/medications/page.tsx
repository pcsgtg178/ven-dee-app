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
    <div className="min-h-screen bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100">
      {/* App Bar */}
      <AppBar title="คลังตัวยาและเวชภัณฑ์" />

      {/* Toast Banner */}
      {toastMessage && (
        <div className="sticky top-14 z-50 mx-auto max-w-lg px-4 py-2">
          <div className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <Check className="h-4 w-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-lg px-4 pt-3 space-y-4">
        {/* Top Summary & Action Bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold tracking-tight text-text-main dark:text-white flex items-center gap-1.5">
                <span>รายการตัวยา</span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
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
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-surface-subtle bg-white px-3 py-2 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-slate-50 active:scale-95 transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-60"
              title="รีเฟรชข้อมูล"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-purple-600" : ""}`} />
              <span>รีเฟรช</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
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
            className="w-full rounded-2xl border border-surface-subtle bg-white pl-11 pr-10 py-3 text-sm text-text-main placeholder:text-text-muted shadow-2xs focus:border-purple-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-text-muted" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main dark:hover:text-white cursor-pointer"
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
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                stockFilter === f.id
                  ? f.id === "negative"
                    ? "bg-rose-600 text-white"
                    : f.id === "low"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "bg-white text-text-muted border border-surface-subtle hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
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
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                categoryFilter === c
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white text-text-muted border border-surface-subtle hover:bg-purple-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
              }`}
            >
              {c === "all" ? "ทั้งหมด" : MEDICATION_CATEGORY_CONFIG[c].label}
            </button>
          ))}
        </div>

        {/* Medication Cards List */}
        <div className="space-y-2.5">
          {filteredMeds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-subtle bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <Pill className="mx-auto h-10 w-10 text-purple-300 dark:text-purple-700 mb-2" />
              <p className="text-sm font-bold text-text-main dark:text-white">
                {searchQuery ? "ไม่พบตัวยาที่ตรงกับคำค้นหา" : "ยังไม่มีรายการตัวยาในระบบ"}
              </p>
              <p className="text-xs text-text-muted dark:text-zinc-400 mt-1">
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
                  className="group relative flex flex-col gap-2.5 rounded-2xl border border-purple-100 bg-white p-3.5 shadow-2xs transition-all hover:border-purple-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left Pill Icon & Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                        <Pill className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-text-main dark:text-white truncate">
                            {med.name}
                          </span>
                          {(med.packSize || med.size || med.unit) && (
                            <span className="shrink-0 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
                              1 {med.packUnit || "ขวด"} = {(med.packSize ?? (Number(med.size) || 1)).toLocaleString()} {med.unit || "ยูนิต"}
                            </span>
                          )}
                          {isPackSizeUnset(med) && (
                            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
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
                            <span className="shrink-0 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              ติดลบ
                            </span>
                          )}
                          {!neg && low && (
                            <span className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              สต็อกต่ำ
                            </span>
                          )}
                          {med.isArchived && (
                            <span className="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-zinc-700 dark:text-zinc-300">
                              เก็บถาวร
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className={`font-bold ${neg ? "text-rose-600" : low ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                            คงเหลือ: {onHandText}
                          </span>
                          {refCostThb > 0 && (
                            <span className="text-[11px] text-text-muted dark:text-zinc-400">
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
                        className="rounded-lg p-1.5 text-text-muted hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-950/40 dark:hover:text-purple-300 cursor-pointer"
                        title="แก้ไขข้อมูลตัวยา"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(med)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 cursor-pointer"
                        title={med.isArchived ? "นำกลับมาใช้งาน" : "เก็บถาวร (Archive)"}
                      >
                        {med.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(med)}
                        className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red dark:hover:bg-rose-950/40 cursor-pointer"
                        title="ลบตัวยานี้"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Stock Action Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "receive", med })}
                      className="flex items-center justify-center gap-1 rounded-xl bg-emerald-50 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      <span>รับเข้า</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "issue", med })}
                      className="flex items-center justify-center gap-1 rounded-xl bg-amber-50 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 cursor-pointer"
                    >
                      <PackageMinus className="h-3.5 w-3.5" />
                      <span>ตัดออก</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "count", med })}
                      className="flex items-center justify-center gap-1 rounded-xl bg-sky-50 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 cursor-pointer"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      <span>นับสต็อก</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockModal({ type: "history", med })}
                      className="flex items-center justify-center gap-1 rounded-xl bg-purple-50 py-1.5 text-[11px] font-bold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 border border-surface-subtle dark:border-zinc-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-subtle px-5 py-4 dark:border-zinc-800 bg-surface-subtle/30 dark:bg-zinc-800/30">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                  <Pill className="h-4 w-4" />
                </div>
                <h3 className="font-extrabold text-base text-text-main dark:text-white">
                  {editingMed ? "แก้ไขข้อมูลตัวยา" : "เพิ่มตัวยาใหม่"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-text-muted hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-shift-red dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                  ชื่อตัวยา / เวชภัณฑ์ <span className="text-shift-red">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Botox, Vitamin B12, NSS 100ml"
                  className="w-full rounded-xl border border-surface-subtle bg-slate-50 px-3.5 py-2.5 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-900"
                />
              </div>

              {/* Units & Packaging */}
              <div className="space-y-3 rounded-2xl border border-purple-100 bg-purple-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="text-xs font-extrabold text-text-main dark:text-zinc-100">
                  หน่วยนับ & บรรจุภัณฑ์
                </div>

                {/* Usage unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                    หน่วยที่ใช้กับลูกค้า
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="เช่น ยูนิต, cc, เข็ม"
                    className="w-full rounded-xl border border-surface-subtle bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["ยูนิต", "cc", "เข็ม", "ชิ้น", "เม็ด"].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                          unit === u
                            ? "bg-purple-600 text-white"
                            : "bg-white text-text-muted hover:bg-purple-100 hover:text-purple-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Purchase unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                    หน่วยที่ซื้อ / รับเข้า
                  </label>
                  <input
                    type="text"
                    value={packUnit}
                    onChange={(e) => setPackUnit(e.target.value)}
                    placeholder="เช่น กล่อง, ขวด"
                    className="w-full rounded-xl border border-surface-subtle bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {["กล่อง", "ขวด", "แพ็ค", "ชุด", "แผง", "กระปุก"].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setPackUnit(u)}
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                          packUnit === u
                            ? "bg-purple-600 text-white"
                            : "bg-white text-text-muted hover:bg-purple-100 hover:text-purple-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversion: 1 packUnit = N unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                    ขนาดบรรจุ
                  </label>
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main dark:text-zinc-100">
                    <span className="shrink-0">1 {packUnit || "ขวด"} =</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={packSize}
                      onChange={(e) => setPackSize(e.target.value)}
                      placeholder="200"
                      aria-label="ขนาดบรรจุ"
                      className="w-24 rounded-xl border border-surface-subtle bg-white px-2.5 py-2 text-sm focus:border-purple-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 font-semibold"
                    />
                    <span className="shrink-0">{unit || "ยูนิต"}</span>
                  </div>
                  {isPackSizeUnset({ packSize: Number(packSize) || 1, unit, packUnit }) && (
                    <div className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      ⚠️ ตอนนี้ 1 {packUnit || "ขวด"} = 1 {unit || "ยูนิต"} — ถ้า 1 {packUnit || "ขวด"} มีหลาย{unit || "ยูนิต"} (เช่น 200) กรุณาแก้ให้ถูก ไม่งั้นยอดสต็อกและต้นทุนต่อ{unit || "ยูนิต"}จะผิด
                    </div>
                  )}
                  {legacySizeHint && (
                    <button
                      type="button"
                      onClick={() => setPackSize(String(legacySizeHint))}
                      className="text-[11px] font-bold text-purple-700 underline hover:text-purple-900 dark:text-purple-300 cursor-pointer"
                    >
                      ข้อมูลเดิมระบุขนาด {legacySizeHint} — ใช้ค่านี้
                    </button>
                  )}
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main dark:text-zinc-200">หมวดหมู่ตัวยา</label>
                <div className="flex flex-wrap gap-1.5">
                  {MEDICATION_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        category === c
                          ? "bg-purple-600 text-white"
                          : "bg-surface-subtle text-text-muted hover:bg-purple-100 hover:text-purple-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {MEDICATION_CATEGORY_CONFIG[c].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference cost per pack */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                  ต้นทุนอ้างอิง ต่อ{packUnit || "ขวด"} (บาท)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={refCostPerPackThb}
                  onChange={(e) => setRefCostPerPackThb(e.target.value)}
                  placeholder="เช่น 2500"
                  className="w-full rounded-xl border border-surface-subtle bg-slate-50 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 font-semibold"
                />
                {Number(refCostPerPackThb) > 0 && (Number(packSize) || 1) > 0 && (
                  <p className="text-[11px] text-text-muted dark:text-zinc-400">
                    ≈ ฿{(Number(refCostPerPackThb) / (Number(packSize) || 1)).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ต่อ{unit || "ยูนิต"} · ใช้เมื่อยังไม่มีล็อตรับเข้า
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                  แจ้งเตือนเมื่อเหลือต่ำกว่า ({packUnit || "ขวด"}) — 0 = ไม่เตือน
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={reorderPointPacks}
                  onChange={(e) => setReorderPointPacks(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-xl border border-surface-subtle bg-slate-50 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 font-semibold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                  รายละเอียด / คุณสมบัติ
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น นาบูตะ *นำเข้า, เก็บในอุณหภูมิห้อง 2-8°C..."
                  className="w-full rounded-xl border border-surface-subtle bg-slate-50 p-3 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-900"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
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
