const TTL_PATTERN = /^([1-9]\d*)([smhd])$/;

export function ttlToSeconds(ttl: string): number {
  const match = TTL_PATTERN.exec(ttl);
  if (!match) throw new Error(`Invalid token TTL: ${ttl}`);
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multiplier = { s: 1, m: 60, h: 3_600, d: 86_400 }[unit];
  return value * multiplier;
}
