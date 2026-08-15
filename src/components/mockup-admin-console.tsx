"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import type { getAdminMockupData } from "@/lib/dashboard-data";
import { ActionForm } from "@/components/action-form";
import { MockupPlacementField } from "@/components/mockup-placement-field";
import {
  deleteRawProductMockupAction,
  saveRawProductMockupAction,
} from "@/app/actions/dashboard";

type Data = Awaited<ReturnType<typeof getAdminMockupData>>;
type Side = "FRONT" | "BACK";

export function MockupAdminConsole({ data }: { data: Data }) {
  const firstRaw = data.rawProducts[0];
  const [editing, setEditing] = useState<string | null>(null);
  const [rawId, setRawId] = useState(firstRaw?.id || "");
  const [side, setSide] = useState<Side>("FRONT");
  const [imageResetSignal, setImageResetSignal] = useState(0);
  const [name, setName] = useState("");
  const [colorId, setColorId] = useState(
    firstRaw?.colors.find((color) => color.status === "ACTIVE")?.id || "",
  );
  const [gender, setGender] = useState("UNISEX");
  const [listRawFilter, setListRawFilter] = useState("ALL");
  const [listSideFilter, setListSideFilter] = useState("ALL");
  const [listColorFilter, setListColorFilter] = useState("ALL");
  const [listGenderFilter, setListGenderFilter] = useState("ALL");
  const record = data.mockups.find((item) => item.id === editing);
  const raw = data.rawProducts.find((item) => item.id === rawId);
  const initialView = record?.views[0];
  const listColors = data.rawProducts
    .filter((item) => listRawFilter === "ALL" || item.id === listRawFilter)
    .flatMap((item) =>
      item.colors.map((color) => ({ ...color, productName: item.name })),
    );
  const filteredMockups = data.mockups.filter(
    (mockup) =>
      (listRawFilter === "ALL" || mockup.raw_product_id === listRawFilter) &&
      (listSideFilter === "ALL" || mockup.side === listSideFilter) &&
      (listColorFilter === "ALL" || mockup.color_id === listColorFilter) &&
      (listGenderFilter === "ALL" || mockup.gender === listGenderFilter),
  );

  const openNew = () => {
    setRawId(firstRaw?.id || "");
    setSide("FRONT");
    setName("");
    setColorId(
      firstRaw?.colors.find((color) => color.status === "ACTIVE")?.id || "",
    );
    setGender("UNISEX");
    setEditing("new");
  };
  const openEdit = (id: string) => {
    const mockup = data.mockups.find((item) => item.id === id);
    if (!mockup) return;
    setRawId(mockup.raw_product_id);
    setSide(mockup.side as Side);
    setName(mockup.name);
    setColorId(mockup.color_id || "");
    setGender(mockup.gender || "UNISEX");
    setEditing(id);
  };
  const changeRaw = (nextId: string) => {
    const nextRaw = data.rawProducts.find((item) => item.id === nextId);
    setRawId(nextId);
    setColorId(
      nextRaw?.colors.find((color) => color.status === "ACTIVE")?.id || "",
    );
    if (!nextRaw?.has_back) setSide("FRONT");
  };
  const navigateEdit = (direction: -1 | 1) => {
    if (!record || !filteredMockups.length) return;
    const currentIndex = filteredMockups.findIndex((item) => item.id === record.id);
    const nextIndex = (currentIndex + direction + filteredMockups.length) % filteredMockups.length;
    openEdit(filteredMockups[nextIndex].id);
  };

  return (
    <div className="admin-page mockup-admin">
      <div className="admin-page-title">
        <div>
          <span>ابزار تولید تصویر</span>
          <h1>موکاپ‌های تک‌نما</h1>
          <p>
            هر موکاپ فقط یک تصویر جلو یا پشت دارد و محدوده طرح دقیقاً هم‌نسبت
            با محدوده چاپ محصول خام است.
          </p>
        </div>
        <button
          className="admin-primary"
          onClick={openNew}
          disabled={!firstRaw}
        >
          <Plus /> موکاپ جدید
        </button>
      </div>

      {editing && raw && (
        <div className="raw-edit-backdrop">
          <div className="raw-edit-dialog mockup-dialog">
            {record && filteredMockups.length > 1 && <div className="mockup-edit-navigation">
              <button type="button" onClick={() => navigateEdit(-1)}><ChevronRight /> قبلی</button>
              <span>{(filteredMockups.findIndex((item) => item.id === record.id) + 1).toLocaleString("fa-IR")} از {filteredMockups.length.toLocaleString("fa-IR")}</span>
              <button type="button" onClick={() => navigateEdit(1)}>بعدی <ChevronLeft /></button>
            </div>}
            <button
              className="raw-edit-close"
              onClick={() => setEditing(null)}
              aria-label="بستن"
            >
              <X />
            </button>
            <ActionForm
              key={record?.id || `new:${rawId}:${side}`}
              action={saveRawProductMockupAction}
              className="admin-card mockup-form"
              onSuccess={() => {
                if (!record)
                  setImageResetSignal((value) => value + 1);
              }}
              showSavingOverlay={Boolean(record)}
              backgroundConcurrent={!record}
              savingText="در حال ذخیره موکاپ تک‌نما…"
            >
              {record && <input type="hidden" name="id" value={record.id} />}
              <div className="mockup-form-heading">
                <div>
                  <span>{record ? "ویرایش موکاپ" : "موکاپ جدید"}</span>
                  <h2>{record?.name || "تصویر و محدوده طرح را تنظیم کن"}</h2>
                </div>
                <small>
                  محصول و نما پس از ساخت ثابت می‌مانند. برای نمای دیگر یک موکاپ
                  جدا بساز.
                </small>
              </div>
              <div className="form-grid mockup-identity-grid">
                <label>
                  نام موکاپ
                  <input
                    name="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  محصول خام
                  <select
                    name={record ? undefined : "rawProductId"}
                    value={rawId}
                    disabled={Boolean(record)}
                    onChange={(event) => changeRaw(event.target.value)}
                  >
                    {data.rawProducts.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {record && (
                    <input type="hidden" name="rawProductId" value={rawId} />
                  )}
                </label>
                <label>
                  نمای موکاپ
                  <select
                    name={record ? undefined : "side"}
                    value={side}
                    disabled={Boolean(record)}
                    onChange={(event) => setSide(event.target.value as Side)}
                  >
                    <option value="FRONT">نمای جلو</option>
                    <option value="BACK" disabled={!raw.has_back}>
                      نمای پشت {!raw.has_back ? "(این محصول پشت ندارد)" : ""}
                    </option>
                  </select>
                  {record && <input type="hidden" name="side" value={side} />}
                </label>
                <label>
                  رنگ موکاپ
                  <select
                    name="colorId"
                    required
                    value={colorId}
                    onChange={(event) => setColorId(event.target.value)}
                  >
                    <option value="" disabled>انتخاب رنگ</option>
                    {raw.colors.filter((color) => color.status === "ACTIVE").map((color) => <option value={color.id} key={color.id}>{color.name}</option>)}
                  </select>
                </label>
                <label>
                  جنسیت
                  <select
                    name="gender"
                    required
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                  >
                    <option value="MALE">مردانه</option>
                    <option value="FEMALE">زنانه</option>
                    <option value="UNISEX">یونیسکس</option>
                  </select>
                </label>
              </div>
              <div className="mockup-side-summary">
                <ImageIcon />
                <div>
                  <b>
                    {raw.name} · {side === "FRONT" ? "نمای جلو" : "نمای پشت"}
                  </b>
                  <span>محدوده و نقاط پرسپکتیو را مستقیماً روی تصویر تنظیم کنید.</span>
                </div>
              </div>
              <MockupPlacementField
                key={`${record?.id || "new"}:${rawId}:${side}`}
                label={side === "FRONT" ? "موکاپ نمای جلو" : "موکاپ نمای پشت"}
                initial={initialView}
                initialImage={initialView?.backgroundUrl}
                initialTestImage={data.testImageUrl}
                resetImageSignal={record ? 0 : imageResetSignal}
              />
              <button className="admin-primary mockup-save-button">
                ذخیره موکاپ {side === "FRONT" ? "جلو" : "پشت"}
              </button>
            </ActionForm>
          </div>
        </div>
      )}

      <div className="mockup-admin-filters">
        <label>محصول خام
          <select value={listRawFilter} onChange={(event) => { setListRawFilter(event.target.value); setListColorFilter("ALL"); }}>
            <option value="ALL">همه محصولات</option>
            {data.rawProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>نما
          <select value={listSideFilter} onChange={(event) => setListSideFilter(event.target.value)}>
            <option value="ALL">جلو و پشت</option><option value="FRONT">جلو</option><option value="BACK">پشت</option>
          </select>
        </label>
        <label>رنگ
          <select value={listColorFilter} onChange={(event) => setListColorFilter(event.target.value)}>
            <option value="ALL">همه رنگ‌ها</option>
            {listColors.map((color) => <option key={color.id} value={color.id}>{listRawFilter === "ALL" ? `${color.productName} — ` : ""}{color.name}</option>)}
          </select>
        </label>
        <label>جنسیت
          <select value={listGenderFilter} onChange={(event) => setListGenderFilter(event.target.value)}>
            <option value="ALL">همه</option><option value="MALE">مردانه</option><option value="FEMALE">زنانه</option><option value="UNISEX">یونیسکس</option>
          </select>
        </label>
      </div>
      <section className="mockup-admin-grid">
        {filteredMockups.map((mockup) => {
          const view = mockup.views[0];
          const product = data.rawProducts.find(
            (item) => item.id === mockup.raw_product_id,
          );
          return (
            <article key={mockup.id}>
              <div>
                {view?.backgroundUrl ? (
                  <Image
                    src={view.backgroundUrl}
                    alt={mockup.name}
                    width={600}
                    height={480}
                  />
                ) : (
                  <ImageIcon />
                )}
                <em className={mockup.side.toLowerCase()}>
                  {mockup.side === "BACK" ? "پشت" : "جلو"}
                </em>
              </div>
              <section>
                <small>{product?.name || "محصول خام ناموجود"}</small>
                <h3>{mockup.name}</h3>
                <div className="mockup-attribute-tags">
                  <span>{product?.colors.find((color) => color.id === mockup.color_id)?.name || "بدون رنگ"}</span>
                  <span>{mockup.gender === "MALE" ? "مردانه" : mockup.gender === "FEMALE" ? "زنانه" : "یونیسکس"}</span>
                </div>
                <p>
                  موکاپ تک‌نمای {mockup.side === "BACK" ? "پشت" : "جلو"}
                  {mockup.needs_alignment ? " · نیازمند بازتنظیم" : ""}
                </p>
                <div className="mockup-card-actions">
                  <button type="button" onClick={() => openEdit(mockup.id)}>
                    <Pencil /> ویرایش
                  </button>
                  <ActionForm
                    action={deleteRawProductMockupAction}
                    confirmMessage="این موکاپ برای همیشه حذف شود؟"
                  >
                    <input type="hidden" name="id" value={mockup.id} />
                    <button type="submit" className="mockup-delete-button">
                      <Trash2 /> حذف
                    </button>
                  </ActionForm>
                </div>
              </section>
            </article>
          );
        })}
      </section>
    </div>
  );
}
