"use client";

import ModalTransferShift, { ModalTransferShiftProps } from "./ModalTransferShift";

/**
 * Re-exporting ModalTransferShift as ModalSellShift for backwards compatibility.
 * Phase 11 transitions from Shift Selling to One-Way Shift Transfer.
 */
export type ModalSellShiftProps = ModalTransferShiftProps;
export default ModalTransferShift;
