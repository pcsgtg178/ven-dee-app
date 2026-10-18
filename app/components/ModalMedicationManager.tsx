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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 border border-surface-subtle dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle px-5 py-4 dark:border-zinc-800 bg-surface-subtle/30 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-main dark:text-white">
                  จัดการรายการยา (Medication Master)
                </h2>
                {isSyncing && (
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-purple-600" />
                )}
              </div>
              <p className="text-xs text-text-muted dark:text-zinc-400">
                เพิ่ม/แก้ไข รายการยาสำหรับใช้ในระบบบริการ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isSyncing}
              className="rounded-full p-2 text-text-muted hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
              title="ดึงข้อมูลจาก API / ฐานข้อมูล"
            >
              <RotateCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-purple-600" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-text-muted hover:bg-slate-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {showForm ? (
            /* Add / Edit Form */
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-primary/30 bg-primary-light/20 p-4 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-main dark:text-white">
                  {editingMedId ? "แก้ไขรายการยา" : "เพิ่มตัวยาใหม่"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-text-muted hover:text-text-main"
                >
                  ยกเลิก
                </button>
              </div>

              {errorMsg && (
                <div className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
                  ชื่อยา / รายการ *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น Botox, Vitamin B12, Paracetamol"
                  className="w-full rounded-xl border border-surface-subtle bg-white p-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
                    ขนาด
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="เช่น 100, 50"
                    className="w-full rounded-xl border border-surface-subtle bg-white p-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
                    หน่วย
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="เช่น ยูนิต"
                      className="w-full rounded-xl border border-surface-subtle bg-white p-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
                    ราคา (บาท)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="เช่น 2500"
                      className="w-full rounded-xl border border-surface-subtle bg-white pl-6 pr-2 py-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary"
                    />
                    <DollarSign className="absolute left-2 top-3 h-3 w-3 text-text-muted" />
                  </div>
                </div>
              </div>

              {/* Unit preset buttons */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-text-muted">หน่วยแนะนำ:</span>
                {["ยูนิต", "เข็ม", "ขวด", "ชุด", "แผง", "cc"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
                      unit === u
                        ? "bg-primary text-white"
                        : "bg-surface-subtle/60 text-text-muted hover:bg-surface-subtle dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
                  หมวดหมู่
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MEDICATION_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
                        category === c
                          ? "bg-primary text-white"
                          : "bg-surface-subtle/60 text-text-muted hover:bg-surface-subtle dark:bg-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {MEDICATION_CATEGORY_CONFIG[c].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
                  รายละเอียด / ข้อกำหนด
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น นาบูตะ *นำเข้า, ผสม NSS 100ml"
                  className="w-full rounded-xl border border-surface-subtle bg-white p-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowForm(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-text-muted hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-105 shadow-xs disabled:opacity-60 cursor-pointer"
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
                  className="w-full rounded-xl border border-surface-subtle bg-card-bg pl-8 pr-3 py-2 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as "all" | MedicationCategory)}
                className="shrink-0 rounded-xl border border-surface-subtle bg-card-bg px-2 py-2 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
                className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:brightness-105 shrink-0 shadow-xs"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มตัวยา</span>
              </button>
            </div>
          )}

          {/* List of Medications */}
          <div className="space-y-2">
            {filteredMeds.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted dark:text-zinc-500">
                {searchQuery ? "ไม่พบตัวยาที่ค้นหา" : "ยังไม่มีรายการยาในระบบ แตะปุ่ม + เพิ่มตัวยา เพื่อเริ่มต้น"}
              </div>
            ) : (
              filteredMeds.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between rounded-xl border border-surface-subtle bg-card-bg p-3 dark:border-zinc-800 dark:bg-zinc-900/80 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold dark:bg-emerald-950/60 dark:text-emerald-300">
                      💊
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-text-main dark:text-white truncate">
                          {med.name}
                        </span>
                        {med.size && (
                          <span className="rounded-md bg-secondary/15 px-1.5 py-0.2 text-[10px] font-semibold text-secondary dark:bg-secondary/25">
                            {med.size} {med.unit || ""}
                          </span>
                        )}
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${MEDICATION_CATEGORY_CONFIG[resolveMedicationCategory(med.name, med.category)].badge}`}>
                          {MEDICATION_CATEGORY_CONFIG[resolveMedicationCategory(med.name, med.category)].label}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted dark:text-zinc-400">
                        {med.price ? `฿${Number(med.price).toLocaleString()}` : "ไม่ระบุราคา"} {med.unit && !med.size ? `/ ${med.unit}` : ""}
                        {(med.description || med.note) && (
                          <span className="text-text-muted/80 dark:text-zinc-500"> • {med.description || med.note}</span>
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
                        className="rounded-lg bg-primary-light px-2.5 py-1 text-[11px] font-bold text-primary-dark hover:bg-emerald-200 dark:bg-primary-dark/30 dark:text-primary-light"
                      >
                        เลือก
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(med)}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-sky-50 hover:text-secondary dark:hover:bg-zinc-800"
                      title="แก้ไข"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(med.id, med.name)}
                      className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-zinc-800"
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
