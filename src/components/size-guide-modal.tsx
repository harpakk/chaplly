"use client";

import { useState } from "react";
import { Ruler, X } from "lucide-react";
import type { ProductSizeGuide } from "@/lib/catalog-data";

export function SizeGuideModal({ guide }: { guide: ProductSizeGuide }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="size-guide-button" onClick={() => setOpen(true)}>
        <Ruler /> راهنمای سایز
      </button>
      {open && (
        <div className="size-guide-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="size-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="size-guide-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><Ruler /><h2 id="size-guide-title">راهنمای سایز</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="بستن"><X /></button></header>
            <div className="size-guide-table-wrap">
              <table>
                <thead><tr>{guide.columns.map((column, index) => <th key={index}>{column}</th>)}</tr></thead>
                <tbody>{guide.rows.map((row, rowIndex) => <tr key={rowIndex}>{guide.columns.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] || "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
