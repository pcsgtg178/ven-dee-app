# Nurse Domain Invariants & Business Logic Specifications

## 1. Shift Definitions, Quotas & Personal Events

### Shift Types & Time Periods
- **Night (`night` / Code: "1")**: 00:00 - 08:00 (8 hrs) — Color: Indigo (`#6366f1`)
- **Morning (`morning` / Code: "2")**: 08:00 - 16:00 (8 hrs) — Color: Amber (`#f59e0b`)
- **Afternoon (`afternoon` / Code: "3")**: 16:00 - 00:00 (8 hrs) — Color: Sky (`#0284c7`)
- **Refer Team 1 (`r1` / Code: "R1")**: Standby 24 hrs — Color: Emerald (`#198f13`)
- **Refer Team 2 (`r2` / Code: "R2")**: Standby 24 hrs — Color: Emerald (`#198f13`)
- **Off (`off` / Code: "0")**: Day Off / Holiday — Color: Gray (`#6b7280`)
- **CT Morning (`ctm` / Code: "CTM")**: CT Scan Morning Slot — Color: Purple (`#8b5cf6`)
- **CT Afternoon (`cta` / Code: "CTA")**: CT Scan Afternoon Slot — Color: Purple (`#8b5cf6`)

### Shift Categories & Quotas
- **Black Shift (`black` - เวรดำ)**: Standard Monthly Requirement shifts (Default Quota: 14 shifts / month).
  - Used to fulfill hospital mandatory monthly quota.
  - Swapping out black shifts that reduce monthly total below quota triggers `QUOTA_DEFICIT_WARNING`.
- **Red Shift (`red` - เวรแดง)**: Overtime (OT) / Extra shifts.
  - Applies when total validated shifts exceed required quota or for extra OT duties.
  - Swappable without affecting mandatory black quota balance.
- **Green Shift (`green` - เวร R)**: Emergency Refer Standby shifts (`r1`, `r2`).
- **Gray Shift (`gray` - เวรออฟ)**: Off / Leave days.
- **Purple Shift (`purple` - เวร CT)**: Special CT Scan duties / Vacation.

### Personal Events (ธุระส่วนตัว & กิจกรรมส่วนตัว)
- **Personal Event (`personal_event` - ธุระส่วนตัว)**: Event calendar entries for personal errands, social activities, and personal obligations (e.g., ไปงานแต่งงาน, งานวันเกิด, นัดทานข้าว, ธุระครอบครัว) — Color: Rose / Pink (`#f43f5e`).
- **Data Fields (ข้อมูลที่ระบุ)**:
  - `title` / `activityName`: ชื่อกิจกรรม/ไปทำอะไร (e.g., "งานแต่งงานพี่บอย", "งานวันเกิดเพื่อน", "พาญาติไปหาหมอ") [Required]
  - `eventDate`: วันที่จัดกิจกรรม [Required]
  - `startTime` & `endTime`: ช่วงเวลาปฏิบัติกิจกรรม (ระบุเวลา เช่น `18:00` - `21:00`) หรือตั้งค่า `isAllDay: true` (ไปทั้งวัน) [Required]
  - `notes`: รายละเอียดเพิ่มเติม (Optional)
  - *(ตัดข้อมูลผู้เกี่ยวข้องและสถานที่ออก เพื่อความสะดวกรวดเร็วในการบันทึก)*

---

## 2. Work & Business Rules

### 2.1 Shift Safety Constraints (กฎความปลอดภัยในการจัดเวร)
1. **Forbidden Combination: Night + Morning Same Day (`FORBIDDEN_NIGHT_MORNING_SAME_DAY`)**:
   - **กฎเหล็กเด็ดขาด**: ห้ามผู้ใช้มีเวรดึก (`night`: 00:00 - 08:00) และเวรเช้า (`morning`: 08:00 - 16:00) ในวันเดียวกัน (Same Calendar Date) เพราะถือเป็นเวรดึกต่อเช้าที่ไม่มีช่วงเวลาพักผ่อน
   - ระบบต้องปฏิเสธการเพิ่ม, แก้ไข หรือแลกเวรเข้าตัวที่ทำให้เกิดคู่เวร `night` + `morning` ในวันเดียวกันทันที (HTTP 422: `INVALID_SHIFT_COMBINATION`)
2. **Permitted Combinations Following Night Shift (เวรที่อนุญาตให้ต่อจากเวรดึกในวันเดียวกัน)**:
   - การมีเวรดึก (`night`) แล้วต่อด้วยเวรอื่นในวันเดียวกัน **สามารถทำได้** ในกรณีต่อไปนี้:
     - `night` ต่อด้วย `afternoon` (บ่าย: 16:00 - 00:00) — มีเวลาพักระหว่างเวร 8 ชั่วโมง
     - `night` ต่อด้วย `r1` หรือ `r2` (Refer Standby 24 hrs)
     - `night` ต่อด้วย `ctm` หรือ `cta` (เวร CT Scan)

### 2.2 Time Boundary Standard & Conflict Detection Engine Invariants
1. **Time Representation Standard**:
   - เพื่อป้องกันความคลุมเครือของจุดตัดข้ามวัน (Date Rollover ณ เวลา 00:00) การเปรียบเทียบเวลาทั้งหมดต้องใช้ช่วงเวลาแบบกึ่งเปิด-กึ่งปิด $[start, end)$ บนพิกัด ISO 8601 Timestamp
   - เวรบ่าย (`afternoon`) เริ่มต้นที่ `16:00:00` และสิ้นสุดที่ `23:59:59.999` ของวันเดิม
   - เวรดึก (`night`) เริ่มต้นที่ `00:00:00` ของวันใหม่ และสิ้นสุดที่ `07:59:59.999`
2. **Hospital Shift Blocking Window**:
   - เวรเช้า (`morning`): บล็อกการรับงานเคหะบริบาลส่วนตัว (`CustomerServiceRecord`) ในช่วง $[08:00, 16:00)$
   - เวรบ่าย (`afternoon`): บล็อกการรับงานเคหะบริบาลส่วนตัวในช่วง $[16:00, 24:00)$
   - เวรดึก (`night`): บล็อกการรับงานเคหะบริบาลส่วนตัวในช่วง $[00:00, 08:00)$
3. **Refer Shift Overlap Exemption**:
   - เวร Refer (`r1`, `r2`) เป็นเวรเตรียมพร้อมสแตนด์บายฉุกเฉิน **ไม่บล็อก** การรับงานเคหะบริบาลส่วนตัว อนุญาตให้ตารางเวลางานซ้อนทับกันได้
4. **Conflict Validation**:
   - บันทึกงานเคหะบริบาล (`CustomerServiceRecord`) ที่ชนกับช่วงเวลาเวรโรงพยาบาลปกติ (Morning, Afternoon, Night) จะถูกปฏิเสธด้วย HTTP 409 (`CONFLICT_WITH_SHIFT`)
   - บันทึกหรือแลกเวรปกติเข้าสู่ช่วงเวลาที่มีงานบริการเคหะบริบาลอยู่แล้ว จะถูกปฏิเสธด้วย HTTP 409 (`CONFLICT_WITH_SERVICE`)
5. **Personal Event Overlap Alert (คำเตือนซ้อนทับธุระส่วนตัว)**:
   - หากเวลาของธุระส่วนตัว (`personal_event`) ซ้อนทับกับเวรโรงพยาบาลหรือบริการเคหะบริบาล ระบบจะไม่บล็อกการสร้าง (Non-blocking) แต่จะแสดง Visual Warning (`PERSONAL_EVENT_OVERLAP_WARNING`) บนปฏิทินเพื่อเตือนพยาบาล

### 2.3 Shift Swap & Top-Up Rules
1. **Direct Swap**: การแลกเปลี่ยนเวรโดยตรงระหว่างพยาบาลสองคน (`swappedWith`).
2. **Top-Up Swap (การแลกต่อยอด)**:
   - กรณีที่พยาบาลนำเวรที่ได้มาจากการแลกไปแลกเปลี่ยนต่อกับพยาบาลคนถัดไป
   - ระบบต้องบันทึกทั้ง `swappedWith` (คู่แลกโดยตรง) และ `originalOwner` (เจ้าของเวรตั้งต้น) เพื่อคง Audit Trail บนสายลำดับ `SwapTrailNode` ให้สมบูรณ์
3. **Same Shift Type & Date Category Swap Exception (การแลกเปลี่ยนหมวดเวรดำ-แดงในวันเดียวกัน)**:
   - **Allowed**: อนุญาตให้แลกเวรประเภทเดียวกันในวันเดียวกันได้ เฉพาะกรณีที่เกิดการแปลงสถานะระหว่าง **เวรดำ (`black`) กับ เวรแดง (`red`)** เท่านั้น (เช่น เช้าดำ $\leftrightarrow$ เช้าแดง)
   - **Blocked**: การแลกเวรประเภทเดียวกันในวันเดียวกันที่เป็นหมวดเดียวกัน (เช่น เช้าดำ $\leftrightarrow$ เช้าดำ) จะถูกปฏิเสธ (`DUPLICATE_SHIFT`)
4. **Duplicate Check**: พยาบาลคนเดิมไม่สามารถถือครองเวรประเภทเดียวกันในหมวดเดียวกันซ้ำซ้อนในวันเดียวกันได้

### 2.4 Locking, Deletion & Rollback Rules (Human-in-the-Loop Operational Decision)
1. **Immutability (Locked)**: เวรใดๆ ที่มี `shiftDate < CURRENT_DATE` จะถูกล็อกอัตโนมัติ (`isLocked: true`) ไม่สามารถแก้ไข, ลบ หรือย้อนสถานะได้ เว้นแต่ได้รับสิทธิ์พิเศษจากผู้ดูแลระบบ
2. **Deletion Restriction on Swapped Shifts**:
   - เวรที่อยู่ในสถานะ `swapped_out`, เป็น `parentShiftId` หรือมีประวัติอ้างอิงใน `SwapTrailNode` **ห้ามลบเด็ดขาด (No Hard Delete)**
   - หากต้องการยกเลิก ต้องใช้คำสั่ง Rollback (Undo Swap) เท่านั้น เพื่อป้องกันปัญหา `PARENT_SHIFT_NOT_FOUND`
3. **Bidirectional Direct Rollback (การกู้คืนเวรแบบสองทาง)**:
   - สำหรับ Direct Swap ธรรมดา: คืนสถานะ `parentShiftId` กลับเป็น `active` และยกเลิกเวรที่ได้รับมาจากการแลกเปลี่ยน (`cancelled` / คืนคู่แลก) พร้อมปรับสถานะ Transaction เป็น `rolled_back`
4. **Cascading Top-Up Rollback Governance (การตัดสินใจหน้างานของพยาบาล)**:
   - ในกรณีที่มีการแลกต่อยอด (เช่น พยาบาล $A \rightarrow B \rightarrow C$):
     - เนื่องจากระบบในเครื่องไม่สามารถทราบสถานะทางกายภาพได้แน่ชัดว่าพยาบาล $B$ หรือ $C$ ได้ขึ้นปฏิบัติงานจริงไปแล้วหรือไม่
     - **ระบบจะไม่ทำ Silent Auto-Cascade เด็ดขาด**
     - เมื่อพยาบาล $A$ ร้องขอ Rollback ในโหนดที่มีการแลกต่อยอด ระบบจะตรวจจับและขึ้นเตือน: `DOWNSTREAM_SWAP_ACTIVE_WARNING`
     - **Nurse Operational Decision**: ระบบจะมอบอำนาจให้พยาบาลหน้างานเป็นผู้ตัดสินใจยืนยันผ่าน UI Dialog โดยเลือกได้ 2 ทาง:
       - **Option 1 (Abort & Coordinate Manually)**: ยกเลิกการ Rollback เพื่อให้พยาบาลไปเจรจาตกลงกับพยาบาล $B$ และ $C$ ก่อน
       - **Option 2 (Nurse Override Confirmation)**: พยาบาลหน้างานกดยืนยันการ Rollback โดยระบุเหตุผล (Operational Reason Note) ระบบจะปลดสถานะเวรของคู่กรณีฝั่ง $A \leftrightarrow B$ และสร้าง Flag แจ้งเตือน `SWAP_BROKEN_MANUAL_REVIEW_REQUIRED` ส่งต่อไปยังตารางเวรของพยาบาล $B$ และ $C$ ทันที

### 2.5 Form Handling & Creation State Rules
1. **Empty Default State**: เมื่อเปิด Form การสร้างกิจกรรมส่วนตัว (`ModalAddPersonalEvent`), งานภายนอก, เวร หรือคลินิก ทุกฟิลด์ต้องตั้งต้นด้วยค่าว่างเปล่า (Empty/Blank) ห้ามนำค่าเดิมจากการกรอกครั้งก่อนมาค้างไว้
2. **Post-Submission Clean Up**: เมื่อบันทึกข้อมูลเรียบร้อย ต้อง Reset Form State ทั้งหมดกลับสู่ค่าว่างเปล่าทันที

---

## 3. External Gig & Service Financial Ledger (ระบบคำนวณเงินงานนอก)

### 3.1 Financial Invariants & Data Integrity
1. **Integer Representation (Satang Standard)**:
   - ตัวเลขจำนวนเงินทั้งหมด (ค่าบริการ, ค่ายา/เวชภัณฑ์, กำไรสุทธิ) ต้องจัดเก็บในหน่วยสตางค์ (Integer: $1 \text{ THB} = 100 \text{ Satang}$) เพื่อป้องกัน Floating-Point Precision Drift ($0.1 + 0.2 \neq 0.3$)
2. **Gig Financial Ledger Fields**:
   - **Core Required Fields (ข้อมูลหลักบังคับระบุ - บันทึกง่าย รวดเร็ว)**:
     - `serviceId`: รหัสบริการ
     - `serviceDate`: วันที่ให้บริการ
     - `serviceFee`: ค่าบริการที่ได้รับจากผู้รับบริการ (หน่วยสตางค์)
     - `medicationCost`: ค่ายาและเวชภัณฑ์ที่พยาบาลเป็นผู้จัดเตรียม/สำรองจ่าย (หน่วยสตางค์, default: 0)
   - **Optional Fields (ข้อมูลทางเลือก - ระบุหรือไม่ก็ได้ตามความสะดวก)**:
     - `durationHours`: จำนวนชั่วโมงที่ให้บริการจริง (Optional: เช่น 2.0, 4.0 ชม.)
     - `travelExpense`: ค่าเดินทาง/ค่าน้ำมัน (Optional: หน่วยสตางค์, default: 0)
     - `otherExpenses`: ค่าใช้จ่ายเบ็ดเตล็ดอื่นๆ (Optional: หน่วยสตางค์, default: 0)
     - `notes`: บันทึกเพิ่มเติมเกี่ยวกับเคส/อาการผู้ป่วย (Optional)

### 3.2 Financial Calculation Formulas
1. **Total Expenses (ต้นทุนรวม)**:
   $$\text{Total Expenses} = \text{medicationCost} + (\text{travelExpense} \mathbin{??} 0) + (\text{otherExpenses} \mathbin{??} 0)$$
   *(กรณีผู้ใช้กรอกเฉพาะข้อมูลหลัก: $\text{Total Expenses} = \text{medicationCost}$)*

2. **Net Profit (กำไรสุทธิ)**:
   $$\text{Net Profit} = \text{serviceFee} - \text{Total Expenses}$$

3. **Effective Hourly Rate (อัตราค่าจ้างสุทธิต่อชั่วโมง - คำนวณแบบยืดหยุ่น)**:
   - หากผู้ใช้ไม่ได้ระบุ `durationHours` หรือระบุเป็น $0$ ให้ข้ามการคำนวณนี้ (คืนค่า `null` หรือ `undefined` เพื่อไม่แสดงผลบน UI)
   - หากมีการระบุ $\text{durationHours} > 0$ ให้คำนวณตามสูตร:
     $$\text{Effective Hourly Rate} = \frac{\text{Net Profit}}{\text{durationHours}}$$