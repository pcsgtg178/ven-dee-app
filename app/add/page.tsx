"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ModalAddTodo from "../components/ModalAddTodo";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

export default function AddPage() {
  const router = useRouter();
  const [openModal, setOpenModal] = useState(true);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppBar title="บันทึกงานใหม่" showBack backHref="/" />
      <ModalAddTodo
        openModal={openModal}
        toggleModal={() => {
          setOpenModal(false);
          router.push("/");
        }}
        onSuccess={() => {
          router.push("/");
        }}
      />
      <BottomNav />
    </div>
  );
}
