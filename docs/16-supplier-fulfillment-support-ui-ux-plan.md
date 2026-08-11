# پرامپت جامع نقش تأمین‌کننده، Fulfillment و پشتیبانی

## پرامپت محصول

یک پنل تأمین‌کننده‌ی فارسی، RTL و mobile-first طراحی کن که از همان زبان بصری پنل فروشنده استفاده کند اما به‌جای ویترین، روی عملیات شرکت، تولید و ارسال متمرکز باشد. شرکت تأمین‌کننده پس از ثبت‌نام مستقیماً وارد «سفارش‌ها» شود. اطلاعات متراکم اما action-first باشند: سفارش قدیمی‌تر، SLA نزدیک‌تر و اقدام ضروری برجسته‌تر باشد. هر وضعیت یک متن روشن، timestamp و اقدام بعدی داشته باشد. از اصطلاحات داخلی مبهم، کارت‌های تزئینی و ورودی‌های غیرضروری اجتناب کن.

## ثبت‌نام شرکت تأمین‌کننده

چهار مرحله با autosave و حفظ مقدارها پس از خطا:

1. **مالک حساب:** نام، نام خانوادگی، موبایل، ایمیل و رمز.
2. **شرکت:** نام حقوقی، نام نمایشی، شناسه ملی، شماره ثبت، نوع کسب‌وکار، سال شروع، سایت.
3. **عملیات:** آدرس/شهر، کدپستی، تلفن، ظرفیت روزانه، زمان آماده‌سازی، روش‌های چاپ، دسته‌های قابل تأمین و امکان ارسال.
4. **تأیید:** لوگو و تصویر محیط اختیاری، اطلاعات بانکی، پذیرش قوانین و خلاصه.

شرکت جایگزین Store است؛ سازمان نوع `SUPPLIER` دارد و facility اصلی هنگام ثبت‌نام ساخته می‌شود.

## سفارش‌های تأمین‌کننده

- فقط fulfilmentهای تخصیص‌یافته و غیر `DONE/CANCELLED/RETURNED`، مرتب‌شده از قدیمی به جدید.
- KPI: سفارش فعال، خارج SLA، آماده ارسال، درآمد در انتظار.
- هر ردیف: شماره، زمان انتظار، seller/store، اطلاعات حداقلی مشتری، raw product، رنگ/سایز/تعداد، فایل‌های چاپ و وضعیت.
- drawer جزئیات: timeline، آدرس ارسال با حداقل داده لازم، فایل‌های قابل دانلود با نوع/رزولوشن/checksum، یادداشت تولید.
- اکشن **ارسال کردم** tracking code را اجباری می‌کند؛ ثبت، وضعیت را `SENT` و timer تکمیل خودکار را `sentAt + 10 days` می‌سازد.
- بازگشت/لغو timer را متوقف می‌کند. job زمان‌بندی‌شده فقط fulfilment واجدشرایط را با idempotency به `DONE` تبدیل می‌کند.

## محصولات خام قابل تأمین

- کاتالوگ تصویری با مشخصات، هزینه مرجع، روش تولید و variants.
- اکشن «می‌توانم تأمین کنم» فقط رنگ‌ها و سایزهای قابل انجام، ظرفیت، هزینه، SLA و facility را می‌گیرد.
- submission وضعیت `APPROVED` فعلی دارد؛ معماری دارای `approvalMode` است تا بعداً `PENDING` شود.
- seller در مرحله آخر فقط supplierOfferهای `APPROVED + ACTIVE` همان rawProduct/variant را می‌بیند.
- خرید، assignment snapshot می‌سازد تا تغییر offer سفارش قبلی را عوض نکند.

## مالی تأمین‌کننده

کامپوننت‌های مالی فروشنده reuse می‌شوند، با واژه‌های «هزینه تولید»، «درآمد تأمین»، `supplierPayable` و payout history. فقط fulfilmentهای `DONE` و خارج دوره ریسک به available balance اضافه می‌شوند.

## تیکت و گفت‌وگو برای هر سه نقش

یک workspace مشترک با role adapter:

- ستون فیلتر: باز، منتظر پاسخ من، منتظر چاپلی، حل‌شده، همه.
- inbox: subject، شماره، category، priority، آخرین پیام، counter خوانده‌نشده، reference سفارش/محصول و زمان.
- thread: header وضعیت/SLA/assignee، timeline پیام‌ها، پیام‌های سیستم، فایل‌ها و composer چسبان.
- ساخت تیکت: موضوع، category، priority استنباط‌شده، شرح، reference اختیاری سفارش/محصول/payout، attachment چندگانه. فقط فیلدهای لازم.
- seller/supplier فقط تیکت سازمان خود را می‌بیند. admin همه را، با assign، internal note، تغییر priority/status، پاسخ و resolve/reopen.
- پیام مشتری و internal note در UI و permission جدا هستند.
- attachmentها با type/size/status و scan result ذخیره می‌شوند.
- شمارنده unread برای هر participant مستقل است.

## مدل داده و پایداری

- `supplierProfiles`, `facilities`, `supplierOffers`, `supplierOfferVariants`
- `fulfilments`, `fulfilmentItems`, `fulfilmentStatusEvents`, `autoCompletionJobs`
- `tickets`, `ticketParticipants`, `ticketMessages`, `ticketAttachments`, `ticketReadStates`
- همه transitionها audit event و idempotency key دارند.
- queryهای اصلی composite index دارند و page size سفارش 100 است.

