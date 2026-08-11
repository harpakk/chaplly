"use client";

import { useState } from "react";
import { Eye, ShoppingBag, Sparkles } from "lucide-react";

const format = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

export function IncomeCalculator() {
  const [mode, setMode] = useState<"views"|"sales">("views");
  const [views, setViews] = useState(1_000_000);
  const [conversion, setConversion] = useState(0.0001);
  const [sales, setSales] = useState(50);
  const [price, setPrice] = useState(10_000_000);
  const calculatedSales = mode === "views" ? Math.max(1, Math.round(views * conversion)) : sales;
  const revenue = calculatedSales * price;

  return (
    <div className="income-calculator">
      <div className="calc-switch">
        <button className={mode==="views"?"active":""} onClick={()=>setMode("views")}><Eye /> براساس بازدید اینستاگرام</button>
        <button className={mode==="sales"?"active":""} onClick={()=>setMode("sales")}><ShoppingBag /> براساس تعداد فروش</button>
      </div>
      <div className="calc-body">
        <div className="calc-inputs">
          {mode === "views" ? <>
            <Range label="بازدید ماهانه پیج" value={views} min={100_000} max={50_000_000} step={100_000} onChange={setViews} display={`${format(views)} بازدید`} />
            <Range label="نرخ تبدیل بازدید به خرید" value={conversion} min={0.00001} max={0.1} step={0.00001} onChange={setConversion} display={`${new Intl.NumberFormat("fa-IR",{maximumFractionDigits:3}).format(conversion * 100)}٪`} />
          </> : <Range label="تعداد فروش ماهانه" value={sales} min={10} max={500} step={1} onChange={setSales} display={`${format(sales)} فروش`} />}
          <Range label="میانگین قیمت محصول" value={price} min={5_000_000} max={30_000_000} step={500_000} onChange={setPrice} display={`${format(price)} ریال`} />
        </div>
        <aside className="calc-result">
          <span><Sparkles /> تخمین ماهانه تو</span>
          <div><small>تعداد فروش</small><strong>{format(calculatedSales)}</strong></div>
          <div className="revenue"><small>فروش کل</small><strong>{format(revenue)} <i>ریال</i></strong><em>حدود {format(revenue / 10)} تومان</em></div>
        </aside>
      </div>
    </div>
  );
}

function Range({label,value,min,max,step,onChange,display}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void;display:string}) {
  const progress = ((value-min)/(max-min))*100;
  return <label className="calc-range"><span><b>{label}</b><output>{display}</output></span><input aria-label={label} style={{"--range-progress":`${progress}%`} as React.CSSProperties} type="range" min={min} max={max} step={step} value={value} onChange={(event)=>onChange(Number(event.target.value))}/><small><i>{format(min)}</i><i>{format(max)}</i></small></label>;
}
