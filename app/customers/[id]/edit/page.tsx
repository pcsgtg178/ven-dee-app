"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { User, Tag, MapPin, Check, AlertCircle } from "lucide-react";
import AppBar from "../../../components/AppBar";
import BottomNav from "../../../components/BottomNav";
import { Customer } from "../../../../types/vendee";
import { getCustomerById, saveCustomer } from "../../../../lib/storage";
import { customersApi } from "../../../../lib/api";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;

  const [customer, setCustomer] = useState<Customer | undefined>(undefined);
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (customerId) {
      const cust = getCustomerById(customerId);
      if (cust) {
        setCustomer(cust);
        setName(cust.name || "");
      }
    }
  }, [customerId]);

  if (!customer) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
        <AppBar title="แก้ไขข้อมูลลูกค้า" showBack backHref="/customers" />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-12 w-12 text-slate-400 mb-3" />
          <h2 className="text-base font-bold">ไม่พบข้อมูลลูกค้า</h2>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("กรุณากรอกชื่อ-นามสกุลลูกค้า");
      return;
    }

    try {
      const payload = {
        name: name.trim(),
      };

      // Live API customer update
      try {
        await customersApi.update(customer.id, payload);
      } catch (apiErr) {
        console.warn("API update warning, persisting locally:", apiErr);
      }

      saveCustomer({
        id: customer.id,
        ...payload,
        avatarColor: customer.avatarColor,
        createdAt: customer.createdAt,
      });

      router.push(`/customers/${customer.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 pb-20">
      <AppBar
        title="แก้ไขข้อมูลลูกค้า"
        showBack
        backHref={`/customers/${customer.id}`}
      />

      <main className="mx-auto w-full max-w-lg flex-1 p-4 space-y-4">
        {/* Customer Header Preview */}
        <div className="flex items-center gap-3 rounded-2xl border border-surface-subtle bg-card-bg p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white shadow-xs ${
              customer.avatarColor || "bg-primary"
            }`}
          >
            {customer.name.substring(0, 2)}
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-main dark:text-white">
              {customer.name}
            </h2>
            <p className="text-xs text-text-muted dark:text-zinc-400">
              รหัสลูกค้า: {customer.id}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-3xl border border-surface-subtle bg-card-bg p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>ชื่อ-นามสกุลลูกค้า <strong className="text-rose-500">*</strong></span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ระบุชื่อจริง นามสกุล หรือชื่อเรียก"
                className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2.5 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-surface-subtle dark:border-zinc-800">
              <button
                type="button"
                onClick={() => router.push(`/customers/${customer.id}`)}
                className="flex-1 rounded-xl border border-surface-subtle bg-surface-subtle py-2.5 text-xs font-bold text-text-main hover:bg-slate-200 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
              >
                <Check className="h-4 w-4" />
                <span>บันทึกการแก้ไข</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
