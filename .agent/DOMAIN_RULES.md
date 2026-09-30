# Nurse Domain Invariants

## 1. Shift Definitions & Quotas

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

## 2. Work & Business Rules

### 2.1 Conflict Detection Engine Invariants
1. **Hospital Shift Blocking Window**:
   - Morning Shift (`morning`): Blocks private homecare service appointments from 08:00 to 15:59.
   - Afternoon Shift (`afternoon`): Blocks private homecare service appointments from 16:00 to 23:59.
   - Night Shift (`night`): Blocks private homecare service appointments from 00:00 to 07:59.
2. **Refer Shift Overlap Exemption**:
   - Refer shifts (`r1`, `r2`) are emergency standby duties and **DO NOT** block private homecare service bookings. Overlapping bookings are explicitly allowed.
3. **Conflict Validation**:
   - Creating/updating a private service (`CustomerServiceRecord`) that overlaps with an active regular shift returns HTTP 409 (`CONFLICT_WITH_SHIFT`).
   - Creating or swapping into a regular shift on a date/time with an active private service returns HTTP 409 (`CONFLICT_WITH_SERVICE`).

### 2.2 Shift Swap & Top-Up Rules
1. **Direct Swap**: Exchanging a shift directly with a colleague (`swappedWith`).
2. **Top-Up Swap (แลกต่อยอด)**: Exchanging a shift acquired from another nurse. Must record both `swappedWith` (direct partner) and `originalOwner` (schedule owner) to preserve full audit trail (`SwapTrailNode`).
3. **Same Shift Type & Date Category Swap Exception (การแลกเปลี่ยนหมวดเวรดำ-แดงในวันเดียวกัน)**:
   - **Allowed**: Swapping a shift of the SAME `shiftType` on the SAME `date` IS PERMITTED if and only if the swap converts between **Black Shift (`black`) and Red Shift (`red`)** (e.g., swapping Morning Black $\rightarrow$ Morning Red, or Morning Red $\rightarrow$ Morning Black on 29 Sep).
   - **Blocked**: Swapping a shift of the same type and date into the exact same category (e.g., Morning Black $\rightarrow$ Morning Black) is rejected (`DUPLICATE_SHIFT`).
4. **Duplicate Check**: A nurse cannot hold duplicate `active` shifts of the same `shiftType` and category on the same date.


### 2.3 Locking, Deletion & Rollback Rules
1. **Immutability (Locked)**: Any shift with `shiftDate < CURRENT_DATE` is automatically locked (`isLocked: true`). Locked shifts cannot be edited, swapped out, deleted, or rolled back (`SHIFT_IS_LOCKED`).
2. **Deletion Restriction on Swapped Shifts (Prevent Orphaned Swap Trails / "Shift Swap Not Found")**:
   - Any shift that has been swapped out (`status: "swapped_out"`), acts as a `parentShiftId` for a resulting shift, or is referenced in `SwapTrailNode` entries **CANNOT be deleted**.
   - Attempting to delete a swapped shift must be blocked/rejected to prevent breaking parent references and causing `PARENT_SHIFT_NOT_FOUND` ("Shift Swap not found") errors during rollback or audit timeline lookup.
   - To restore or revert a swap, the user must use the **Rollback (Undo Swap)** feature instead of deleting the shift.
3. **Bidirectional Rollback / Undo Swap (การกู้คืนเวรแบบสองทาง)**:
   - Performing a Rollback (Undo Swap) to restore a parent shift (`parentShiftId`) **MUST automatically cancel/revert the shift received during that swap**.
   - The rollback operation must execute symmetrically and atomically:
     1. Restore the original swapped-out shift (`parentShiftId`) back to `status: "active"`.
     2. Cancel or revert the shift received from the swap transaction (`status: "cancelled"` / restored to partner) so no orphaned or duplicate shifts remain.
     3. Update the swap transaction state to `rolled_back` while retaining audit trail logs (`SwapTrailNode`).

### 2.4 Form Handling & Todo Creation Rules
1. **Empty Default State**: When opening the creation form for a new Todo, shift, service, or clinic record, all form fields must default to empty/blank values. Previous inputs from prior saved forms must never persist into a new creation form.
2. **Post-Submission Clean Up**: Upon submitting/saving a form, all form input states must be explicitly cleared/reset to their initial empty defaults.




