import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  ShieldCheck,
  Zap,
  WalletMinimal,
  ArrowLeft,
  MapPin,
} from "lucide-react";

import { PageTransition } from "@/components/PageTransition";
import { ComplexCard } from "@/components/ComplexCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listComplexes } from "@/api/endpoints";
import { SPORTS } from "@/lib/constants";

const features = [
  {
    icon: Zap,
    title: "رزرو آنی",
    desc: "سانس دلخواهت را در چند ثانیه و بدون تماس تلفنی رزرو کن.",
  },
  {
    icon: ShieldCheck,
    title: "پرداخت امن",
    desc: "درگاه امن و قوانین لغو شفاف؛ پولت همیشه محفوظ است.",
  },
  {
    icon: WalletMinimal,
    title: "قیمت شفاف",
    desc: "تخفیف‌ها و قیمت نهایی پیش از پرداخت کاملاً مشخص است.",
  },
];

const stats = [
  { value: "۱۲۰+", label: "مجموعه ورزشی" },
  { value: "۵", label: "رشته ورزشی" },
  { value: "۲۴/۷", label: "پشتیبانی" },
  { value: "۴.۷", label: "میانگین رضایت" },
];

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    listComplexes().then((items) => setFeatured(items.slice(0, 6)));
  }, []);

  function search(e) {
    e.preventDefault();
    navigate(`/complexes${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  }

  return (
    <PageTransition>
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="container relative z-10 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              رزرو آنلاین سانس‌های ورزشی
            </span>
            <h1 className="mt-6 text-3xl font-extrabold leading-tight md:text-5xl md:leading-[1.2]">
              زمین بازیت را آنلاین رزرو کن،
              <br />
              <span className="text-primary-foreground/90">سریع و بی‌دردسر</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/70">
              بین صدها سالن فوتسال، والیبال، بسکتبال و تنیس بگرد، سانس آزاد را
              ببین و در لحظه رزرو کن.
            </p>

            <form
              onSubmit={search}
              className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-soft-lg"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="نام مجموعه یا شهر را جستجو کن..."
                  className="border-0 pr-11 text-foreground shadow-none focus-visible:ring-0"
                />
              </div>
              <Button type="submit" size="lg" className="shrink-0">
                جستجو
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {SPORTS.map((s) => (
                <Link
                  key={s.id}
                  to={`/complexes?sportId=${s.id}`}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm transition-colors hover:bg-white/15"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          </motion.div>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-extrabold md:text-3xl">{s.value}</p>
                <p className="mt-1 text-sm text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container relative z-10 -mt-10 grid gap-4 md:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-xl border border-border bg-card p-6 shadow-soft"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-bold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Featured complexes */}
      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold">مجموعه‌های منتخب</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              محبوب‌ترین مجموعه‌های ورزشی با بیشترین سانس آزاد
            </p>
          </div>
          <Link
            to="/complexes"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            مشاهده همه
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured
            ? featured.map((c, i) => <ComplexCard key={c.id} complex={c} index={i} />)
            : Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full" />
              ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="hero-gradient relative overflow-hidden rounded-2xl px-8 py-12 text-center text-white md:py-16">
          <MapPin className="absolute -left-6 -top-6 h-40 w-40 text-white/5" />
          <h2 className="text-2xl font-extrabold md:text-3xl">
            آماده‌ای بازی بعدی‌ات را رزرو کنی؟
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-white/70">
            همین حالا بین مجموعه‌های ورزشی شهرت بگرد و بهترین سانس را انتخاب کن.
          </p>
          <Button
            size="lg"
            variant="success"
            className="mt-7"
            onClick={() => navigate("/complexes")}
          >
            شروع رزرو
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
      </section>
    </PageTransition>
  );
}
