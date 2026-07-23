// Auto-generated 9-character BOL numbers: YYMMMDDSS
//   YY  = last two digits of the year
//   MMM = three-character Greek month prefix (December is "MU0" since Mu is
//         only two letters)
//   DD  = two-digit day of the month
//   SS  = two-digit daily sequence number (01 = first BOL that day)
// Example: 26ALP0501 -> 2026, January 5th, first BOL of the day.

export const GREEK_MONTHS = [
  "ALP", // January  (Alpha)
  "BET", // February (Beta)
  "GAM", // March    (Gamma)
  "DEL", // April    (Delta)
  "EPS", // May      (Epsilon)
  "ZET", // June     (Zeta)
  "ETA", // July     (Eta)
  "THE", // August   (Theta)
  "IOT", // September(Iota)
  "KAP", // October  (Kappa)
  "LAM", // November (Lambda)
  "MU0", // December (Mu — padded to three characters)
] as const;

/** Date prefix (YYMMMDD) for a given date. */
export function bolPrefix(date: Date = new Date()): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mmm = GREEK_MONTHS[date.getMonth()];
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mmm}${dd}`;
}

/**
 * Next BOL number for today given the BOL numbers already in use.
 * Scans existing numbers with today's prefix and returns prefix + (max SS + 1).
 */
export function nextBolNumber(existing: (string | null | undefined)[], date: Date = new Date()): string {
  const prefix = bolPrefix(date);
  let maxSeq = 0;
  for (const b of existing) {
    if (!b || !b.startsWith(prefix)) continue;
    const seq = Number(b.slice(prefix.length));
    if (Number.isInteger(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(2, "0")}`;
}
