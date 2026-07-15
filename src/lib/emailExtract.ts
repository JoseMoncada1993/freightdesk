// Field extraction for the Email Data Log module. Mirrors what the old
// "Control Tower Loads" Apps Script did: given an email's plain-text body and
// a rule's field list, pull one value per field.
//
// A field with an explicit regex `pattern` uses it directly (first capture
// group, else the whole match). Without a pattern the parser looks for the
// label in the text: "Label: value", "Label<TAB>value" (HTML tables become
// tab-separated when stripped), or the label on its own line with the value
// on the next line.
import type { EmailFieldDef } from "@/lib/types";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function extractField(body: string, field: EmailFieldDef): string {
  if (field.pattern) {
    try {
      const m = body.match(new RegExp(field.pattern, "im"));
      if (m) return (m[1] ?? m[0]).trim();
    } catch {
      return ""; // invalid user regex — treat as no match
    }
    return "";
  }
  const label = escapeRe(field.label.trim());
  // "Label: value" / "Label - value" / "Label<TAB>value" on one line
  const inline = body.match(new RegExp(`^[ \\t]*${label}[ \\t]*[:\\-–\\t][ \\t]*(.+)$`, "im"));
  if (inline?.[1]) return inline[1].trim();
  // Label alone on a line, value on the following non-empty line
  const block = body.match(new RegExp(`^[ \\t]*${label}[ \\t]*$\\n+^[ \\t]*(.+)$`, "im"));
  if (block?.[1]) return block[1].trim();
  return "";
}

export function extractAll(body: string, fields: EmailFieldDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = extractField(body, f);
    if (v !== "") out[f.key] = v;
  }
  return out;
}
