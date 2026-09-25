"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Pencil,
  CalendarPlus,
  ChevronRight,
  Users,
  X,
} from "lucide-react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import ModalAddTodo from "../components/ModalAddTodo";
import ModalEditCustomer from "../components/ModalEditCustomer";
import { Customer } from "../../types/vendee";
import { getCustomers, saveCustomer, subscribeToStorage } from "../../lib/storage";
import { customersApi } from "../../lib/api";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [openAddServiceModal, setOpenAddServiceModal] = useState(false);
  const [selectedCustomerIdForService, setSelectedCustomerIdForService] = useState<string | undefined>(undefined);

  const [openNewCustomerModal, setOpenNewCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [openEditCustomerModal, setOpenEditCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustError, setNewCustError] = useState("");

  // Load customers from local storage (fast, no network side-effects)
  const loadLocalData = useCallback(() => {
    setCustomers(getCustomers());
  }, []);

  // Fetch live customers from API (http://localhost:8080/api/v1/customers)
  const syncApiData = useCallback(async () => {
    try {
      setIsSyncing(true);
      const apiCusts = await customersApi.getAll();
      if (apiCusts && Array.isArray(apiCusts) && apiCusts.length > 0) {
        setCustomers(apiCusts);
        localStorage.setItem("vendee_customers_v1", JSON.stringify(apiCusts));
      }
    } catch (err) {
      console.warn("API customer fetch warning:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const reloadData = useCallback(() => {
    loadLocalData();
    syncApiData();
  }, [loadLocalData, syncApiData]);

  useEffect(() => {
    loadLocalData();
    syncApiData();
    const unsubscribe = subscribeToStorage(loadLocalData);
    return () => unsubscribe();
  }, [loadLocalData, syncApiData]);

  // Search filter across Name
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // Open Add Service modal with specific customer preselected
  const handleOpenAddService = (customerId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCustomerIdForService(customerId);
    setOpenAddServiceModal(true);
  };

  // Save new customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setNewCustError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    // Create via API first
    const payload = {
      name: newCustName.trim(),
    };

    try {
      const created = await customersApi.create(payload);
      saveCustomer(created);
    } catch (err) {
      console.warn("API customer create error, saving locally:", err);
      saveCustomer(payload);
    }

    setOpenNewCustomerModal(false);
    setNewCustName("");
    setNewCustError("");
    reloadData();
  };

  return (
    <div className="flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 pb-32">
      {/* Header */}
      <AppBar
        title="รายชื่อลูกค้า"
        showBack={false}
        rightAction={
          <button
            type="button"
            onClick={() => setOpenNewCustomerModal(true)}
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>เพิ่มลูกค้า</span>
          </button>
        }
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-lg flex-1 p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, เบอร์โทร หรือ Note จำแนก..."
            className="w-full rounded-2xl border border-surface-subtle bg-card-bg py-3 pl-11 pr-10 text-sm text-text-main shadow-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary-light dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          />
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-text-muted" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-3.5 text-text-muted hover:text-text-main dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Customer Count Badge */}
        <div className="flex items-center justify-between text-xs text-text-muted dark:text-zinc-400 px-1">
          <span>
            พบทั้งหมด <strong className="text-text-main dark:text-white">{filteredCustomers.length}</strong> ท่าน
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-primary hover:underline font-medium dark:text-emerald-400"
            >
              ล้างการค้นหา
            </button>
          )}
        </div>

        {/* Customer Card List */}
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-surface-subtle bg-card-bg/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted dark:bg-zinc-800 dark:text-zinc-500 mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-text-main dark:text-zinc-300">
              {searchQuery ? "ไม่พบข้อมูลลูกค้าที่ค้นหา" : "ยังไม่มีรายชื่อลูกค้า"}
            </h3>
            <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 max-w-xs">
              {searchQuery
                ? "ลองตรวจสอบคำค้นหา หรือกดปุ่มเพิ่มลูกค้าใหม่"
                : "เพิ่มรายชื่อลูกค้าเพื่อบันทึกประวัติการดูแลและนัดหมายบริการ"}
            </p>
            <button
              type="button"
              onClick={() => setOpenNewCustomerModal(true)}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-105"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>เพิ่มลูกค้าใหม่</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="group relative overflow-hidden rounded-2xl border border-surface-subtle bg-card-bg p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* Clickable entire card to /customers/[id] */}
                <Link
                  href={`/customers/${cust.id}`}
                  className="block space-y-2.5"
                >
                  {/* Top Row: Avatar + Name + Note Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      {/* Avatar with Initials */}
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-xs ${
                          cust.avatarColor || "bg-primary"
                        }`}
                      >
                        {cust.name.substring(0, 2)}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-primary dark:group-hover:text-primary-light transition-colors shrink-0" />
                  </div>
                </Link>

                {/* Bottom Action Bar */}
                <div className="mt-3 flex items-center justify-between border-t border-surface-subtle pt-2.5 dark:border-zinc-800">
                  {/* Actions: ปุ่มแก้ไขลูกค้า + ปุ่มเพิ่มนัดหมาย */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingCustomer(cust);
                        setOpenEditCustomerModal(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-text-main hover:bg-slate-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-200 transition-all border border-surface-subtle dark:border-zinc-700"
                      title="แก้ไขข้อมูลลูกค้า"
                    >
                      <Pencil className="h-3.5 w-3.5 text-secondary" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleOpenAddService(cust.id, e)}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary-light px-3 py-1.5 text-xs font-bold text-primary-dark hover:bg-emerald-100 active:scale-95 dark:bg-primary-dark/40 dark:text-primary-light transition-all shadow-2xs border border-primary/20"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      <span>+ นัดหมายบริการ</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Bottom Navigation Spacer */}
        <div className="h-20 sm:h-24 pb-safe pointer-events-none" aria-hidden="true" />
      </main>

      {/* Modal Edit Customer */}
      <ModalEditCustomer
        customer={editingCustomer}
        isOpen={openEditCustomerModal}
        onClose={() => {
          setOpenEditCustomerModal(false);
          setEditingCustomer(null);
        }}
        onSuccess={() => {
          reloadData();
        }}
      />

      {/* Modal Add Todo (Customer Service with preselected ID) */}
      <ModalAddTodo
        openModal={openAddServiceModal}
        toggleModal={() => setOpenAddServiceModal(false)}
        initialTab="service"
        initialCustomerId={selectedCustomerIdForService}
        onSuccess={() => {
          reloadData();
        }}
      />

      {/* Modal Add New Customer */}
      {openNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setOpenNewCustomerModal(false)}
          />
          <div className="relative z-50 w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-teal-600" />
                <span>เพิ่มลูกค้าใหม่</span>
              </h2>
              <button
                type="button"
                onClick={() => setOpenNewCustomerModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {newCustError && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
                {newCustError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  ชื่อ-นามสกุล หรือชื่อเรียก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น คุณยายสมศรี สุขเกษม"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpenNewCustomerModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-400"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:from-teal-700 hover:to-emerald-700"
                >
                  บันทึกข้อมูลลูกค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <BottomNav
        onOpenAdd={() => {
          setSelectedCustomerIdForService(undefined);
          setOpenAddServiceModal(true);
        }}
      />
    </div>
  );
}
