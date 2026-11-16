"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Syringe,
  Check,
  AlertCircle,
  AlertTriangle,
  FileText,
  DollarSign,
} from "lucide-react";
import {
  CustomerServiceRecord,
  Medications,
} from "../../types/vendee";
import {
  saveService,
  getMedications,
  syncMedicationsFromApi,
  getEarliestServiceGracePeriodDate,
  isDateInPast,
} from "../../lib/storage";
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
  const [serviceDiscount, setServiceDiscount] = useState("");
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
      const initialDiscount =
        service.discount !== undefined && service.discount !== null
          ? service.discount
          : service.discountSatang !== undefined && service.discountSatang !== null
            ? service.discountSatang / 100
            : 0;
      setServiceDiscount(initialDiscount ? String(initialDiscount) : "");
      setErrorMsg("");
    }
  }, [service, isOpen]);

  if (!isOpen || !service) return null;

  const isRetroactiveEdit = isDateInPast(service.date) || isDateInPast(serviceDate);
  const minServiceDate = getEarliestServiceGracePeriodDate();

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
        medicationCostSatang:
          usageLines.length === 0 && !(service.medicationUsages && service.medicationUsages.length > 0)
            ? service.medicationCostSatang
            : undefined,
        note: serviceNote.trim() || undefined,
        price: servicePrice ? Number(servicePrice) : undefined,
        discount: serviceDiscount ? Number(serviceDiscount) : 0,
        status: service.status,
        durationHours: service.durationHours,
        travelExpenseSatang: service.travelExpenseSatang,
        otherExpensesSatang: service.otherExpensesSatang,
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-service-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs"
    >
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-ds-surface-elevated shadow-ds-popover border border-ds-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-divider px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ds-surface-variant text-ds-icon-primary">
              <Syringe className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-service-title" className="text-base font-bold text-ds-text">
                {service.status === "completed" || isRetroactiveEdit
                  ? "แก้ไขข้อมูลบริการ"
                  : "แก้ไขนัดหมายบริการ"}
              </h2>
              <p className="text-xs text-ds-text-secondary">
                ลูกค้า: <strong className="text-ds-text">{service.customerName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-full p-2 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto overscroll-contain p-5 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-ds-error-container p-3 text-xs font-semibold text-ds-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Retroactive Warning Alert Banner */}
          {isRetroactiveEdit && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-ds-warning-container p-3 text-xs font-medium text-ds-warning">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                คุณกำลังแก้ไขข้อมูลบริการย้อนหลัง โปรดตรวจสอบวันที่ รายการยา และค่าบริการให้ถูกต้อง
              </span>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="flex flex-col">
              <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-ds-icon-secondary" />
                <span>วันที่</span>
              </label>
              <input
                type="date"
                required
                min={minServiceDate}
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full h-11 min-h-[44px] rounded-xl border border-ds-border bg-ds-surface px-3.5 text-xs text-ds-text outline-none focus:border-ds-primary appearance-none box-border flex items-center"
              />
            </div>
            <div className="flex flex-col">
              <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text mb-1.5">
                <Clock className="h-3.5 w-3.5 text-ds-icon-secondary" />
                <span>เวลา</span>
              </label>
              <input
                type="time"
                required
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                className="w-full h-11 min-h-[44px] rounded-xl border border-ds-border bg-ds-surface px-3.5 text-xs text-ds-text outline-none focus:border-ds-primary appearance-none box-border flex items-center"
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
            <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text">
              <FileText className="h-3.5 w-3.5 text-ds-icon-secondary" />
              <span>บริการ / รายละเอียด</span>
            </label>
            <input
              type="text"
              value={serviceNote}
              onChange={(e) => setServiceNote(e.target.value)}
              placeholder="ระบุรายละเอียดเพิ่มเติม"
              className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
            />
          </div>

          {/* Price & Discount */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text">
                <DollarSign className="h-3.5 w-3.5 text-ds-icon-secondary" />
                <span>ค่าบริการ (บาท)</span>
              </label>
              <input
                type="number"
                min="0"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
                placeholder="เช่น 1000"
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-ds-text">
                <DollarSign className="h-3.5 w-3.5 text-ds-icon-secondary" />
                <span>ส่วนลด (บาท)</span>
              </label>
              <input
                type="number"
                min="0"
                value={serviceDiscount}
                onChange={(e) => setServiceDiscount(e.target.value)}
                placeholder="เช่น 100"
                className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
              />
            </div>
          </div>

          {/* Net Revenue Preview */}
          {(Boolean(servicePrice) || Boolean(serviceDiscount)) && (() => {
            const gross = Math.max(0, Number(servicePrice) || 0);
            const disc = Math.max(0, Number(serviceDiscount) || 0);
            const net = Math.max(0, gross - disc);
            return (
              <div className="rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs font-semibold text-ds-text">
                ยอดสุทธิ: <strong className="font-extrabold text-sm text-ds-success">฿{net.toLocaleString()}</strong>
                {disc > 0 && (
                  <span className="text-[11px] text-ds-text-secondary ml-1.5 font-normal">
                    (จากราคา ฿{gross.toLocaleString()} ส่วนลด ฿{disc.toLocaleString()})
                  </span>
                )}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-ds-divider">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-ds-border bg-ds-surface py-2.5 text-xs font-bold text-ds-text hover:bg-ds-surface-variant active:scale-95 transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-ds-primary py-2.5 text-xs font-bold text-ds-on-primary shadow-xs hover:bg-ds-primary-hover active:scale-95 transition-all cursor-pointer ${
                isSubmitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>
                {isSubmitting
                  ? "กำลังบันทึก..."
                  : service.status === "completed" || isRetroactiveEdit
                    ? "บันทึกการแก้ไข"
                    : "บันทึกการแก้ไขนัดหมาย"}
              </span>
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
