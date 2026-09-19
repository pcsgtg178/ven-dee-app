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
} from "lucide-react";
import {
  CustomerServiceRecord,
  ServiceType,
  SERVICE_CONFIG,
} from "../../types/vendee";
import { saveService } from "../../lib/storage";

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
  const [selectedServices, setSelectedServices] = useState<ServiceType[]>(["injection"]);
  const [otherServiceText, setOtherServiceText] = useState("");
  const [medications, setMedications] = useState<string[]>([""]);
  const [serviceNote, setServiceNote] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (service && isOpen) {
      setServiceDate(service.date || "");
      setServiceTime(service.time || "09:00");
      setSelectedServices(service.services || ["injection"]);
      setOtherServiceText(service.otherServiceText || "");
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

  const toggleService = (srv: ServiceType) => {
    setSelectedServices((prev) => {
      if (prev.includes(srv)) {
        return prev.filter((s) => s !== srv);
      } else {
        return [...prev, srv];
      }
    });
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceDate || !serviceTime) {
      setErrorMsg("กรุณาระบุวันที่และเวลานัดหมาย");
      return;
    }
    if (selectedServices.length === 0) {
      setErrorMsg("กรุณาเลือกบริการอย่างน้อย 1 รายการ");
      return;
    }

    const isInjectionSelected = selectedServices.includes("injection");
    const validMeds = isInjectionSelected
      ? medications.map((m) => m.trim()).filter(Boolean)
      : undefined;

    try {
      const updated = saveService({
        id: service.id,
        customerId: service.customerId,
        customerName: service.customerName,
        customerPhone: service.customerPhone,
        customerNote: service.customerNote,
        date: serviceDate,
        time: serviceTime,
        services: selectedServices,
        otherServiceText: selectedServices.includes("other") ? otherServiceText : undefined,
        medications: validMeds && validMeds.length > 0 ? validMeds : undefined,
        note: serviceNote.trim() || undefined,
        price: servicePrice ? Number(servicePrice) : undefined,
        status: service.status,
        createdAt: service.createdAt,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการแก้ไขนัดหมาย");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-card-bg p-5 sm:p-6 shadow-2xl border border-surface-subtle dark:bg-zinc-900 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary-dark dark:bg-emerald-950/60 dark:text-emerald-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                แก้ไขนัดหมายบริการ
              </h2>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
                รหัสนัดหมาย: {service.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-main dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Customer Badge Banner (Read-only reference) */}
        <div className="flex items-center justify-between rounded-2xl bg-surface-subtle/80 p-3 text-xs dark:bg-zinc-800/80 border border-surface-subtle dark:border-zinc-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary font-bold text-white text-xs">
              {service.customerName.substring(0, 2)}
            </div>
            <div>
              <div className="font-bold text-text-main dark:text-white">
                {service.customerName}
              </div>
              {service.customerNote && (
                <div className="flex items-center gap-1 text-[11px] text-primary dark:text-emerald-400 font-medium">
                  <Tag className="h-3 w-3 shrink-0" />
                  <span>{service.customerNote}</span>
                </div>
              )}
            </div>
          </div>
          {service.customerPhone && service.customerPhone !== "-" && (
            <span className="text-[11px] text-text-muted dark:text-zinc-400">
              {service.customerPhone}
            </span>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>วันที่นัด <strong className="text-rose-500">*</strong></span>
              </label>
              <input
                type="date"
                required
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3 py-2 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>เวลานัด <strong className="text-rose-500">*</strong></span>
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

          {/* Services Selector (Checkboxes) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-main dark:text-zinc-200">
              ประเภทบริการ (เลือกได้มากกว่า 1 ข้อ) <strong className="text-rose-500">*</strong>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => toggleService("injection")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold transition-all ${
                  selectedServices.includes("injection")
                    ? "border-primary bg-primary-light text-primary-dark ring-2 ring-primary/30 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-600"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-primary/40 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
                }`}
              >
                <Syringe className="h-4 w-4 text-primary" />
                <span>ฉีดยา</span>
              </button>

              <button
                type="button"
                onClick={() => toggleService("drip")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold transition-all ${
                  selectedServices.includes("drip")
                    ? "border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-400/30 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-600"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
                }`}
              >
                <Sparkles className="h-4 w-4 text-sky-500" />
                <span>ดริป / ให้สารน้ำ</span>
              </button>

              <button
                type="button"
                onClick={() => toggleService("delivery")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold transition-all ${
                  selectedServices.includes("delivery")
                    ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400/30 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-600"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
                }`}
              >
                <Package className="h-4 w-4 text-purple-500" />
                <span>รับส่งยา</span>
              </button>

              <button
                type="button"
                onClick={() => toggleService("other")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-bold transition-all ${
                  selectedServices.includes("other")
                    ? "border-slate-500 bg-slate-100 text-slate-900 ring-2 ring-slate-400/30 dark:bg-zinc-700 dark:text-white dark:border-zinc-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-slate-300 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-400"
                }`}
              >
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
                <span>อื่นๆ</span>
              </button>
            </div>
          </div>

          {/* If Other Service is selected */}
          {selectedServices.includes("other") && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-text-muted dark:text-zinc-400">
                ระบุรายละเอียดบริการอื่นๆ
              </label>
              <input
                type="text"
                value={otherServiceText}
                onChange={(e) => setOtherServiceText(e.target.value)}
                placeholder="เช่น วัดความดัน, ทำแผลกดทับ"
                className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3 py-2 text-xs text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
              />
            </div>
          )}

          {/* Dynamic Medication List (if injection selected) */}
          {selectedServices.includes("injection") && (
            <div className="space-y-2 rounded-2xl bg-primary-light/30 p-3 dark:bg-emerald-950/30 border border-primary/20">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-primary-dark dark:text-emerald-300">
                  <Syringe className="h-3.5 w-3.5 text-primary" />
                  <span>รายการยาฉีด (ระบุชื่อยาและขนาดยา)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline dark:text-emerald-400"
                >
                  <Plus className="h-3 w-3" />
                  <span>เพิ่มยา</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {medications.map((med, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={med}
                      onChange={(e) => handleMedicationChange(idx, e.target.value)}
                      placeholder={`รายการยาที่ ${idx + 1} เช่น Ceftriaxone 1g, Insulin`}
                      className="flex-1 rounded-xl border border-primary/30 bg-card-bg px-3 py-1.5 text-xs text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:bg-zinc-900 dark:text-white dark:border-emerald-800"
                    />
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
          )}

          {/* Service Note */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span>บันทึกบริการ / อาการลูกค้า (Service Note)</span>
            </label>
            <textarea
              rows={2}
              value={serviceNote}
              onChange={(e) => setServiceNote(e.target.value)}
              placeholder="บันทึกข้อความ เช่น อาการล่าสุด, ตรวจค่าน้ำตาล"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white resize-none"
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span>ค่าบริการ (บาท - ไม่บังคับ)</span>
            </label>
            <input
              type="number"
              value={servicePrice}
              onChange={(e) => setServicePrice(e.target.value)}
              placeholder="เช่น 500"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
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
    </div>
  );
}
