import type { ActionResult } from "../types/vendee";

/**
 * Standard unwrap helper for Next.js Server Actions (BACKLOG_ISSUE.md §Cross-cutting)
 * Ensures that if a server action returns { success: false, error },
 * the error is thrown immediately so local storage is NOT modified on failure.
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result || !result.success) {
    const errorMsg = result?.error?.message || "เกิดข้อผิดพลาดในการประมวลผลข้อมูล";
    const err = new Error(errorMsg);
    (err as any).code = result?.error?.code;
    (err as any).details = result?.error?.details;
    throw err;
  }
  return result.data;
}
