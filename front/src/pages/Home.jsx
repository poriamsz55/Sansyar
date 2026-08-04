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
import { listFeaturedComplexes, getPublicStats } from "@/api/endpoints";
import { toFa } from "@/lib/utils";

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

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [featured, setFeatured] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    listFeaturedComplexes(8).then(setFeatured);
    getPublicStats().then(setStats);
  }, []);

  function search(e) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/complexes?q=${encodeURIComponent(query.trim())}`);
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
            <h1 className="mt-6 text-3xl font-extrabold leading-tight md:text-5xl md:leading-[1.2]">
              زمین بازیت را آنلاین رزرو کن.
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
          </motion.div>

          <div className="mx-auto mt-16 grid max-w-md grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-extrabold md:text-3xl">
                {stats ? toFa(stats.total_venues) : "—"}
              </p>
              <p className="mt-1 text-sm text-white/60">مجموعه ورزشی</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-extrabold md:text-3xl">
                {stats ? toFa(stats.total_reservations) : "—"}
              </p>
              <p className="mt-1 text-sm text-white/60">رزرو موفق</p>
            </div>
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
              محبوب‌ترین مجموعه‌های ورزشی با بیشترین رزرو
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

        <div className="no-scrollbar flex gap-5 overflow-x-auto pb-2">
          {featured
            ? featured.map((c, i) => (
                <div key={c.id} className="w-72 shrink-0">
                  <ComplexCard complex={c} index={i} />
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-72 shrink-0" />
              ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-20">
        <div className="hero-gradient relative overflow-hidden rounded-2xl px-8 py-12 text-center text-white md:py-16">
          <MapPin className="absolute -left-6 -top-6 h-40 w-40 text-white/5" />
          <h2 className="text-2xl font-extrabold md:text-3xl">
            همین حالا بهترین سانس ورزشی شهرت را رزرو کن
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
