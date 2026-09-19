"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Save } from "lucide-react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { saveCustomer } from "../../../lib/storage";

export default function NewCustomerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("กรุณากรอกชื่อลูกค้า");
      return;
    }

    const created = saveCustomer({
      name: name.trim(),
      phone: phone.trim() || "-",
      note: note.trim() || "ลูกค้าทั่วไป",
      address: address.trim() || undefined,
    });

    router.push(`/customers/${created.id}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 pb-20">
      <AppBar title="เพิ่มลูกค้าใหม่" showBack backHref="/customers" />

      <main className="mx-auto w-full max-w-lg flex-1 p-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-zinc-800 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                ข้อมูลลูกค้าใหม่
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                กรอกข้อมูลสำหรับติดตามการนัดหมายและประวัติบริการ
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                ชื่อ-นามสกุล หรือชื่อเรียก <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น คุณยายสมศรี สุขเกษม, คุณแพรว"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                เบอร์โทรศัพท์ติดต่อ
              </label>
              <input
                type="tel"
                placeholder="เช่น 081-234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Note จำแนกป้องกันความสับสน <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-teal-600 font-medium">สำคัญกรณีชื่อซ้ำ</span>
              </div>
              <input
                type="text"
                required
                placeholder="เช่น ซอยร่วมใจ (คนไข้เบาหวาน), คอนโด Ashton ชั้น 18"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-teal-200 bg-teal-50/30 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-teal-800 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                ที่อยู่ / สถานที่สำหรับไปให้บริการ
              </label>
              <textarea
                rows={3}
                placeholder="ระบุเลขที่บ้าน อาคาร ชั้น ซอย หรือจุดสังเกต..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:from-teal-700 hover:to-emerald-700 active:scale-98 transition-all"
              >
                <Save className="h-4 w-4" />
                <span>บันทึกข้อมูลลูกค้า</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
