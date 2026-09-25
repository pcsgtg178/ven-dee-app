"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, Clock, Check, Building2, AlertCircle } from "lucide-react";
import { ClinicWorkRecord, ClinicPresetShift } from "../../types/vendee";
import { saveClinicLog } from "../../lib/storage";

interface ModalEditClinicLogProps {
  clinicLog: ClinicWorkRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: ClinicWorkRecord) => void;
}

const PRESET_SHIFTS: ClinicPresetShift[] = [
  "12:30 - 17:30",
  "17:00 - 19:30",
  "12:30 - 19:30",
];

export default function ModalEditClinicLog({
  clinicLog,
  isOpen,
  onClose,
  onSuccess,
}: ModalEditClinicLogProps) {
  const [date, setDate] = useState("");
  const [presetShift, setPresetShift] = useState<ClinicPresetShift>("12:30 - 17:30");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (clinicLog && isOpen) {
      setDate(clinicLog.date || "");
      setPresetShift(clinicLog.presetShift || "12:30 - 17:30");
      setNote(clinicLog.note || "");
      setErrorMsg("");
    }
  }, [clinicLog, isOpen]);

  if (!isOpen || !clinicLog) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setErrorMsg("กรุณาระบุวันที่เข้าเวรคลินิก");
      return;
    }

    try {
      const updated = saveClinicLog({
        id: clinicLog.id,
        date,
        presetShift,
        note: note.trim() || undefined,
        createdAt: clinicLog.createdAt,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถบันทึกข้อมูลคลินิกได้");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-zinc-900 border border-surface-subtle dark:border-zinc-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle px-5 py-4 dark:border-zinc-800 bg-surface-subtle/30 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                แก้ไขบันทึกงานคลินิก
              </h2>
              <p className="text-xs text-text-muted dark:text-zinc-400">
                ปรับเปลี่ยนวันที่และช่วงเวลาปฏิบัติงาน
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

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
              วันที่ *
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-surface-subtle bg-card-bg pl-9 pr-3 py-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
            </div>
          </div>

          {/* 3 Preset Working Shifts */}
          <div>
            <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-2">
              เลือกช่วงเวลาทำงาน *
            </label>
            <div className="space-y-2">
              {PRESET_SHIFTS.map((preset) => {
                const isSelected = presetShift === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPresetShift(preset)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-xs font-bold transition-all ${
                      isSelected
                        ? "border-purple-500 bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 shadow-xs"
                        : "border-surface-subtle bg-card-bg text-text-main hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className={`h-4 w-4 ${isSelected ? "text-purple-600 dark:text-purple-300" : "text-text-muted"}`} />
                      <span>{preset} น.</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-purple-600 dark:text-purple-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-semibold text-text-muted dark:text-zinc-400 mb-1">
              หมายเหตุ (ถ้ามี)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ระบุหมายเหตุ..."
              className="w-full rounded-xl border border-surface-subtle bg-card-bg p-2.5 text-xs text-text-main dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-subtle dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-text-muted hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
            >
              <Check className="h-4 w-4" />
              <span>บันทึกการแก้ไข</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
