"use client";

import React, { useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import ModalMedicationManager from "../components/ModalMedicationManager";

export default function MedicationsPage() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="min-h-screen bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 pb-20">
      <AppBar title="จัดการรายการยา" showBack backHref="/" />
      
      <main className="mx-auto max-w-lg p-4 space-y-4">
        <div className="rounded-2xl border border-surface-subtle bg-card-bg p-5 dark:border-zinc-800 dark:bg-zinc-900 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light text-2xl">
            💊
          </div>
          <h2 className="text-lg font-bold text-text-main dark:text-white">
            Medication Master Records
          </h2>
          <p className="text-xs text-text-muted dark:text-zinc-400">
            ระบบจัดการคลังยาเพื่อการนัดหมายและฉีดยา
          </p>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-105"
          >
            เปิดหน้าต่างจัดการยา
          </button>
        </div>

        <ModalMedicationManager isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </main>

      <BottomNav />
    </div>
  );
}
