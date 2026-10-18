/**
 * Desconto progressivo por volume de totens.
 * Aplica somente sobre software (base + adicionais), nunca sobre TEF/PIX.
 */
export interface VolumeDiscountTier {
  min_devices: number;
  max_devices?: number | null;
  percent: number;
}

export function normalizeVolumeDiscounts(raw: unknown): VolumeDiscountTier[] {
  if (!Array.isArray(raw)) return [];
  const out: VolumeDiscountTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const min = Number(obj.min_devices);
    const maxRaw = obj.max_devices;
    const pct = Number(obj.percent);
    if (!Number.isFinite(min) || min < 1) continue;
    if (!Number.isFinite(pct) || pct < 0) continue;
    const max =
      maxRaw === null || maxRaw === undefined || maxRaw === ""
        ? null
        : Number.isFinite(Number(maxRaw))
          ? Number(maxRaw)
          : null;
    out.push({
      min_devices: Math.floor(min),
      max_devices: max === null ? null : Math.floor(max),
      percent: Math.min(100, Math.max(0, pct)),
    });
  }
  out.sort((a, b) => a.min_devices - b.min_devices);
  return out;
}