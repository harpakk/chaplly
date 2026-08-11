"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus } from "lucide-react";
import {
  supplierLoginAction,
  supplierRegisterAction,
  SupplierAuthState,
} from "@/app/actions/supplier-auth";
import { SavingOverlay } from "@/components/saving-overlay";

const F = ({
  name,
  label,
  type = "text",
  required = true,
  placeholder = "",
  error,
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string[];
  autoComplete?: string;
}) => (
  <label className="field">
    <span>
      {label}
      {required && " *"}
    </span>
    <input
      className={error ? "input input-error" : "input"}
      name={name}
      id={name}
      type={type}
      required={required}
      placeholder={placeholder}
      autoComplete={autoComplete}
      aria-invalid={Boolean(error)}
    />
    {error && <small className="field-error">{error[0]}</small>}
  </label>
);

export function SupplierLoginForm() {
  const [state, action, pending] = useActionState<SupplierAuthState, FormData>(
    supplierLoginAction,
    {},
  );
  return (
    <form action={action} className="auth-form">
      <SavingOverlay visible={pending} text="در حال ورود به پنل تأمین‌کننده…" />
      {state.message && <div className="form-alert">{state.message}</div>}
      <F name="email" label="ایمیل کاری" type="email" />
      <F name="password" label="رمز عبور" type="password" />
      <button className="button button-primary auth-submit" disabled={pending}>
        {pending ? "در حال ورود…" : "ورود به سفارش‌ها"}
      </button>
      <p className="auth-switch">
        هنوز مجموعه‌ات ثبت نشده؟{" "}
        <Link href="/supplier/register">شروع همکاری</Link>
      </p>
    </form>
  );
}

type Option = {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
};
export function SupplierRegisterForm({
  printMethods,
  categories,
}: {
  printMethods: Option[];
  categories: Option[];
}) {
  const [state, action, pending] = useActionState<SupplierAuthState, FormData>(
    supplierRegisterAction,
    {},
  );
  const [step, setStep] = useState(1),
    ref = useRef<HTMLFormElement>(null);
  const [stepError, setStepError] = useState("");
  const [logoPreview, setLogoPreview] = useState(""),
    [bannerPreview, setBannerPreview] = useState("");
  useEffect(() => {
    const raw = sessionStorage.getItem("chapli_supplier_signup");
    if (!raw || !ref.current) return;
    const values = JSON.parse(raw) as Record<string, string | boolean>;
    Object.entries(values).forEach(([key, value]) => {
      const element = ref.current?.elements.namedItem(key);
      if (element instanceof HTMLInputElement) {
        if (element.type === "checkbox") element.checked = Boolean(value);
        else if (element.type !== "file" && element.type !== "password")
          element.value = String(value);
      } else if (element instanceof HTMLTextAreaElement)
        element.value = String(value);
    });
  }, []);
  const save = () => {
    if (!ref.current) return;
    const values: Record<string, string | boolean> = {};
    Array.from(ref.current.elements).forEach((element) => {
      if (!(element instanceof HTMLInputElement) || !element.name) return;
      if (element.type === "password" || element.type === "file") return;
      values[element.name] =
        element.type === "checkbox" ? element.checked : element.value;
    });
    sessionStorage.setItem("chapli_supplier_signup", JSON.stringify(values));
  };
  const validateControl = (input: HTMLInputElement) => {
    input.setCustomValidity("");
    const value = input.value.trim();
    if (
      ["firstName", "lastName", "displayName", "city"].includes(input.name) &&
      value.length < 2
    )
      input.setCustomValidity("حداقل ۲ کاراکتر وارد کن.");
    if (input.name === "address" && value.length < 5)
      input.setCustomValidity("آدرس کامل‌تری وارد کن.");
    if (input.name === "phone" && !/^(\+98|0)?9\d{9}$/.test(value))
      input.setCustomValidity("شماره موبایل معتبر وارد کن.");
    if (
      input.name === "password" &&
      (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value))
    )
      input.setCustomValidity(
        "رمز باید حداقل ۸ کاراکتر و شامل حرف انگلیسی و عدد باشد.",
      );
    if (input.name === "confirmPassword") {
      const password =
        (ref.current?.elements.namedItem("password") as HTMLInputElement | null)
          ?.value || "";
      if (value !== password)
        input.setCustomValidity("تکرار رمز عبور یکسان نیست.");
    }
    return input.checkValidity();
  };
  const validateStep = (target: number) => {
    const section = ref.current?.querySelector<HTMLElement>(
      `section[data-step="${target}"]`,
    );
    if (!section) return false;
    const inputs = Array.from(
      section.querySelectorAll<HTMLInputElement>("input"),
    );
    const invalid = inputs.find((input) => !validateControl(input));
    if (invalid) {
      setStepError("برای ادامه، فیلد مشخص‌شده را کامل و درست وارد کن.");
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    setStepError("");
    return true;
  };
  const next = () => {
    if (validateStep(step)) setStep((value) => Math.min(4, value + 1));
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(4) || pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
  const serverErrors = Object.values(state.errors || {}).flatMap(
    (messages) => messages || [],
  );
  return (
    <form
      ref={ref}
      onSubmit={submit}
      className="auth-form onboarding-form"
      onInput={save}
      encType="multipart/form-data"
      noValidate
    >
      <SavingOverlay visible={pending} text="در حال ساخت حساب تأمین‌کننده…" />
      <ol className="onboarding-progress">
        {["مالک حساب", "مجموعه", "عملیات", "تأیید"].map((label, index) => (
          <li
            className={
              step === index + 1 ? "active" : step > index + 1 ? "done" : ""
            }
            key={label}
          >
            <i>{step > index + 1 ? <Check /> : index + 1}</i>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      {(state.message || serverErrors.length > 0) && (
        <div className="form-alert" role="alert">
          <b>{state.message || "ثبت‌نام انجام نشد؛ اطلاعاتت حفظ شده است."}</b>
          {serverErrors.length > 0 && (
            <ul>
              {serverErrors.map((message, index) => (
                <li key={`${message}-${index}`}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {stepError && (
        <div className="form-alert form-alert-local" role="alert">
          {stepError}
        </div>
      )}
      <section data-step="1" hidden={step !== 1}>
        <div className="step-copy">
          <small>۱ از ۴</small>
          <h2>مالک حساب</h2>
          <p>اطلاعات فردی که دسترسی اصلی پنل را دارد.</p>
        </div>
        <div className="form-row">
          <F
            name="firstName"
            label="نام"
            autoComplete="given-name"
            error={state.errors?.firstName}
          />
          <F
            name="lastName"
            label="نام خانوادگی"
            autoComplete="family-name"
            error={state.errors?.lastName}
          />
        </div>
        <div className="form-row">
          <F
            name="phone"
            label="موبایل"
            type="tel"
            autoComplete="tel"
            error={state.errors?.phone}
          />
          <F
            name="email"
            label="ایمیل کاری"
            type="email"
            autoComplete="email"
            error={state.errors?.email}
          />
        </div>
        <div className="form-row">
          <F
            name="password"
            label="رمز عبور"
            type="password"
            autoComplete="new-password"
            error={state.errors?.password}
          />
          <F
            name="confirmPassword"
            label="تکرار رمز عبور"
            type="password"
            autoComplete="new-password"
            error={state.errors?.confirmPassword}
          />
        </div>
      </section>
      <section data-step="2" hidden={step !== 2}>
        <div className="step-copy">
          <small>۲ از ۴</small>
          <h2>معرفی مجموعه</h2>
          <p>
            فقط نام مجموعه الزامی است؛ اطلاعات ثبتی را در صورت نیاز وارد کن.
          </p>
        </div>
        <F name="displayName" label="نام مجموعه" />
        <div className="form-row">
          <F name="legalName" label="نام رسمی شرکت" required={false} />
          <F name="website" label="وب‌سایت" required={false} />
        </div>
        <div className="form-row">
          <F name="nationalId" label="شناسه ملی" required={false} />
          <F name="registrationNumber" label="شماره ثبت" required={false} />
        </div>
      </section>
      <section data-step="3" hidden={step !== 3}>
        <div className="step-copy">
          <small>۳ از ۴</small>
          <h2>عملیات تولید</h2>
          <p>
            آدرس، شهر و زمان آماده‌سازی برای تخصیص سفارش لازم‌اند؛ باقی موارد
            اختیاری‌اند.
          </p>
        </div>
        <div className="form-row">
          <F name="city" label="شهر مرکز تولید" />
          <F name="postalCode" label="کدپستی" required={false} />
        </div>
        <F name="address" label="آدرس مرکز تولید" />
        <div className="form-row">
          <F
            name="capacityPerDay"
            label="ظرفیت روزانه"
            type="number"
          />
          <small className="capacity-hint">
            ظرفیت کمتر از ۲۰ قابل ثبت است، اما برای دریافت سفارش‌های بیشتر بهتر است عدد بالاتری وارد کنید.
          </small>
          <F name="leadTimeDays" label="زمان آماده‌سازی (روز)" type="number" />
        </div>
        <ChoiceGroup
          title="روش‌های چاپ"
          name="methodIds"
          options={printMethods}
        />
        <ChoiceGroup
          title="دسته‌های قابل تأمین"
          name="categoryIds"
          options={categories}
        />
      </section>
      <section data-step="4" hidden={step !== 4}>
        <div className="step-copy">
          <small>۴ از ۴</small>
          <h2>تصاویر و تسویه</h2>
          <p>
            لوگو، بنر و اطلاعات بانکی اختیاری‌اند و بعداً هم قابل تکمیل هستند.
          </p>
        </div>
        <div className="form-row">
          <F name="cardNumber" label="شماره کارت" required={false} />
          <F name="iban" label="شماره شبا" required={false} />
        </div>
        <div className="store-media-upload supplier-media-upload">
          <MediaInput
            name="supplierLogo"
            label="لوگوی مجموعه"
            preview={logoPreview}
            setPreview={setLogoPreview}
          />
          <MediaInput
            name="supplierBanner"
            label="بنر یا تصویر کارگاه"
            preview={bannerPreview}
            setPreview={setBannerPreview}
            banner
          />
        </div>
        <label className="checkbox-field">
          <input name="terms" type="checkbox" required />
          <span>
            قوانین همکاری، کیفیت تولید و محرمانگی فایل‌های چاپ را می‌پذیرم.
          </span>
        </label>
        <button
          className="button button-primary auth-submit"
          disabled={pending}
        >
          {pending ? "در حال ساخت حساب…" : "ثبت مجموعه و ورود"}
        </button>
      </section>
      <div className="onboarding-nav">
        {step > 1 && (
          <button
            type="button"
            onClick={() => {
              setStepError("");
              setStep(step - 1);
            }}
          >
            <ArrowRight /> قبلی
          </button>
        )}
        {step < 4 && (
          <button className="next" type="button" onClick={next}>
            ادامه <ArrowLeft />
          </button>
        )}
      </div>
    </form>
  );
}

function ChoiceGroup({
  title,
  name,
  options,
}: {
  title: string;
  name: string;
  options: Option[];
}) {
  return (
    <fieldset className="supplier-choice-group">
      <legend>{title}</legend>
      <div>
        {options.map((option) => (
          <label key={option.id}>
            <input type="checkbox" name={name} value={option.id} />
            <span>
              <b>{option.name}</b>
              {option.description && <small>{option.description}</small>}
            </span>
          </label>
        ))}
      </div>
      {!options.length && <p>فعلاً گزینه فعالی در دیتابیس ثبت نشده است.</p>}
    </fieldset>
  );
}

function MediaInput({
  name,
  label,
  preview,
  setPreview,
  banner = false,
}: {
  name: string;
  label: string;
  preview: string;
  setPreview: (value: string) => void;
  banner?: boolean;
}) {
  return (
    <label className={banner ? "banner-upload" : ""}>
      <span
        className={preview ? "has-preview" : ""}
        style={preview ? { backgroundImage: `url("${preview}")` } : undefined}
      >
        {preview ? "" : <ImagePlus />}
      </span>
      <b>{label}</b>
      <small>اختیاری · PNG، JPG یا WebP</small>
      <input
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setPreview(URL.createObjectURL(file));
        }}
      />
    </label>
  );
}
