"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Plus,
  Trash2,
  Syringe,
  Sparkles,
  Package,
  MoreHorizontal,
  Check,
  AlertCircle,
  FileText,
  DollarSign,
  Tag,
  Pill,
} from "lucide-react";
import {
  CustomerServiceRecord,
  Medications,
} from "../../types/vendee";
import { saveService, getMedications } from "../../lib/storage";
import ModalMedicationManager from "./ModalMedicationManager";

interface ModalEditServiceProps {
  service: CustomerServiceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: CustomerServiceRecord) => void;
}

export default function ModalEditService({
  service,
  isOpen,
  onClose,
  onSuccess,
}: ModalEditServiceProps) {
  const [serviceDate, setServiceDate] = useState("");
  const [serviceTime, setServiceTime] = useState("09:00");
  const [medications, setMedications] = useState<string[]>([""]);
  const [serviceNote, setServiceNote] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [masterMeds, setMasterMeds] = useState<Medications[]>([]);
  const [openMedManagerModal, setOpenMedManagerModal] = useState(false);

  useEffect(() => {
    if (service && isOpen) {
      setMasterMeds(getMedications());
      setServiceDate(service.date || "");
      setServiceTime(service.time || "09:00");
      setMedications(
        service.medications && service.medications.length > 0
          ? [...service.medications]
          : [""]
      );
      setServiceNote(service.note || "");
      setServicePrice(service.price ? String(service.price) : "");
      setErrorMsg("");
    }
  }, [service, isOpen]);

  if (!isOpen || !service) return null;

  const handleAddMedication = () => {
    setMedications((prev) => [...prev, ""]);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (index: number, val: string) => {
    setMedications((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceDate || !serviceTime) {
      setErrorMsg("กรุณาระบุวันที่และเวลานัดหมาย");
      return;
    }

    const validMeds = medications.map((m) => m.trim()).filter(Boolean);

    try {
      const updated = await saveService({
        id: service.id,
        customerId: service.customerId,
        customerName: service.customerName,
        date: serviceDate,
        time: serviceTime,
        medications: validMeds && validMeds.length > 0 ? validMeds : undefined,
        note: serviceNote.trim() || undefined,
        price: servicePrice ? Number(servicePrice) : undefined,
        createdAt: service.createdAt,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลบริการ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 border border-surface-subtle dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle px-5 py-4 dark:border-zinc-800 bg-surface-subtle/30 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Syringe className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                แก้ไขนัดหมายบริการ
              </h2>
              <p className="text-xs text-text-muted dark:text-zinc-400">
                ลูกค้า: <strong className="text-primary-dark dark:text-primary-light">{service.customerName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-text-muted hover:bg-slate-200 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200 mb-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>วันที่</span>
              </label>
              <input
                type="date"
                required
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3 py-2 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200 mb-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>เวลา</span>
              </label>
              <input
                type="time"
                required
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3 py-2 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
              />
            </div>
          </div>

          {/* Dynamic Medication List */}
          <div className="space-y-2 rounded-2xl bg-primary-light/30 p-3.5 dark:bg-emerald-950/30 border border-primary/20">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-primary-dark dark:text-emerald-300">
                <Syringe className="h-3.5 w-3.5 text-primary" />
                <span>รายการยาที่ใช้ (Drug Selector)</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenMedManagerModal(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  <Pill className="h-3 w-3" />
                  <span>จัดการยา</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline dark:text-emerald-400"
                >
                  <Plus className="h-3 w-3" />
                  <span>เพิ่มยา</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {medications.map((med, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 w-4 text-right">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 flex gap-1.5">
                    {masterMeds.length > 0 && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleMedicationChange(idx, e.target.value);
                        }}
                        defaultValue=""
                        className="rounded-xl border border-primary/30 bg-white px-2 py-1 text-xs text-text-main dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="" disabled>-- เลือกจากคลัง --</option>
                        {masterMeds.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name} {m.price ? `(฿${m.price})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={med}
                      onChange={(e) => handleMedicationChange(idx, e.target.value)}
                      placeholder="ชื่อยา / ขนาดยา"
                      className="flex-1 rounded-xl border border-primary/30 bg-card-bg px-3 py-1.5 text-xs text-text-main outline-none focus:border-primary dark:bg-zinc-900 dark:text-white dark:border-emerald-800"
                    />
                  </div>
                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(idx)}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Service Note */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>บันทึกบริการ / รายละเอียด</span>
            </label>
            <input
              type="text"
              value={serviceNote}
              onChange={(e) => setServiceNote(e.target.value)}
              placeholder="ระบุรายละเอียดเพิ่มเติม"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3 py-2 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span>ค่าบริการ (บาท)</span>
            </label>
            <input
              type="number"
              value={servicePrice}
              onChange={(e) => setServicePrice(e.target.value)}
              placeholder="เช่น 500"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3 py-2 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-subtle dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-subtle bg-surface-subtle py-2.5 text-xs font-bold text-text-main hover:bg-slate-200 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>บันทึกการแก้ไขนัดหมาย</span>
            </button>
          </div>
        </form>
      </div>

      <ModalMedicationManager
        isOpen={openMedManagerModal}
        onClose={() => {
          setOpenMedManagerModal(false);
          setMasterMeds(getMedications());
        }}
      />
    </div>
  );
}
