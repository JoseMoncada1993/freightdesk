// Bill of Lading PDF generator. Recreates the short-form VICS layout from
// templates/BOL Template.xlsx, filled from a shipment (loads_enriched row).
// Blank items print as fill-in lines so the paper copy stays usable.
import { MiniPdf, LETTER, downloadPdf } from "./minipdf";
import type { LoadEnriched } from "./types";

const W = LETTER.width;
const M = 30; // margin
const MID = W / 2 + 20; // split between left blocks and right blocks

const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));

function cityLine(city?: string | null, state?: string | null, zip?: string | null) {
  const left = [city, state].filter(Boolean).join(", ");
  return [left, zip].filter(Boolean).join(" ");
}

/** Header bar with centered white bold label. */
function bar(p: MiniPdf, x: number, y: number, w: number, label: string, h = 13) {
  p.fillRect(x, y, w, h, 0.25);
  p.textCenter(x + w / 2, y + 3.5, label, 8, { bold: true, gray: 1 });
}

function labeledLine(p: MiniPdf, x: number, y: number, label: string, value: string, w: number) {
  p.text(x, y, label, 7.5, { bold: true });
  const lx = x + label.length * 4 + 6;
  p.text(lx, y, value, 8);
  p.line(lx - 2, y - 2, x + w, y - 2, 0.5, 0.4);
}

export function buildBolPdf(load: LoadEnriched): Uint8Array {
  const p = new MiniPdf();
  const top = LETTER.height - 34;

  // ---------- Title ----------
  p.text(M, top, `Date: ${new Date().toLocaleDateString()}`, 8);
  p.textCenter(W / 2, top, "BILL OF LADING - SHORT FORM - NOT NEGOTIABLE", 11, { bold: true });
  p.textRight(W - M, top, "Page 1 of 1", 8);

  const leftW = MID - M - 8;
  const rightX = MID;
  const rightW = W - M - rightX;

  // ---------- Ship From ----------
  let y = top - 22;
  bar(p, M, y, leftW, "SHIP FROM");
  const sfLines = [
    s(load.shipper_name),
    [s(load.shipper_address1), s(load.shipper_address2)].filter(Boolean).join("  "),
    cityLine(load.shipper_city ?? load.origin_city, load.shipper_state ?? load.origin_state, load.shipper_zip ?? load.origin_zip),
    [s(load.shipper_contact), s(load.shipper_phone)].filter(Boolean).join("  "),
  ];
  let yy = y - 12;
  for (const line of sfLines) {
    p.text(M + 6, yy, line || " ", 8);
    p.line(M + 4, yy - 2.5, M + leftW - 4, yy - 2.5, 0.4, 0.6);
    yy -= 13;
  }
  p.rect(M, yy + 8, leftW, y - yy + 5);

  // ---------- Right block: BOL/Carrier info ----------
  let ry = y;
  bar(p, rightX, ry, rightW, "BILL OF LADING INFORMATION");
  ry -= 14;
  labeledLine(p, rightX + 6, ry, "BOL Number:", s(load.bol_number) || s(load.ref), rightW - 12); ry -= 14;
  labeledLine(p, rightX + 6, ry, "Carrier Name:", s(load.carrier_name), rightW - 12); ry -= 14;
  labeledLine(p, rightX + 6, ry, "SCAC:", s(load.carrier_scac), rightW - 12); ry -= 14;
  labeledLine(p, rightX + 6, ry, "Trailer Number:", "", rightW - 12); ry -= 14;
  labeledLine(p, rightX + 6, ry, "Seal Number:", "", rightW - 12); ry -= 14;
  labeledLine(p, rightX + 6, ry, "Pickup Date:", load.pickup_at ? new Date(load.pickup_at).toLocaleDateString() : "", rightW - 12);
  p.rect(rightX, ry - 6, rightW, y - ry + 19);

  // ---------- Ship To ----------
  y = yy - 2;
  bar(p, M, y, leftW, "SHIP TO");
  const stLines = [
    s(load.consignee_name),
    [s(load.consignee_address1), s(load.consignee_address2)].filter(Boolean).join("  "),
    cityLine(load.consignee_city ?? load.dest_city, load.consignee_state ?? load.dest_state, load.consignee_zip ?? load.dest_zip),
    [s(load.consignee_contact), s(load.consignee_phone)].filter(Boolean).join("  "),
  ];
  yy = y - 12;
  for (const line of stLines) {
    p.text(M + 6, yy, line || " ", 8);
    p.line(M + 4, yy - 2.5, M + leftW - 4, yy - 2.5, 0.4, 0.6);
    yy -= 13;
  }
  p.rect(M, yy + 8, leftW, y - yy + 5);

  // ---------- Freight charge terms (right, second block) ----------
  let ry2 = ry - 22;
  bar(p, rightX, ry2, rightW, "FREIGHT CHARGE TERMS");
  ry2 -= 14;
  p.text(rightX + 6, ry2, "Freight charges are prepaid unless marked otherwise:", 7);
  ry2 -= 13;
  p.text(rightX + 6, ry2, "Prepaid [ X ]     Collect [   ]     3rd Party [   ]", 8.5);
  ry2 -= 13;
  p.text(rightX + 6, ry2, "COD Amount: $ ______________", 8);
  p.rect(rightX, ry2 - 6, rightW, ry - 22 - ry2 + 19);

  // ---------- Third party bill to ----------
  y = yy - 2;
  bar(p, M, y, leftW, "THIRD PARTY FREIGHT CHARGES - BILL TO");
  yy = y - 12;
  const btLines = [s(load.customer_name), "", ""];
  for (const line of btLines) {
    p.text(M + 6, yy, line || " ", 8);
    p.line(M + 4, yy - 2.5, M + leftW - 4, yy - 2.5, 0.4, 0.6);
    yy -= 13;
  }
  p.rect(M, yy + 8, leftW, y - yy + 5);

  // ---------- Special instructions (full width of left col + right notes) ----------
  y = yy - 2;
  bar(p, M, y, W - 2 * M, "SPECIAL INSTRUCTIONS");
  yy = y - 12;
  const notes = s(load.notes);
  p.text(M + 6, yy, notes.slice(0, 110), 8);
  yy -= 12;
  p.text(M + 6, yy, notes.slice(110, 220), 8);
  p.rect(M, yy - 5, W - 2 * M, y - yy + 16);

  // ---------- Customer order information ----------
  y = yy - 18;
  bar(p, M, y, W - 2 * M, "CUSTOMER ORDER INFORMATION");
  const cols = [M, M + 130, M + 210, M + 280, M + 360, W - M];
  let ty = y - 13;
  p.fillRect(M, ty, W - 2 * M, 12, 0.9);
  const headers = ["CUSTOMER ORDER NO.", "# OF PACKAGES", "WEIGHT (LBS)", "PALLET/SLIP (Y/N)", "ADDITIONAL INFO"];
  headers.forEach((h, i) => p.text(cols[i] + 3, ty + 3, h, 6.5, { bold: true }));
  ty -= 14;
  // data row
  p.text(cols[0] + 3, ty + 3, s(load.ref), 8);
  p.text(cols[1] + 3, ty + 3, s(load.qty), 8);
  p.text(cols[2] + 3, ty + 3, s(load.weight_lbs), 8);
  p.text(cols[3] + 3, ty + 3, "", 8);
  p.text(cols[4] + 3, ty + 3, s(load.equipment_type), 8);
  ty -= 14;
  // empty extra row
  ty -= 0;
  // grand total row
  p.fillRect(M, ty, W - 2 * M, 12, 0.9);
  p.text(cols[0] + 3, ty + 3, "GRAND TOTAL", 7, { bold: true });
  p.text(cols[2] + 3, ty + 3, s(load.weight_lbs), 8, { bold: true });
  // grid
  for (let gy = y - 13; gy >= ty; gy -= 14) p.line(M, gy, W - M, gy, 0.4);
  p.line(M, ty, W - M, ty, 0.4);
  for (const cx of cols) p.line(cx, y, cx, ty, 0.4);
  p.rect(M, ty, W - 2 * M, y - ty);

  // ---------- Carrier information ----------
  y = ty - 18;
  bar(p, M, y, W - 2 * M, "CARRIER INFORMATION");
  const ccols = [M, M + 55, M + 110, M + 175, M + 430, M + 490, W - M];
  ty = y - 13;
  p.fillRect(M, ty, W - 2 * M, 12, 0.9);
  const cheaders = ["QTY", "TYPE", "WEIGHT (LBS)", "COMMODITY DESCRIPTION", "NMFC NO.", "CLASS"];
  cheaders.forEach((h, i) => p.text(ccols[i] + 3, ty + 3, h, 6.5, { bold: true }));
  ty -= 14;
  p.text(ccols[0] + 3, ty + 3, s(load.qty), 8);
  p.text(ccols[1] + 3, ty + 3, s(load.freight_type ?? load.equipment_type), 8);
  p.text(ccols[2] + 3, ty + 3, s(load.weight_lbs), 8);
  p.text(ccols[3] + 3, ty + 3, s(load.commodity).slice(0, 60), 8);
  ty -= 14;
  ty -= 0;
  for (let gy = y - 13; gy >= ty; gy -= 14) p.line(M, gy, W - M, gy, 0.4);
  for (const cx of ccols) p.line(cx, y, cx, ty, 0.4);
  p.rect(M, ty, W - 2 * M, y - ty);

  // ---------- Bottom legal / signature block (matches the short-form template) ----------
  const fullW = W - 2 * M;

  // word-wrap helper using the Helvetica width estimate
  const wrap = (text: string, size: number, width: number): string[] => {
    const maxChars = Math.max(10, Math.floor(width / (size * 0.5)));
    const out: string[] = [""];
    for (const word of text.split(" ")) {
      if (out[out.length - 1] !== "" && (out[out.length - 1] + " " + word).length > maxChars) out.push(word);
      else out[out.length - 1] = (out[out.length - 1] + " " + word).trim();
    }
    return out;
  };

  const wrapInto = (
    text: string, x: number, topY: number, width: number, size: number,
    opts?: { bold?: boolean; gray?: number; lineGap?: number; center?: boolean },
  ): number => {
    const gap = opts?.lineGap ?? size + 2;
    const ls = wrap(text, size, width);
    ls.forEach((ln2, i) => {
      if (opts?.center) p.textCenter(x + width / 2, topY - i * gap, ln2, size, opts);
      else p.text(x, topY - i * gap, ln2, size, opts);
    });
    return topY - (ls.length - 1) * gap; // y of last line
  };

  // Row A: declared value (left) | COD amount + fee terms (right)
  let rowTop = ty - 4;
  const leftWb = fullW * 0.62;
  const rightXb = M + leftWb;
  const rightWb = fullW - leftWb;
  const rowAH = 46;
  p.rect(M, rowTop - rowAH, leftWb, rowAH);
  p.rect(rightXb, rowTop - rowAH, rightWb, rowAH);
  wrapInto(
    'Where the rate is dependent on value, shippers are required to state specifically in writing the agreed or declared value of the property as follows: ' +
      '"The agreed or declared value of the property is specifically stated by the shipper to be not exceeding',
    M + 8, rowTop - 11, leftWb - 16, 6.5, { center: true },
  );
  p.textCenter(M + leftWb / 2, rowTop - rowAH + 8, "______________ per ______________.", 6.5);
  p.text(rightXb + 8, rowTop - 14, "COD Amount: $", 11, { bold: true });
  p.text(rightXb + 8, rowTop - rowAH + 10, "Fee terms: Collect     Prepaid X     Customer check acceptable", 7);

  // Row B: liability note (full width, bold, centered)
  rowTop -= rowAH;
  const rowBH = 16;
  p.rect(M, rowTop - rowBH, fullW, rowBH);
  p.textCenter(
    M + fullW / 2, rowTop - 11,
    "Note: Liability limitation for loss or damage in this shipment may be applicable. See 49 USC \xa7 14706(c)(1)(A) and (B).",
    8, { bold: true },
  );

  // Row C: received-subject-to (left) | carrier shall not make delivery + shipper signature (right)
  rowTop -= rowBH;
  const rowCH = 52;
  p.rect(M, rowTop - rowCH, leftWb, rowCH);
  p.rect(rightXb, rowTop - rowCH, rightWb, rowCH);
  wrapInto(
    "Received, subject to individually determined rates or contracts that have been agreed upon in writing between the carrier and " +
      "shipper, if applicable, otherwise to the rates, classifications, and rules that have been established by the carrier and are " +
      "available to the shipper, on request, and to all applicable state and federal regulations.",
    M + 8, rowTop - 11, leftWb - 16, 6.5, { center: true },
  );
  wrapInto(
    "The carrier shall not make delivery of this shipment without payment of charges and all other lawful fees.",
    rightXb + 8, rowTop - 10, rightWb - 16, 6,
  );
  p.text(rightXb + 8, rowTop - rowCH + 10, "Shipper Signature:", 11, { bold: true });

  // Row D: four signature cells
  rowTop -= rowCH;
  const rowDH = 88;
  const dw = [fullW * 0.35, fullW * 0.17, fullW * 0.2, fullW * 0.28];
  const dx = [M, M + dw[0], M + dw[0] + dw[1], M + dw[0] + dw[1] + dw[2]];
  for (let i = 0; i < 4; i++) p.rect(dx[i], rowTop - rowDH, dw[i], rowDH);

  // Cell 1: Shipper Signature/Date
  p.text(dx[0] + 6, rowTop - 13, "Shipper Signature/Date", 9.5, { bold: true });
  wrapInto(
    "This is to certify that the above named materials are properly classified, packaged, marked, and labeled, and are in proper " +
      "condition for transportation according to the applicable regulations of the DOT.",
    dx[0] + 8, rowTop - 30, dw[0] - 16, 6, { center: true },
  );
  p.line(dx[0] + 8, rowTop - rowDH + 12, dx[0] + dw[0] - 8, rowTop - rowDH + 12, 0.5);

  // Cell 2: Trailer Loaded
  p.text(dx[1] + 6, rowTop - 13, "Trailer Loaded:", 9.5, { bold: true });
  p.text(dx[1] + 8, rowTop - 30, "X  By Shipper", 8, { bold: true });
  p.text(dx[1] + 8, rowTop - 45, "    By Driver", 8);

  // Cell 3: Freight Counted
  p.text(dx[2] + 6, rowTop - 13, "Freight Counted:", 9.5, { bold: true });
  p.text(dx[2] + 8, rowTop - 30, "X  By Shipper", 8, { bold: true });
  p.text(dx[2] + 8, rowTop - 45, "    By Driver/pallets", 8);
  p.text(dx[2] + 8, rowTop - 60, "    By Driver/pieces", 8);

  // Cell 4: Carrier Signature/Pickup Date
  p.text(dx[3] + 6, rowTop - 13, "Carrier Signature/Pickup Date", 9.5, { bold: true });
  wrapInto(
    "Carrier acknowledges receipt of packages and required placards. Carrier certifies emergency response information was made " +
      "available and/or carrier has the DOT emergency response guidebook or equivalent documentation in the vehicle. Property " +
      "described above is received in good order, except as noted.",
    dx[3] + 8, rowTop - 26, dw[3] - 16, 5.5, { center: true, gray: 0.15 },
  );
  p.line(dx[3] + 8, rowTop - rowDH + 12, dx[3] + dw[3] - 8, rowTop - rowDH + 12, 0.5);

  return p.build();
}

export function downloadBols(loads: LoadEnriched[]) {
  loads.forEach((load, i) => {
    const bytes = buildBolPdf(load);
    const name = `BOL-${(load.bol_number || load.ref || `load-${load.id}`).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    // Stagger downloads slightly so browsers accept multiple files.
    setTimeout(() => downloadPdf(bytes, name), i * 350);
  });
}
