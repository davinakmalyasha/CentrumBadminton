import type { Cell } from "write-excel-file/node";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Neutralise a leading formula character.
 *
 * Spreadsheet apps may evaluate cells that start with = + - @. An
 * apostrophe prefix is the standard neutraliser. write-excel-file writes
 * strings as text unless `type: "Formula"` is set, so this is
 * belt-and-braces plus visible to a human inspecting the cell.
 *
 * A leading apostrophe that the user actually typed is left alone -- it
 * is already inert.
 */
export function xlsxSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Build an XLSX file in memory. Node-only; never import from a client
 * component. Returns the raw bytes so the route can wrap them in a
 * NextResponse without depending on a specific HTTP layer.
 */
export async function buildXlsx(
  headers: string[],
  rows: Array<Array<string | number>>,
  sheet: string,
  columnWidth: number
): Promise<Uint8Array<ArrayBuffer>> {
  // Node build of write-excel-file returns a Buffer without touching disk.
  const { default: writeXlsxFile } = await import("write-excel-file/node");

  const data: Cell[][] = [
    headers.map(
      (value): Cell => ({
        value,
        fontWeight: "bold",
        backgroundColor: "#EEF2F7",
      })
    ),
    ...rows.map((row) =>
      row.map((value): Cell =>
        typeof value === "string" ? { value: xlsxSafe(value) } : { value }
      )
    ),
  ];

  const buffer = await writeXlsxFile(data, {
    sheet,
    columns: headers.map(() => ({ width: columnWidth })),
  }).toBuffer();

  // Copy into a fresh ArrayBuffer-backed view so the return type is
  // portable (Buffer's backing store is ArrayBufferLike).
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes;
}
