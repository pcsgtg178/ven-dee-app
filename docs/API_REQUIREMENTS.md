# VenDee (เวรดี) - API Specification & Requirements Document
**เอกสารข้อกำหนดความต้องการ API (API Contract & Specification)**
*สำหรับทีมพัฒนาระบบ Backend / RESTful API*

---

## 1. มาตรฐานและการออกแบบทั่วไป (API Standards & Conventions)

### 1.1 Base URL & Versioning
- **Base URL:** `https://api.vendee.app/api/v1` (Production) หรือ `http://localhost:8080/api/v1` (Development)
- **Data Format:** ทุกคำขอและคำตอบต้องใช้ `application/json; charset=utf-8`

### 1.2 Authentication & Security Headers
ทุก Endpoint ที่ต้องระบุตัวตน (Protected Endpoints) จะต้องแนบ Authorization Header ดังนี้:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
```

### 1.3 รูปแบบมาตรฐานของ Response (Standard JSON Envelope)

#### คำขอที่สำเร็จ (Success Response: 200 OK, 201 Created)
```json
{
  "success": true,
  "data": {}, 
  "message": "ข้อความอธิบายผลสำเร็จ (Optional)",
  "meta": {
    "timestamp": "2026-09-19T13:30:00.000Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 150,
      "totalPages": 8
    }
  }
}
```

#### คำขอที่เกิดข้อผิดพลาด (Error Response: 4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_DETECTED",
    "message": "ไม่สามารถบันทึกได้เนื่องจากเวลาทับซ้อนกับนัดหมายอื่น",
    "details": [
      {
        "field": "service_time",
        "issue": "เวลา 14:00 น. ตรงกับช่วงเวลาเวรเช้า (08:00 - 16:00)"
      }
    ]
  }
}
```

### 1.4 รายการรหัสข้อผิดพลาดหลัก (Standard Business Error Codes)

| Error Code | HTTP Status | ความหมาย |
| :--- | :--- | :--- |
| `DUPLICATE_SHIFT` | 409 Conflict | มีเวรประเภทเดียวกันในวันที่ระบุอยู่แล้ว |
| `CONFLICT_WITH_SHIFT` | 409 Conflict | เวลาของงานบริการลูกค้าชนกับเวลาขึ้นเวรโรงพยาบาล |
| `CONFLICT_WITH_SERVICE`| 409 Conflict | เวลาของเวรที่จะบันทึกหรือรับแลก ชนกับนัดหมายบริการลูกค้าที่มีอยู่ |
| `SHIFT_IS_LOCKED` | 400 Bad Request | เวรผ่านพ้นเวลาไปแล้ว (`isLocked: true`) ห้ามแก้ไขหรือยกเลิก |
| `QUOTA_DEFICIT_WARNING`| 422 Unprocessable | แลกเวรแล้วทำให้เวรดำลดลงต่ำกว่าโควต้า (เมื่อ Client ร้องขอแบบ Strict) |
| `PARENT_SHIFT_NOT_FOUND`| 404 Not Found | ไม่พบเวรต้นทางสำหรับการกู้คืน (Undo Swap) |
| `VALIDATION_ERROR` | 400 Bad Request | ข้อมูลใน Request Body ไม่ถูกต้องหรือไม่ครบถ้วน |
| `UNAUTHORIZED` | 401 Unauthorized | Token หมดอายุหรือไม่ถูกต้อง |
| `FORBIDDEN` | 403 Forbidden | ไม่มีสิทธิ์เข้าถึงข้อมูลของพยาบาลท่านอื่น |

---

## 2. กลุ่ม API: ผู้ใช้งานและข้อมูลส่วนตัว (Auth & User Profile)

### 2.1 เข้าสู่ระบบ (Login)
- **Method:** `POST`
- **Path:** `/auth/login`
- **Auth Required:** ไม่ต้อง

#### Request Body
```json
{
  "email": "nurse.jane@hospital.or.th",
  "password": "Password@123"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": {
      "id": "usr-uuid-1",
      "email": "nurse.jane@hospital.or.th",
      "fullName": "พว.เจนจิรา รักษาดี",
      "phone": "089-123-4567",
      "role": "nurse",
      "wardName": "วอร์ด ICU ผู้ใหญ่",
      "monthlyBlackQuota": 14
    }
  }
}
```

---

### 2.2 ค้นหาเพื่อนร่วมงานสำหรับแลกเวร (Search Colleagues for Autocomplete)
- **Method:** `GET`
- **Path:** `/users/colleagues`
- **Auth Required:** ต้องมี (`Bearer Token`)
- **Query Parameters:**
  - `query` (optional string): ค้นหาชื่อพยาบาลหรือเบอร์โทร เช่น `?query=กานดา`
  - `ward` (optional string): กรองเฉพาะวอร์ดเดียวกัน เช่น `?ward=ICU`

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "usr-uuid-2",
      "fullName": "พว.กานดา สุวรรณ",
      "wardName": "วอร์ด ICU ผู้ใหญ่",
      "phone": "081-999-8877"
    },
    {
      "id": "usr-uuid-3",
      "fullName": "พว.ก้อย สุดา",
      "wardName": "ห้องฉุกเฉิน (ER)",
      "phone": "082-333-2211"
    }
  ]
}
```

---

## 3. กลุ่ม API: จัดการตารางเวร (Shift Management)

### 3.1 ดึงรายการเวร (Get Shifts)
- **Method:** `GET`
- **Path:** `/shifts`
- **Auth Required:** ต้องมี
- **Query Parameters:**
  - `month` (string, e.g. `2026-09`): ดึงเวรประจำเดือน
  - `startDate` (string, e.g. `2026-09-01`) & `endDate` (string, e.g. `2026-09-30`)
  - `status` (string, `active` | `all`, default: `active`)
  - `category` (string, `black` | `red` | `green`, optional)

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "shift-1",
      "type": "shift",
      "date": "2026-09-19",
      "shiftType": "night",
      "category": "black",
      "status": "active",
      "department": "วอร์ด ICU ผู้ใหญ่",
      "note": "เวรดึกหลัก ดูแลเคส Post-Op",
      "isLocked": false,
      "createdAt": "2026-09-18T20:00:00.000Z"
    },
    {
      "id": "shift-3",
      "type": "shift",
      "date": "2026-09-21",
      "shiftType": "morning",
      "category": "black",
      "status": "active",
      "department": "อายุรกรรมหญิง ช.6",
      "note": "เวรเช้า (รับแลกต่อยอดมา)",
      "isLocked": false,
      "swapMeta": {
        "swappedWith": "พว.กานดา สุวรรณ",
        "originalOwner": "พว.วิภา มณีรัตน์",
        "parentShiftId": "shift-old-123",
        "isLocked": false,
        "swapDate": "2026-09-17",
        "swapReason": "พว.กานดาติดธุระด่วน จึงส่งต่อเวรให้ขึ้นแทน"
      },
      "createdAt": "2026-09-17T11:00:00.000Z"
    }
  ]
}
```

---

### 3.2 สร้างเวรใหม่ (Create Shift)
- **Method:** `POST`
- **Path:** `/shifts`
- **Auth Required:** ต้องมี

#### Business Validations:
1. ตรวจสอบว่ามีเวรประเภทเดียวกัน (`shiftType`) ที่สถานะ `active` ในวันที่นั้นอยู่แล้วหรือไม่ $\rightarrow$ หากมี ตอบ `409 DUPLICATE_SHIFT`
2. หากไม่ใช่เวร `r1` หรือ `r2` ตรวจสอบว่ามีนัดหมายบริการลูกค้า (`CustomerService`) ในช่วงเวลาของเวรนั้นหรือไม่ $\rightarrow$ หากมี ตอบ `409 CONFLICT_WITH_SERVICE`

#### Request Body
```json
{
  "date": "2026-09-22",
  "shiftType": "morning",
  "category": "black",
  "department": "วอร์ด ICU ผู้ใหญ่",
  "note": "เวรเช้าปกติ"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "shift-uuid-99",
    "type": "shift",
    "date": "2026-09-22",
    "shiftType": "morning",
    "category": "black",
    "status": "active",
    "department": "วอร์ด ICU ผู้ใหญ่",
    "note": "เวรเช้าปกติ",
    "isLocked": false,
    "createdAt": "2026-09-19T13:35:00.000Z"
  },
  "message": "บันทึกเวรสำเร็จ"
}
```

---

### 3.3 แก้ไขข้อมูลเวร (Update Shift)
- **Method:** `PUT`
- **Path:** `/shifts/:id`
- **Auth Required:** ต้องมี

#### Business Validations:
- หากเวรมี `isLocked == true` หรือวันที่เวรผ่านไปแล้ว ไม่อนุญาตให้แก้ไข $\rightarrow$ ตอบ `400 SHIFT_IS_LOCKED`

#### Request Body
```json
{
  "department": "วอร์ด ICU ศัลยกรรม",
  "note": "ปรับปรุงหมายเหตุใหม่"
}
```

---

### 3.4 ลบเวร (Delete Shift)
- **Method:** `DELETE`
- **Path:** `/shifts/:id`
- **Auth Required:** ต้องมี

#### Special Business Behavior (Auto-Restore Parent):
- หากเวรที่ถูกสั่งลบเป็น **เวรที่ได้มาจากการแลก** (`parentShiftId` มีค่า):
  - ระบบจะต้องกู้คืนเวรต้นทางของพยาบาลท่านนั้นให้กลับมามีสถานะ `active` โดยอัตโนมัติ!
  - พร้อมส่งคืน `restoredParentId` ใน Response

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "deletedShiftId": "shift-3",
    "restoredParentId": "shift-old-123"
  },
  "message": "ลบเวรสำเร็จและกู้คืนเวรเดิมเรียบร้อยแล้ว"
}
```

---

### 3.5 กู้คืนเวรแบบแมนนวล (Restore Inactive Shift)
- **Method:** `POST`
- **Path:** `/shifts/:id/restore`
- **Auth Required:** ต้องมี
- เปลี่ยนสถานะจาก `swapped_out` กลับมาเป็น `active`

---

## 4. กลุ่ม API: ระบบแลกเวรและประวัติ (Complex Shift Swap & Trail)

### 4.1 ตรวจสอบผลกระทบต่อโควต้าล่วงหน้า (Simulate Quota Impact)
- **Method:** `POST`
- **Path:** `/shifts/simulate-quota`
- **Auth Required:** ต้องมี

#### คำอธิบาย:
ใช้เมื่อผู้ใช้เปิดฟอร์มแลกเวร และเลือกเปลี่ยนจากเวรดำไปเป็นเวรแดง เพื่อดูว่ายอดเวรดำในเดือนนั้นจะต่ำกว่า 14 เวรหรือไม่

#### Request Body
```json
{
  "shiftId": "shift-1",
  "newCategory": "red",
  "targetDate": "2026-09-24"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "currentBlackCount": 13,
    "simulatedBlackCount": 12,
    "quota": 14,
    "remainingNeeded": 2,
    "willBeUnderQuota": true,
    "monthName": "กันยายน 2569",
    "warningMessage": "หากแลกเป็นเวรแดง จะทำให้จำนวนเวรดำในเดือนกันยายน 2569 เหลือเพียง 12/14 วัน (ขาดอีก 2 วัน) ยืนยันที่จะดำเนินการหรือไม่?"
  }
}
```

---

### 4.2 ดำเนินการแลกเวร (Execute Shift Swap)
- **Method:** `POST`
- **Path:** `/shifts/:id/swap`
- **Auth Required:** ต้องมี

#### Core Business Rules:
1. ระบบจะเปลี่ยนสถานะของเวรเดิม (`:id`) เป็น `swapped_out`
2. ระบบจะสร้างเวรใหม่ขึ้นมา พร้อมผูก `parentShiftId` = `:id`
3. ระบบจะบันทึกประวัติการแลก (Swap Trail):
   - หากมี `originalOwner` (การแลกต่อยอด): สร้างโหนด `originalOwner` $\rightarrow$ `swappedWith` และ `swappedWith` $\rightarrow$ `ฉัน`
   - หากเป็นการแลกตรง: สร้างโหนด `swappedWith` $\rightarrow$ `ฉัน`
4. ตรวจสอบ Conflict เวลาและ Duplicate Shift ตามกฎของระบบ
5. ทั้งหมดต้องทำงานภายใต้ **Database Transaction**

#### Request Body
```json
{
  "swappedWith": "พว.กานดา สุวรรณ",
  "originalOwner": "พว.วิภา มณีรัตน์",
  "newDate": "2026-09-24",
  "newShiftType": "afternoon",
  "newCategory": "black",
  "swapReason": "พว.กานดาติดธุระด่วน จึงส่งต่อเวรให้ขึ้นแทน"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "oldShift": {
      "id": "shift-1",
      "status": "swapped_out"
    },
    "newShift": {
      "id": "shift-new-456",
      "date": "2026-09-24",
      "shiftType": "afternoon",
      "category": "black",
      "status": "active",
      "department": "วอร์ด ICU ผู้ใหญ่",
      "swapMeta": {
        "swappedWith": "พว.กานดา สุวรรณ",
        "originalOwner": "พว.วิภา มณีรัตน์",
        "parentShiftId": "shift-1",
        "isLocked": false,
        "swapDate": "2026-09-19",
        "swapReason": "พว.กานดาติดธุระด่วน จึงส่งต่อเวรให้ขึ้นแทน"
      }
    }
  },
  "message": "แลกเปลี่ยนเวรสำเร็จ"
}
```

#### Conflict Error Response (409 Conflict)
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_WITH_SERVICE",
    "message": "ไม่สามารถแลกมารับเวรบ่าย (16:00 - 00:00) ในวันที่ 2026-09-24 ได้ เนื่องจากมีนัดหมายบริการ \"คุณยายสมศรี สุขเกษม\" เวลา 16:30 น. อยู่แล้ว"
  }
}
```

---

### 4.3 ยกเลิกการแลกเวร (Undo / Rollback Shift Swap)
- **Method:** `POST`
- **Path:** `/shifts/:id/undo-swap`
- **Auth Required:** ต้องมี

#### Core Business Rules:
1. ตรวจสอบว่าเวรนี้เป็นเวรที่มาจากการแลกหรือไม่ (`parentShiftId` ต้องมีอยู่)
2. ตรวจสอบว่าเวรผ่านพ้นไปแล้วหรือไม่ หากวันที่ของเวร $\le$ ปัจจุบัน (`isLocked: true`) $\rightarrow$ ตอบ `400 SHIFT_IS_LOCKED`
3. ลบหรือปรับสถานะเวร `:id` เป็น `cancelled`
4. คืนสถานะของเวรต้นทาง (`parentShiftId`) ให้กลับมาเป็น `active` ทันที

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "cancelledShiftId": "shift-new-456",
    "restoredShiftId": "shift-1"
  },
  "message": "ยกเลิกการแลกเวรสำเร็จ เวรเดิมของคุณได้รับการคืนสถานะแล้ว"
}
```

---

### 4.4 ดึงประวัติเส้นทางการแลกเวร (Get Swap Trail Audit Timeline)
- **Method:** `GET`
- **Path:** `/shifts/:id/swap-trail`
- **Auth Required:** ต้องมี

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "currentShiftId": "shift-3",
    "currentHolder": "พว.เจนจิรา รักษาดี",
    "shiftDate": "2026-09-21",
    "shiftLabel": "เวรเช้า (08:00 - 16:00)",
    "timeline": [
      {
        "step": 1,
        "fromPerson": "พว.วิภา มณีรัตน์ (เจ้าของเดิมตามตาราง)",
        "toPerson": "พว.กานดา สุวรรณ (คนกลาง)",
        "date": "2026-09-16",
        "shiftLabel": "เวรเช้า (08:00 - 16:00)",
        "note": "แลกเปลี่ยนเวรตามตารางประจำสัปดาห์"
      },
      {
        "step": 2,
        "fromPerson": "พว.กานดา สุวรรณ",
        "toPerson": "ฉัน (พว.เจนจิรา รักษาดี)",
        "date": "2026-09-17",
        "shiftLabel": "เวรเช้า (08:00 - 16:00)",
        "note": "ส่งต่อแลกเวรต่อยอด (Top-up Swap)"
      }
    ]
  }
}
```

---

## 5. กลุ่ม API: สรุปโควต้าและฟีดกิจกรรมรวม (Analytics & Feed)

### 5.1 สถิติโควต้าเวรดำประจำเดือน (Get Monthly Quota Stats)
- **Method:** `GET`
- **Path:** `/analytics/monthly-quota`
- **Query Parameters:** `month` (e.g. `2026-09`)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "month": "2026-09",
    "blackCount": 12,
    "redCount": 2,
    "quota": 14,
    "remaining": 2,
    "isMet": false,
    "percentage": 86
  }
}
```

---

### 5.2 ฟีดตารางงานรวมทั้งหมด (Unified Activities Feed)
- **Method:** `GET`
- **Path:** `/schedule/activities`
- **Query Parameters:**
  - `month` (string, e.g. `2026-09`)
  - `type` (string, `all` | `shift` | `service`, default: `all`)

#### คำอธิบาย:
ดึงข้อมูลรวมทั้งเวรโรงพยาบาล (`type: "shift"`) และนัดหมายบริการลูกค้า (`type: "service"`) เรียงลำดับตามวันที่และเวลา เพื่อนำไปแสดงผลบนปฏิทิน (FullCalendar) และหน้ารายการ Timeline

---

## 6. กลุ่ม API: จัดการข้อมูลลูกค้า (Customer Management)

### 6.1 รายชื่อลูกค้าทั้งหมด (Get Customers)
- **Method:** `GET`
- **Path:** `/customers`
- **Query Parameters:** `search` (ค้นหาชื่อ, เบอร์โทร, หรือโน้ตสถานที่)

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "cust-1",
      "name": "คุณยายสมศรี สุขเกษม",
      "phone": "081-234-5678",
      "note": "บ้านสวน ซ.ร่วมใจ (คนไข้เบาหวาน เจาะน้ำตาล/ฉีดอินซูลิน)",
      "address": "99/12 ซอยร่วมใจ 3 ถนนสุขุมวิท กรุงเทพฯ",
      "avatarColor": "bg-emerald-500",
      "totalServicesCount": 5,
      "createdAt": "2026-09-01T08:00:00.000Z"
    }
  ]
}
```

---

### 6.2 รายละเอียดลูกค้ารายบุคคล (Get Customer Detail with History)
- **Method:** `GET`
- **Path:** `/customers/:id`

#### Response (200 OK)
ส่งคืนข้อมูลโปรไฟล์ลูกค้า พร้อมรายการนัดหมายที่กำลังจะมาถึง (`upcomingServices`) และประวัติที่เสร็จสิ้นแล้ว (`historyServices`)

---

### 6.3 สร้างหรือแก้ไขลูกค้า (Create / Update Customer)
- **Method:** `POST /customers` หรือ `PUT /customers/:id`

#### Request Body
```json
{
  "name": "คุณแพรวพรรณ โสภณ",
  "phone": "089-876-5432",
  "note": "คอนโด Ashton อโศก ชั้น 18 (นัดดริปวิตามินผิวประจำสัปดาห์)",
  "address": "Ashton Asoke ห้อง 1804 สุขุมวิท 21 กรุงเทพฯ",
  "avatarColor": "bg-sky-500"
}
```

---

## 7. กลุ่ม API: งานบริการหัตถการลูกค้า (Customer Services / Appointments)

### 7.1 สร้างนัดหมายบริการ (Create Customer Service)
- **Method:** `POST`
- **Path:** `/services`
- **Auth Required:** ต้องมี

#### Business Validations:
- ตรวจสอบว่าเวลาที่นัดหมาย (`date` และ `time`) ตรงกับช่วงเวลาของเวรโรงพยาบาล (`shiftType`) ที่สถานะเป็น `active` หรือไม่
- **ข้อยกเว้น:** หากวันดังกล่าวพยาบาลมีเฉพาะเวร `r1` หรือ `r2` (เวร Refer) จะอนุญาตให้ลงนัดหมายได้โดยไม่เกิด Conflict!
- หากตรวจพบว่าเวลาตรงกับเวรเช้า/บ่าย/ดึก ให้ส่งคืน `409 CONFLICT_WITH_SHIFT`

#### Request Body
```json
{
  "customerId": "cust-1",
  "customerName": "คุณยายสมศรี สุขเกษม",
  "customerPhone": "081-234-5678",
  "customerNote": "บ้านสวน ซ.ร่วมใจ",
  "date": "2026-09-20",
  "time": "14:00",
  "services": ["injection"],
  "medications": ["Insulin Glargine 14 Units SC", "Vitamin B1-6-12 1 Amp IM"],
  "note": "เจาะน้ำตาลปลายนิ้วก่อนฉีด",
  "price": 450
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "srv-uuid-101",
    "type": "service",
    "customerId": "cust-1",
    "customerName": "คุณยายสมศรี สุขเกษม",
    "customerPhone": "081-234-5678",
    "customerNote": "บ้านสวน ซ.ร่วมใจ",
    "date": "2026-09-20",
    "time": "14:00",
    "services": ["injection"],
    "medications": ["Insulin Glargine 14 Units SC", "Vitamin B1-6-12 1 Amp IM"],
    "note": "เจาะน้ำตาลปลายนิ้วก่อนฉีด",
    "status": "upcoming",
    "price": 450,
    "createdAt": "2026-09-19T13:40:00.000Z"
  },
  "message": "สร้างนัดหมายสำเร็จ"
}
```

#### Conflict Error Example (409 Conflict)
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_WITH_SHIFT",
    "message": "เวลา 14:00 น. ตรงกับช่วงเวลาเวรเช้า (08:00 - 16:00) ที่ขึ้นเวรอยู่ ไม่สามารถนัดหมายทับเวลาเวรได้"
  }
}
```

---

### 7.2 อัปเดตสถานะนัดหมาย (Toggle Service Status)
- **Method:** `PATCH`
- **Path:** `/services/:id/status`

#### Request Body
```json
{
  "status": "completed"
}
```
*(ค่าที่ยอมรับได้: `upcoming`, `completed`, `cancelled`)*

---

### 7.3 ลบนัดหมายบริการ (Delete Service)
- **Method:** `DELETE`
- **Path:** `/services/:id`

---

## 8. สรุป Checklist สำหรับทีมพัฒนา Backend (Implementation Checklist)

1. [ ] **Database Migration:** สร้าง Tables ตาม ERD (`users`, `shifts`, `shift_swap_transactions`, `swap_trail_nodes`, `customers`, `customer_services`)
2. [ ] **Index Optimization:**
   - สร้าง Index บน `shifts (user_id, shift_date, status)`
   - สร้าง Index บน `customer_services (user_id, service_date, service_time, status)`
3. [ ] **Transaction Guard:** ฟังก์ชันแลกเวร (`/shifts/:id/swap`) และยกเลิกการแลก (`/shifts/:id/undo-swap`) ต้องอยู่ภายใต้ SQL Transaction
4. [ ] **Locking Logic:** ใส่เงื่อนไขตรวจสอบ `shift_date < CURRENT_DATE` ใน API แก้ไข, แลกเวร, และยกเลิกการแลก
5. [ ] **Conflict Validation Middleware / Service:** ทำโมดูลตรวจเวลาชนกันแยกส่วนให้ชัดเจน เพื่อเรียกใช้ได้ทั้งในฝั่ง Shift Service และ Customer Service
6. [ ] **Error Handling:** จัดการ Response Error ให้อยู่ในฟอร์แมต Envelope เดียวกันทั้งหมด พร้อมข้อความภาษาไทยที่สื่อความหมายชัดเจน
