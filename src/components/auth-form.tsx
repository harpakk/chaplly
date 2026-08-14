"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Eye, EyeOff } from "lucide-react";
import type { AuthState } from "@/app/actions/auth";
import { loginAction, registerAction } from "@/app/actions/auth";
import { SavingOverlay } from "@/components/saving-overlay";

function SubmitButton({
  children,
  savingText = "در حال ورود به حساب…",
}: {
  children: React.ReactNode;
  savingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <button className="button button-primary auth-submit" disabled={pending}>
        {children}
      </button>
      <SavingOverlay visible={pending} text={savingText} />
    </>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  error,
  required = false,
  pattern,
  title,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  error?: string[];
  required?: boolean;
  pattern?: string;
  title?: string;
}) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <div className={password ? "password-input-wrap" : "field-input-wrap"}>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={error ? "input input-error" : "input"}
        id={id}
        name={id}
        placeholder={placeholder}
        type={password && visible ? "text" : type}
        required={required}
        pattern={pattern}
        title={title}
      />
      {password && <button type="button" aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff /> : <Eye />}</button>}
      </div>
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error[0]}
        </small>
      )}
    </label>
  );
}

function Select({
  id,
  label,
  children,
  required = false,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      <select className="input" id={id} name={id} required={required}>
        {children}
      </select>
    </label>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form action={action} className="auth-form" noValidate>
      {state.message && <div className="form-alert">{state.message}</div>}
      <Field
        id="email"
        label="ایمیل کاری"
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        error={state.errors?.email}
      />
      <div>
        <div className="field-heading">
          <span>رمز عبور</span>
          <Link href="/seller/forgot-password">رمز یادت رفته؟</Link>
        </div>
        <Field
          id="password"
          label=""
          type="password"
          autoComplete="current-password"
          placeholder="رمز عبور"
          error={state.errors?.password}
        />
      </div>
      <SubmitButton>ورود به پنل فروشنده</SubmitButton>
      <p className="auth-switch">
        هنوز حساب نداری؟ <Link href="/seller/register">رایگان شروع کن</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerAction,
    {},
  );
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState("");
  const [storeName, setStoreName] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const slug =
    storeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "your-shop";
  const steps = ["حساب تو", "درباره کارت", "فروشگاه", "تأیید"];
  useEffect(() => {
    try {
      const draft = JSON.parse(
        sessionStorage.getItem("chapli_seller_signup_draft") || "{}",
      ) as Record<string, string | boolean>;
      const form = formRef.current;
      if (!form) return;
      Object.entries(draft).forEach(([name, value]) => {
        const element = form.elements.namedItem(name);
        if (element instanceof HTMLInputElement) {
          if (element.type === "checkbox") element.checked = Boolean(value);
          else if (element.type !== "password" && element.type !== "file")
            element.value = String(value);
        } else if (
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        )
          element.value = String(value);
      });
      if (typeof draft.storeName === "string") setStoreName(draft.storeName);
    } catch {}
  }, []);
  const saveDraft = () => {
    const form = formRef.current;
    if (!form) return;
    const draft: Record<string, string | boolean> = {};
    Array.from(form.elements).forEach((element) => {
      if (element instanceof HTMLInputElement) {
        if (element.type === "password" || element.type === "file") return;
        draft[element.name] =
          element.type === "checkbox" ? element.checked : element.value;
      } else if (
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
        draft[element.name] = element.value;
    });
    sessionStorage.setItem("chapli_seller_signup_draft", JSON.stringify(draft));
  };
  const previewFile = (
    file: File | undefined,
    setter: (url: string) => void,
  ) => {
    if (!file) return;
    setter(URL.createObjectURL(file));
  };
  const validateControl = (
    control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ) => {
    control.setCustomValidity("");
    const value = control.value.trim();
    if (
      ["firstName", "lastName", "storeName"].includes(control.name) &&
      value.length < 2
    )
      control.setCustomValidity("حداقل ۲ کاراکتر وارد کن.");
    if (control.name === "phone" && !/^(\+98|0)?9\d{9}$/.test(value))
      control.setCustomValidity("شماره موبایل معتبر وارد کن.");
    if (
      control.name === "password" &&
      (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value))
    )
      control.setCustomValidity(
        "رمز باید حداقل ۸ کاراکتر و شامل حرف انگلیسی و عدد باشد.",
      );
    if (control.name === "confirmPassword") {
      const password =
        (
          formRef.current?.elements.namedItem(
            "password",
          ) as HTMLInputElement | null
        )?.value || "";
      if (value !== password)
        control.setCustomValidity("تکرار رمز عبور یکسان نیست.");
    }
    if (control.name === "storeDescription" && value.length < 10)
      control.setCustomValidity("توضیح فروشگاه باید حداقل ۱۰ کاراکتر باشد.");
    if (control.name === "storeSlug" && value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
      control.setCustomValidity("آدرس باید انگلیسی و بدون فاصله باشد؛ فقط حروف کوچک، عدد و خط تیره مجاز است.");
    return control.checkValidity();
  };
  const validateStep = (targetStep: number) => {
    const section = formRef.current
      ?.querySelectorAll<HTMLElement>(":scope > section")
      .item(targetStep - 1);
    if (!section) return false;
    const controls = Array.from(
      section.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea"),
    );
    const invalid = controls.find((control) => !validateControl(control));
    if (invalid) {
      setStepError("برای ادامه، فیلد مشخص‌شده را کامل و درست وارد کن.");
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    setStepError("");
    return true;
  };
  const nextStep = () => {
    if (validateStep(step)) setStep((current) => Math.min(4, current + 1));
  };
  const previousStep = () => {
    setStepError("");
    setStep((current) => Math.max(1, current - 1));
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
      ref={formRef}
      onSubmit={submit}
      className="auth-form onboarding-form"
      noValidate
      onInput={saveDraft}
    >
      <SavingOverlay visible={pending} text="در حال ساخت حساب و فروشگاهت…" />
      <ol className="onboarding-progress">
        {steps.map((item, index) => (
          <li
            className={
              step === index + 1 ? "active" : step > index + 1 ? "done" : ""
            }
            key={item}
          >
            <i>{step > index + 1 ? <Check /> : index + 1}</i>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      {(state.message || serverErrors.length > 0) && (
        <div className="form-alert" role="alert">
          <b>
            {state.message || "ثبت‌نام انجام نشد؛ اطلاعاتت سر جایش مانده است."}
          </b>
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
      <section hidden={step !== 1}>
        <div className="step-copy">
          <small>۱ از ۴</small>
          <h2>اول خودت رو بشناسیم</h2>
          <p>اطلاعات ورود و ارتباط؛ کوتاه و ضروری.</p>
        </div>
        <div className="form-row">
          <Field
            id="firstName"
            label="نام"
            autoComplete="given-name"
            placeholder="مثلاً سارا"
            error={state.errors?.firstName}
            required
          />
          <Field
            id="lastName"
            label="نام خانوادگی"
            autoComplete="family-name"
            placeholder="مثلاً احمدی"
            error={state.errors?.lastName}
            required
          />
        </div>
        <div className="form-row">
          <Field
            id="phone"
            label="شماره موبایل"
            type="tel"
            autoComplete="tel"
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
            error={state.errors?.phone}
            required
          />
          <Field
            id="email"
            label="ایمیل"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            error={state.errors?.email}
            required
          />
        </div>
        <div className="form-row">
          <Field
            id="password"
            label="رمز عبور"
            type="password"
            autoComplete="new-password"
            placeholder="حداقل ۸ کاراکتر"
            error={state.errors?.password}
            required
          />
          <Field
            id="confirmPassword"
            label="تکرار رمز"
            type="password"
            autoComplete="new-password"
            placeholder="دوباره بنویس"
            error={state.errors?.confirmPassword}
            required
          />
        </div>
      </section>
      <section hidden={step !== 2}>
        <div className="step-copy">
          <small>۲ از ۴</small>
          <h2>چه مدل کریتوری هستی؟</h2>
          <p>کمک می‌کنه شروع پنلت مناسب خودت باشه.</p>
        </div>
        <div className="form-row">
          <Select id="sellerType" label="بیشتر شبیه کدومی؟" required>
            <option value="">انتخاب کن</option>
            <option value="INFLUENCER">اینفلوئنسر / تولیدکننده محتوا</option>
            <option value="DESIGNER">گرافیست / طراح</option>
            <option value="BRAND">برند یا شرکت</option>
            <option value="ENTREPRENEUR">می‌خوام آنلاین‌شاپ بزنم</option>
          </Select>
          <Select id="experienceLevel" label="تجربه فروش آنلاین">
            <option value="NONE">هنوز شروع نکردم</option>
            <option value="BEGINNER">تازه شروع کردم</option>
            <option value="ACTIVE">الان فروش دارم</option>
            <option value="PRO">حرفه‌ای کار می‌کنم</option>
          </Select>
        </div>
        <div className="form-row">
          <Field
            id="instagramHandle"
            label="آیدی اینستاگرام"
            placeholder="@yourpage"
          />
          <Field
            id="websiteUrl"
            label="سایت فعلی (اختیاری)"
            type="url"
            placeholder="https://..."
          />
        </div>
        <div className="form-row">
          <Select id="audienceSize" label="اندازه مخاطب">
            <option value="UNDER_10K">کمتر از ۱۰ هزار</option>
            <option value="10K_100K">۱۰ تا ۱۰۰ هزار</option>
            <option value="100K_1M">۱۰۰ هزار تا ۱ میلیون</option>
            <option value="OVER_1M">بیشتر از ۱ میلیون</option>
          </Select>
          <Select id="monthlyViews" label="بازدید ماهانه تقریبی">
            <option value="UNDER_100K">کمتر از ۱۰۰ هزار</option>
            <option value="100K_1M">۱۰۰ هزار تا ۱ میلیون</option>
            <option value="1M_10M">۱ تا ۱۰ میلیون</option>
            <option value="OVER_10M">بیشتر از ۱۰ میلیون</option>
          </Select>
        </div>
      </section>
      <section hidden={step !== 3}>
        <div className="step-copy">
          <small>۳ از ۴</small>
          <h2>حالا فروشگاهت رو بسازیم</h2>
          <p>
            این اطلاعات روی ویترین اولیه فروشگاهت می‌شینه و بعداً قابل تغییره.
          </p>
        </div>
        <div className="store-media-upload">
          <label>
            <span
              className={logoPreview ? "has-preview" : ""}
              style={
                logoPreview
                  ? { backgroundImage: `url(${logoPreview})` }
                  : undefined
              }
            >
              {!logoPreview && "لوگو"}
            </span>
            <b>لوگوی فروشگاه</b>
            <small>اختیاری · مربع PNG/JPG</small>
            <input
              name="storeLogo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                previewFile(event.target.files?.[0], setLogoPreview)
              }
            />
          </label>
          <label className="banner-upload">
            <span
              className={bannerPreview ? "has-preview" : ""}
              style={
                bannerPreview
                  ? { backgroundImage: `url(${bannerPreview})` }
                  : undefined
              }
            >
              {!bannerPreview && "بنر فروشگاه"}
            </span>
            <b>تصویر کاور</b>
            <small>اختیاری · پیشنهادی ۱۶:۶</small>
            <input
              name="storeBanner"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                previewFile(event.target.files?.[0], setBannerPreview)
              }
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>نام فروشگاه *</span>
            <input
              className="input"
              name="storeName"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="مثلاً استودیو نارنج"
              required
            />
          </label>
          <Field id="storeSlug" label="آدرس پیشنهادی (انگلیسی)" placeholder={slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="فقط حروف کوچک انگلیسی، عدد و خط تیره؛ بدون فاصله" error={state.errors?.storeSlug} />
        </div>
        <div className="slug-preview">
          chaplly.ir/stores/<b>{slug}</b>
        </div>
        <label className="field">
          <span>توضیح کوتاه فروشگاه *</span>
          <textarea
            className="input onboarding-textarea"
            name="storeDescription"
            placeholder="فروشگاهت چه حس و محصولی داره؟"
            required
          />
        </label>
        <div className="form-row">
          <Select id="primaryCategory" label="دسته اصلی محصولات" required>
            <option value="">انتخاب کن</option>
            <option value="APPAREL">پوشاک</option>
            <option value="ACCESSORIES">اکسسوری</option>
            <option value="HOME">خانه و زندگی</option>
            <option value="STATIONERY">لوازم تحریر</option>
            <option value="MIXED">ترکیبی</option>
          </Select>
          <Select id="brandTone" label="حال‌وهوای برند">
            <option value="FUN">بامزه و خودمونی</option>
            <option value="MINIMAL">مینیمال</option>
            <option value="BOLD">جسور و پررنگ</option>
            <option value="ARTISTIC">هنری</option>
            <option value="PROFESSIONAL">حرفه‌ای</option>
          </Select>
        </div>
        <div className="form-row">
          <label className="field">
            <span>رنگ اصلی برند</span>
            <input
              className="input color-input"
              name="brandColor"
              type="color"
              defaultValue="#ef5b4c"
            />
          </label>
        </div>
      </section>
      <section hidden={step !== 4}>
        <div className="step-copy">
          <small>۴ از ۴</small>
          <h2>همه‌چی آماده‌ست 🎉</h2>
          <p>با ساخت حساب، فروشگاهت ایجاد می‌شه و مستقیم وارد پنل می‌شی.</p>
        </div>
        <div className="onboarding-summary">
          <CircleCheck />
          <div>
            <b>حساب فروشنده</b>
            <span>ورود امن با ایمیل و رمز عبور</span>
          </div>
          <CircleCheck />
          <div>
            <b>فروشگاه شخصی</b>
            <span>زیردامنه، درگاه آماده و تنظیمات اولیه</span>
          </div>
          <CircleCheck />
          <div>
            <b>چک‌لیست شروع</b>
            <span>قدم‌های بعدی داخل پنل منتظرته</span>
          </div>
        </div>
        <label className="checkbox-field">
          <input name="terms" type="checkbox" required />
          <span>
            با ساخت حساب، <Link href="/terms">قوانین استفاده</Link> و{" "}
            <Link href="/privacy">حریم خصوصی</Link> چاپلی رو می‌پذیرم.
          </span>
        </label>
        {state.errors?.terms && (
          <small className="field-error">{state.errors.terms[0]}</small>
        )}
        <SubmitButton>ساخت حساب و فروشگاه</SubmitButton>
      </section>
      <div className="onboarding-nav">
        {step > 1 && (
          <button type="button" onClick={previousStep}>
            <ArrowRight /> قبلی
          </button>
        )}
        {step < 4 && (
          <button className="next" type="button" onClick={nextStep}>
            ادامه <ArrowLeft />
          </button>
        )}
      </div>
    </form>
  );
}
