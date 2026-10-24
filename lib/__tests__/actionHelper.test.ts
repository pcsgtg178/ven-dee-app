import test from "node:test";
import assert from "node:assert/strict";
import { unwrap } from "../actionHelper.ts";

test("unwrap returns data when action succeeds", () => {
  const result = { success: true as const, data: { id: "123", name: "test" } };
  const unwrapped = unwrap(result);
  assert.deepEqual(unwrapped, { id: "123", name: "test" });
});

test("unwrap throws error with message and code when action fails", () => {
  const failedResult = {
    success: false as const,
    error: {
      code: "SHIFT_IS_LOCKED",
      message: "ไม่สามารถทำรายการเวรที่ถูกล็อกแล้วได้",
      details: [{ field: "shiftDate" }],
    },
  };

  assert.throws(
    () => unwrap(failedResult),
    (err: any) => {
      assert.equal(err.message, "ไม่สามารถทำรายการเวรที่ถูกล็อกแล้วได้");
      assert.equal(err.code, "SHIFT_IS_LOCKED");
      assert.deepEqual(err.details, [{ field: "shiftDate" }]);
      return true;
    }
  );
});

test("unwrap throws generic fallback error when error message is missing", () => {
  const failedWithoutMsg = {
    success: false as const,
    error: { code: "SERVER_ERROR", message: "" },
  };

  assert.throws(
    () => unwrap(failedWithoutMsg as any),
    (err: any) => {
      assert.equal(err.message, "เกิดข้อผิดพลาดในการประมวลผลข้อมูล");
      return true;
    }
  );
});
