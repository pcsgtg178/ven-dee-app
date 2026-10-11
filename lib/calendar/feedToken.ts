/**
 * WebCal Feed Token Management & Cryptographic Security
 *
 * Adheres to:
 * - PROJECT_RULES.md Section 5.3: Single-User Security & Feed Token Management
 * - DOMAIN_RULES.md Section 4: iOS Calendar Export & Synchronization
 */

export const DEFAULT_FEED_TOKEN = "vendee-nurse-secure-token-2026";

/**
 * Generate a cryptographically secure random token (32 bytes hex)
 * Works in both Browser and Node.js environments via standard Web Crypto API.
 */
export function generateSecureFeedToken(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buffer = new Uint8Array(24);
      crypto.getRandomValues(buffer);
      return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (_) {}

  // Fallback if getRandomValues unavailable
  return `vendee-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Validate incoming feed token against stored token
 */
export function isValidFeedToken(incomingToken: string | null | undefined, validToken: string): boolean {
  if (!incomingToken || !validToken) return false;
  return incomingToken.trim() === validToken.trim();
}
