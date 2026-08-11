"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { deleteTutorialAction, saveTutorialAction } from "@/app/actions/dashboard";
import type { getAdminTutorialData } from "@/lib/dashboard-data";

type Tutorial = Awaited<ReturnType<typeof getAdminTutorialData>>[number];

export function AdminTutorialConsole({ tutorials }: { tutorials: Tutorial[] }) {
  const [editing,setEditing]=useState<Tutorial|null|undefined>(undefined);
  return <div className="admin-page" dir="rtl">
    <div className="admin-page-title"><div><span>محتوای راهنما</span><h1>مدیریت آموزش‌ها</h1></div><button onClick={()=>setEditing(null)}><Plus/> آموزش جدید</button></div>
    <div className="tutorial-admin-grid">{tutorials.map(item=><article key={item.id}>
      {item.thumbnailUrl?<Image src={item.thumbnailUrl} alt="" width={600} height={340} unoptimized/>:<div className="tutorial-admin-placeholder"><BookOpen/></div>}
      <div><span>{item.status} · {item.difficulty}</span><h2>{item.title}</h2><p>{item.summary||item.description}</p><small>{item.duration_minutes||0} دقیقه · ترتیب {item.sort_order}</small></div>
      <footer><button onClick={()=>setEditing(item)}><Pencil/> ویرایش</button><ActionForm action={deleteTutorialAction} confirmMessage="این آموزش و سابقه پیشرفت آن حذف شود؟"><input type="hidden" name="id" value={item.id}/><button className="danger"><Trash2/> حذف</button></ActionForm></footer>
    </article>)}</div>
    {!tutorials.length&&<div className="empty-state"><BookOpen/><h2>هنوز آموزشی ساخته نشده است</h2></div>}
    {editing!==undefined&&<div className="admin-modal-back"><ActionForm action={saveTutorialAction} className="admin-modal tutorial-admin-form" onSuccess={()=>setEditing(undefined)}>
      <button type="button" className="modal-close" onClick={()=>setEditing(undefined)}><X/></button><span>{editing?"ویرایش آموزش":"آموزش جدید"}</span><h2>{editing?.title||"ساخت آموزش فروشندگان"}</h2>
      <input type="hidden" name="id" value={editing?.id||""}/><input type="hidden" name="thumbnailFileId" value={editing?.thumbnail_file_id||""}/>
      <label>عنوان<input name="title" required minLength={3} defaultValue={editing?.title}/></label>
      <label>خلاصه<input name="summary" defaultValue={editing?.summary||""}/></label>
      <label>توضیحات<textarea name="description" required minLength={10} rows={4} defaultValue={editing?.description}/></label>
      <label>محتوای آموزش <small>هر بخش را با یک خط خالی جدا کنید.</small><textarea name="content" rows={8} defaultValue={Array.isArray(editing?.content)?editing.content.map((part)=>typeof part==="object"&&part&&"body" in part?String(part.body):"").filter(Boolean).join("\n\n"):""}/></label>
      <label>نتایج یادگیری <small>هر مورد در یک خط</small><textarea name="learningOutcomes" rows={4} defaultValue={editing?.learning_outcomes?.join("\n")}/></label>
      <div className="tutorial-form-row"><label>سطح<select name="difficulty" defaultValue={editing?.difficulty||"BEGINNER"}><option value="BEGINNER">مقدماتی</option><option value="INTERMEDIATE">متوسط</option><option value="ADVANCED">پیشرفته</option></select></label><label>مدت (دقیقه)<input name="durationMinutes" type="number" min="1" defaultValue={editing?.duration_minutes||5}/></label><label>ترتیب<input name="sortOrder" type="number" defaultValue={editing?.sort_order||0}/></label><label>وضعیت<select name="status" defaultValue={editing?.status||"DRAFT"}><option value="DRAFT">پیش‌نویس</option><option value="PUBLISHED">منتشرشده</option><option value="ARCHIVED">بایگانی</option></select></label></div>
      <label>تصویر شاخص {editing&&<small>برای حفظ تصویر فعلی خالی بگذارید.</small>}<input name="thumbnail" type="file" accept="image/*" required={!editing}/></label><button>ذخیره آموزش</button>
    </ActionForm></div>}
  </div>;
}
