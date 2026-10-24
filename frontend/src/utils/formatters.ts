/**
 * formatters.ts — Frontend Data Formatting and Validation Utilities
 *
 * WHAT it does:
 *     Provides pure helper functions for file extension validation, human-readable
 *     byte size formatting, and EVM wallet address truncation.
 *
 * WHY it exists:
 *     Extracting these utilities keeps UI components focused strictly on rendering,
 *     prevents code duplication across views, and enables fast, deterministic unit
 *     testing without browser DOM dependencies.
 *
 * HOW it connects to Filecoin:
 *     Validates that only supported architectural formats (.ifc, .gltf) are queued
 *     for IPFS/Lighthouse upload and FEVM contract anchoring, and displays the
 *     architect's Calibration wallet address in the dashboard header.
 */

export const ACCEPTED_EXTENSIONS = [".ifc", ".gltf"] as const;

/**
 * Returns true if the provided filename ends with an accepted 3D model extension.
 * Case-insensitive (.IFC, .gltf, etc. are all valid).
 */
export function isSupportedFileName(fileName: string): boolean {
  if (!fileName || typeof fileName !== "string") return false;
  const lower = fileName.toLowerCase().trim();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Formats raw byte counts into human-readable strings (e.g. "2.4 MB").
 */
export function formatSize(bytes: number): string {
  if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shortens an EVM hex address into 0x1234...abcd for compact header display.
 */
export function shortenAddress(address: string): string {
  if (!address || typeof address !== "string") return "";
  const trimmed = address.trim();
  if (trimmed.length < 10) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}
