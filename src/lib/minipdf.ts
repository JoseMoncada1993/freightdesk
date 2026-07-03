// Minimal dependency-free PDF writer: enough to draw text, lines and boxes
// on US-Letter pages using the built-in Helvetica fonts. Used by bol.ts.
// Coordinates are PDF-style: origin bottom-left, points (1/72 inch).

export const LETTER = { width: 612, height: 792 };

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// Rough Helvetica width factor (avg glyph width ≈ 0.5 em) for alignment math.
export const textWidth = (s: string, size: number) => s.length * size * 0.5;

export class MiniPdf {
  private ops: string[] = [];

  text(x: number, y: number, s: string, size = 8, opts?: { bold?: boolean; gray?: number }) {
    if (!s) return;
    const font = opts?.bold ? "/F2" : "/F1";
    const g = opts?.gray ?? 0;
    this.ops.push(
      `BT ${font} ${size} Tf ${g} ${g} ${g} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapeText(s)}) Tj ET`,
    );
  }

  textCenter(cx: number, y: number, s: string, size = 8, opts?: { bold?: boolean; gray?: number }) {
    this.text(cx - textWidth(s, size) / 2, y, s, size, opts);
  }

  textRight(rx: number, y: number, s: string, size = 8, opts?: { bold?: boolean; gray?: number }) {
    this.text(rx - textWidth(s, size), y, s, size, opts);
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.7, gray = 0) {
    this.ops.push(
      `${width} w ${gray} ${gray} ${gray} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  rect(x: number, y: number, w: number, h: number, width = 0.7) {
    this.ops.push(`${width} w 0 0 0 RG ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }

  fillRect(x: number, y: number, w: number, h: number, gray = 0.85) {
    this.ops.push(`${gray} ${gray} ${gray} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  /** Serialize a single-page PDF document. */
  build(): Uint8Array {
    const content = this.ops.join("\n");
    const objects: string[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>"); // 1
    objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"); // 2
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LETTER.width} ${LETTER.height}] ` +
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    ); // 3
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // 4
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"); // 5
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`); // 6

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return bytes;
  }
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
