# سانسیار — Front (Customer + Admin UI)

پروتوتایپ رابط کاربری پلتفرم رزرو مجموعه‌های ورزشی **سانسیار**. کاملاً فارسی و
راست‌به‌چپ (RTL)، ساخته‌شده با React + Vite + TailwindCSS + اجزای سبک
shadcn/ui + Framer Motion + Lucide Icons.

> این بخش فقط یک **MVP رابط کاربری** است. به‌صورت پیش‌فرض از داده‌های mock
> محلی استفاده می‌کند تا بدون اجرای بک‌اند هم کار کند، اما تمام صفحات حول
> همان قراردادهای API بک‌اند Go ساخته شده‌اند.

## اجرا

```bash
cd front
npm install
npm run dev      # http://localhost:5173
```

پورت روی `5173` تنظیم شده تا با `CORS_ORIGINS` بک‌اند هماهنگ باشد.

## اتصال به بک‌اند

| متغیر               | مقدار پیش‌فرض                     | توضیح                                  |
| ------------------- | -------------------------------- | -------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1`   | آدرس API                               |
| `VITE_USE_MOCK`     | `true`                           | با `false` به API واقعی وصل می‌شود     |

لایهٔ `src/api/endpoints.js` دقیقاً مطابق `docs/backend-api.md` پیاده شده است؛
کافی است `VITE_USE_MOCK=false` شود تا همان توابع به سرور Go درخواست بزنند.

## ساختار

```
src/
  api/            client (fetch + JWT) و endpoints هماهنگ با بک‌اند
  components/     اجزای مشترک + ui/ (دکمه، کارت، جدول، مودال، ...)
  context/        AuthContext
  data/mock.js    دیتاست نمونه هم‌شکل با خروجی API
  layouts/        SiteLayout (سایت) و AdminLayout (پنل)
  lib/            utils (تومان، تاریخ شمسی، اعداد فارسی) و constants
  pages/          صفحات سایت کاربری
  pages/admin/    صفحات پنل مدیریت
```

## مسیرها

**سایت کاربری:** `/` · `/complexes` · `/complexes/:id` · `/reservation`
· `/my-reservations` · `/login`

**پنل مدیریت:** `/admin/login` · `/admin/dashboard` · `/admin/complexes`
· `/admin/halls` · `/admin/slots` · `/admin/reservations`

## ورود دمو

- کاربر: شمارهٔ `09350000000` و هر کد ۴ رقمی.
- ادمین: نام کاربری `admin` و هر رمز عبوری.
