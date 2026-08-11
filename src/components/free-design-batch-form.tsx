"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { saveFreeDesignAction } from "@/app/actions/dashboard";

type Style = { id: string; name: string; status: string };

export function FreeDesignBatchForm({ styles }: { styles: Style[] }) {
  const [files, setFiles] = useState<string[]>([]);
  const activeStyles = styles.filter((style) => style.status === "ACTIVE");
  return (
    <ActionForm
      action={saveFreeDesignAction}
      className="free-design-form free-design-batch-form"
      onSuccess={() => setFiles([])}
      savingText="در حال بارگذاری مجموعه طرح‌ها…"
    >
      <label>
        عنوان مشترک همه طرح‌ها
        <input name="title" required />
      </label>
      <label>
        فایل‌های تصویر
        <input
          name="designFile"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          required
          onChange={(event) =>
            setFiles(Array.from(event.target.files || [], (file) => file.name))
          }
        />
      </label>
      {files.length > 0 && (
        <div className="free-design-batch-list">
          {files.map((fileName, index) => (
            <label key={`${fileName}:${index}`}>
              <span>{fileName}</span>
              <select name="graphicStyleId" required defaultValue="">
                <option value="" disabled>انتخاب دسته گرافیکی</option>
                {activeStyles.map((style) => (
                  <option value={style.id} key={style.id}>{style.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <button disabled={!files.length}>
        <ImagePlus /> بارگذاری {files.length.toLocaleString("fa-IR")} طرح
      </button>
    </ActionForm>
  );
}
