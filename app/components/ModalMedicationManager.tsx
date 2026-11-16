"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Pencil, Trash2, Pill, Search, Check, DollarSign, RotateCw } from "lucide-react";
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

interface ModalMedicationManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedication?: (medName: string) => void;
}

export default function ModalMedicationManager({
  isOpen,
  onClose,
  onSelectMedication,
}: ModalMedicationManagerProps) {
  const [medications, setMedications] = useState<Medications[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State for Add / Edit
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MedicationCategory>("other");
  const [categoryFilter, setCategoryFilter] = useState<"all" | MedicationCategory>("all");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("ยูนิต");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showForm, setShowForm] = useState(false);

  const loadData = async (syncFromDb = false) => {
    // 1. Instant load from local storage
    setMedications(getMedications());

    // 2. Background sync from Supabase API / database
    if (syncFromDb) {
      setIsSyncing(true);
      try {
        const res = await syncMedicationsFromApi();
        setMedications(res.medications);
      } catch (err) {
        console.warn("Sync medications in modal warning:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData(true);
      setShowForm(false);
      resetForm();
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = subscribeToStorage(() => loadData(false));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingMedId(null);
    setName("");
    setCategory("other");
    setSize("");
    setPrice("");
    setUnit("ยูนิต");
    setDescription("");
    setErrorMsg("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (med: Medications) => {
    setEditingMedId(med.id);
    setName(med.name);
    setCategory(resolveMedicationCategory(med.name, med.category));
    setSize(med.size || "");
    setPrice(med.price !== undefined ? String(med.price) : "");
    setUnit(med.unit || "ยูนิต");
    setDescription(med.description || med.note || "");
    setErrorMsg("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("กรุณากรอกชื่อตัวยา");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      await saveMedication({
        id: editingMedId || undefined,
        name: name.trim(),
        category,
        size: size.trim() || undefined,
        price: price.trim() || undefined,
        unit: unit.trim() || undefined,
        description: description.trim() || undefined,
        note: description.trim() || undefined,
      });

      setShowForm(false);
      resetForm();
      await loadData(false);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกตัวยา");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, medName: string) => {
    if (confirm(`ยืนยันลบรายการยา "${medName}"?`)) {
      try {
        await deleteMedication(id);
        await loadData(false);
      } catch (err: any) {
        console.warn("Failed to delete medication:", err);
      }
    }
  };

  const filteredMeds = medications
    .filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        (categoryFilter === "all" || resolveMedicationCategory(m.name, m.category) === categoryFilter)
    )
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="med-manager-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-ds-surface-elevated shadow-ds-popover border border-ds-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-divider px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ds-surface-variant text-ds-icon-primary">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="med-manager-title" className="text-base font-bold text-ds-text">
                  จัดการรายการยา
                </h2>
                {isSyncing && (
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-ds-primary" />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isSyncing}
              className="rounded-full p-2 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-ds-primary" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="rounded-full p-2 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
          {showForm ? (
            /* Add / Edit Form */
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ds-border bg-ds-surface p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ds-text">
                  {editingMedId ? "แก้ไขรายการยา" : "เพิ่มตัวยาใหม่"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-ds-text-secondary hover:text-ds-text cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-ds-error-container p-2 text-xs font-semibold text-ds-error">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                  ชื่อยา / รายการ *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Botox, Vitamin B12, Paracetamol"
                  className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated p-2.5 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                    ขนาด
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="เช่น 100, 50"
                    className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated p-2.5 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                    หน่วย
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="เช่น ยูนิต"
                      className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated p-2.5 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                    ราคา (บาท)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="เช่น 2500"
                      className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated pl-6 pr-2 py-2.5 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                    />
                    <DollarSign className="absolute left-2 top-3 h-3 w-3 text-ds-icon-secondary" />
                  </div>
                </div>
              </div>

              {/* Unit preset buttons */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-ds-text-secondary">หน่วยแนะนำ:</span>
                {["ยูนิต", "เข็ม", "ขวด", "ชุด", "แผง", "cc"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                      unit === u
                        ? "bg-ds-primary text-ds-on-primary"
                        : "bg-ds-surface-variant text-ds-text-secondary hover:text-ds-text"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                  หมวดหมู่
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MEDICATION_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
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

              <div>
                <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
                  รายละเอียด / ข้อกำหนด
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น นาบูตะ *นำเข้า, ผสม NSS 100ml"
                  className="w-full rounded-xl border border-ds-border bg-ds-surface-elevated p-2.5 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-ds-border bg-ds-surface-elevated px-4 py-2 text-xs font-semibold text-ds-text-secondary hover:bg-ds-surface-variant hover:text-ds-text disabled:opacity-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-ds-primary px-4 py-2 text-xs font-bold text-ds-on-primary hover:bg-ds-primary-hover shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{isSubmitting ? "กำลังบันทึก..." : "บันทึก"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อยา..."
                  className="w-full rounded-xl border border-ds-border bg-ds-surface pl-8 pr-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary focus:border-ds-primary focus:outline-none"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ds-icon-secondary" />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as "all" | MedicationCategory)}
                className="shrink-0 rounded-xl border border-ds-border bg-ds-surface px-2 py-2 text-xs text-ds-text focus:border-ds-primary focus:outline-none"
                title="กรองตามหมวดหมู่"
              >
                <option value="all">ทุกหมวด</option>
                {MEDICATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {MEDICATION_CATEGORY_CONFIG[c].label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-1 rounded-xl bg-ds-primary px-3 py-2 text-xs font-bold text-ds-on-primary hover:bg-ds-primary-hover shrink-0 shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มตัวยา</span>
              </button>
            </div>
          )}

          {/* List of Medications */}
          <div className="space-y-2">
            {filteredMeds.length === 0 ? (
              <div className="p-8 text-center text-xs text-ds-text-tertiary">
                {searchQuery ? "ไม่พบตัวยาที่ค้นหา" : "ยังไม่มีรายการยาในระบบ แตะปุ่ม + เพิ่มตัวยา เพื่อเริ่มต้น"}
              </div>
            ) : (
              filteredMeds.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between rounded-xl border border-ds-border bg-ds-surface p-3 hover:border-ds-text-tertiary/60 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ds-surface-elevated text-ds-icon-secondary border border-ds-divider">
                      <Pill className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-ds-text truncate">
                          {med.name}
                        </span>
                        {med.size && (
                          <span className="rounded-md bg-ds-surface-variant px-1.5 py-0.5 text-[10px] font-semibold text-ds-text-secondary">
                            {med.size} {med.unit || ""}
                          </span>
                        )}
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${MEDICATION_CATEGORY_CONFIG[resolveMedicationCategory(med.name, med.category)].badge}`}>
                          {MEDICATION_CATEGORY_CONFIG[resolveMedicationCategory(med.name, med.category)].label}
                        </span>
                      </div>
                      <div className="text-[11px] text-ds-text-secondary">
                        {med.price ? `฿${Number(med.price).toLocaleString()}` : "ไม่ระบุราคา"} {med.unit && !med.size ? `/ ${med.unit}` : ""}
                        {(med.description || med.note) && (
                          <span className="text-ds-text-tertiary"> • {med.description || med.note}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {onSelectMedication && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectMedication(med.name);
                          onClose();
                        }}
                        className="rounded-lg bg-ds-primary-container px-2.5 py-1 text-[11px] font-bold text-ds-primary hover:opacity-90 cursor-pointer"
                      >
                        เลือก
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(med)}
                      className="rounded-lg p-1.5 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
                      title="แก้ไข"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(med.id, med.name)}
                      className="rounded-lg p-1.5 text-ds-icon-secondary hover:bg-ds-error-container hover:text-ds-error cursor-pointer"
                      title="ลบ"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
