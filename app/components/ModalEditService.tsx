"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Syringe,
  Check,
  AlertCircle,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  CustomerServiceRecord,
  Medications,
} from "../../types/vendee";
import { saveService, getMedications, syncMedicationsFromApi } from "../../lib/storage";
import ModalMedicationManager from "./ModalMedicationManager";
import MedicationUsageEditor, {
  MedicationUsageRow,
  buildUsageLines,
  usageRowsFromLines,
} from "./MedicationUsageEditor";

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
  const [usageRows, setUsageRows] = useState<MedicationUsageRow[]>([]);
  const [serviceNote, setServiceNote] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [masterMeds, setMasterMeds] = useState<Medications[]>([]);
  const [openMedManagerModal, setOpenMedManagerModal] = useState(false);


  useEffect(() => {
    if (service && isOpen) {
      setMasterMeds(getMedications());
      syncMedicationsFromApi()
        .then((res) => {
          if (res.isOnline && res.medications) {
            setMasterMeds(res.medications);
          }
        })
        .catch(() => {});
      setServiceDate(service.date || "");
      setServiceTime((service.time || "09:00").slice(0, 5));
      setUsageRows(usageRowsFromLines(service.medicationUsages));
      setServiceNote(service.note || "");
      setServicePrice(service.price ? String(service.price) : "");
      setErrorMsg("");
    }
  }, [service, isOpen]);

  if (!isOpen || !service) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!serviceDate || !serviceTime) {
      setErrorMsg("กรุณาระบุวันที่และเวลานัดหมาย");
      return;
    }

    const usageLines = buildUsageLines(usageRows, masterMeds);
    const usageNames = usageLines.map((l) => l.name);

    setIsSubmitting(true);
    try {
      const updated = await saveService({
        id: service.id,
        customerId: service.customerId,
        customerName: service.customerName,
        date: serviceDate,
        time: serviceTime,
        services: service.services,
        otherServiceText: service.otherServiceText,
        medications:
          usageNames.length > 0
            ? usageNames
            : service.medicationUsages && service.medicationUsages.length > 0
              ? undefined
              : service.medications && service.medications.length > 0
                ? service.medications
                : undefined,
        medicationUsages: usageLines,
        note: serviceNote.trim() || undefined,
        price: servicePrice ? Number(servicePrice) : undefined,
        createdAt: service.createdAt,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูลบริการ");
    } finally {
      setIsSubmitting(false);
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
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex flex-col">
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200 mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>วันที่</span>
              </label>
              <input
                type="date"
                required
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full h-11 min-h-[44px] rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white appearance-none box-border flex items-center"
              />
            </div>
            <div className="flex flex-col">
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>เวลา</span>
              </label>
              <input
                type="time"
                required
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                className="w-full h-11 min-h-[44px] rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white appearance-none box-border flex items-center"
              />
            </div>
          </div>

          {/* Medication usage (quantity + auto cost) */}
          <MedicationUsageEditor
            rows={usageRows}
            onChange={setUsageRows}
            masterMeds={masterMeds}
            onOpenManager={() => setOpenMedManagerModal(true)}
            legacyNames={service.medications}
          />

          {/* Service Note */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>บริการ / รายละเอียด</span>
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
              disabled={isSubmitting}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all ${
                isSubmitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>{isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไขนัดหมาย"}</span>
            </button>
          </div>
        </form>
      </div>

      <ModalMedicationManager
        isOpen={openMedManagerModal}
        onSelectMedication={(newMedName) => {
          setOpenMedManagerModal(false);
          const updatedMaster = getMedications();
          setMasterMeds(updatedMaster);
          const found = updatedMaster.find((m) => m.name === newMedName);
          if (found) {
            setUsageRows((prev) => {
              const emptyIdx = prev.findIndex((r) => !r.medicationId);
              if (emptyIdx >= 0) {
                const copy = [...prev];
                copy[emptyIdx] = { medicationId: found.id, quantity: copy[emptyIdx].quantity };
                return copy;
              }
              return [...prev, { medicationId: found.id, quantity: "" }];
            });
          }
        }}
        onClose={() => {
          setOpenMedManagerModal(false);
          setMasterMeds(getMedications());
        }}
      />
    </div>
  );
}
