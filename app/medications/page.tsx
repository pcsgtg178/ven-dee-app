"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Pill,
  Search,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Package,
  X,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { Medications } from "../../types/vendee";
import {
  getMedications,
  saveMedication,
  deleteMedication,
  subscribeToStorage,
} from "../../lib/storage";

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medications[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medications | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("เข็ม");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setMedications(getMedications());
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToStorage(loadData);
    return () => unsub();
  }, [loadData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingMed(null);
    setName("");
    setPrice("");
    setUnit("เข็ม");
    setNote("");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (med: Medications) => {
    setEditingMed(med);
    setName(med.name);
    setPrice(med.price || "");
    setUnit(med.unit || "เข็ม");
    setNote(med.note || "");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("กรุณาระบุชื่อตัวยา");
      return;
    }

    try {
      saveMedication({
        id: editingMed ? editingMed.id : undefined,
        name: name.trim(),
        price: price.trim() || undefined,
        unit: unit.trim() || undefined,
        note: note.trim() || undefined,
      });

      setIsModalOpen(false);
      loadData();
      showToast(editingMed ? `อัปเดตตัวยา "${name.trim()}" เรียบร้อยแล้ว` : `เพิ่มตัวยา "${name.trim()}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวยา");
    }
  };

  const handleDelete = (med: Medications) => {
    if (confirm(`คุณต้องการลบตัวยา "${med.name}" ออกจากคลังใช่หรือไม่?`)) {
      deleteMedication(med.id);
      loadData();
      showToast(`ลบตัวยา "${med.name}" เรียบร้อยแล้ว`);
    }
  };

  // Filtered medications by search
  const filteredMeds = useMemo(() => {
    if (!searchQuery.trim()) return medications;
    const q = searchQuery.toLowerCase().trim();
    return medications.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.unit && m.unit.toLowerCase().includes(q))
    );
  }, [medications, searchQuery]);

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-text-main dark:text-white flex items-center gap-1.5">
              <span>รายการตัวยา</span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                {medications.length} รายการ
              </span>
            </h1>
            <p className="text-xs text-text-muted dark:text-zinc-400">
              กำหนดต้นทุนและหน่วยนับสำหรับใช้ในเคสบริการ
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มตัวยา</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted dark:text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อตัวยา หรือหน่วยนับ..."
            className="w-full rounded-2xl border border-surface-subtle bg-white pl-10 pr-4 py-2.5 text-sm text-text-main placeholder:text-text-muted shadow-2xs focus:border-purple-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
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
              const numericCost = Number(med.price || 0);

              return (
                <div
                  key={med.id}
                  className="group relative flex items-center justify-between gap-3 rounded-2xl border border-purple-100 bg-white p-3.5 shadow-2xs transition-all hover:border-purple-300 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {/* Left Pill Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300">
                      <Pill className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-main dark:text-white truncate">
                          {med.name}
                        </span>
                        {med.unit && (
                          <span className="shrink-0 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                            {med.unit}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <span>ต้นทุน:</span>
                          <span className="font-bold">
                            {numericCost > 0 ? `฿${numericCost.toLocaleString()}` : "ไม่ระบุ"}
                          </span>
                          {med.unit && <span className="text-[10px] text-text-muted">/{med.unit}</span>}
                        </span>

                        {med.note && (
                          <span className="truncate max-w-[150px] text-[11px] text-text-muted dark:text-zinc-400">
                            · {med.note}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(med)}
                      className="rounded-lg p-2 text-text-muted hover:bg-purple-50 hover:text-purple-600 active:scale-95 transition-all dark:hover:bg-purple-950/40 dark:hover:text-purple-300 cursor-pointer"
                      title="แก้ไขข้อมูลตัวยา"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(med)}
                      className="rounded-lg p-2 text-text-muted hover:bg-rose-50 hover:text-shift-red active:scale-95 transition-all dark:hover:bg-rose-950/40 cursor-pointer"
                      title="ลบตัวยานี้"
                    >
                      <Trash2 className="h-4 w-4" />
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
                  placeholder="เช่น Vitamin B12, Collagen IV Drip"
                  className="w-full rounded-xl border border-surface-subtle bg-slate-50 px-3.5 py-2.5 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-900"
                />
              </div>

              {/* Price & Unit Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                    ราคาต้นทุน (บาท)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                      ฿
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="เช่น 200"
                      className="w-full rounded-xl border border-surface-subtle bg-slate-50 pl-7 pr-3 py-2.5 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-900 font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                    หน่วยนับ
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="เช่น เข็ม, ขวด, ชุด"
                    className="w-full rounded-xl border border-surface-subtle bg-slate-50 px-3.5 py-2.5 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-900"
                  />
                </div>
              </div>

              {/* Preset Unit Suggestions */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-text-muted">หน่วยที่พบบ่อย:</span>
                {["เข็ม", "ขวด", "ชุด", "แผง", "กระปุก", "cc"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      unit === u
                        ? "bg-purple-600 text-white"
                        : "bg-surface-subtle text-text-muted hover:bg-purple-100 hover:text-purple-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                  หมายเหตุเพิ่มเติม (ถ้ามี)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น เก็บในอุณหภูมิห้อง, ฉีดเข้ากล้ามเนื้อ..."
                  className="w-full rounded-xl border border-surface-subtle bg-slate-50 p-3 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-900"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  {editingMed ? "บันทึกการแก้ไข" : "เพิ่มตัวยา"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
