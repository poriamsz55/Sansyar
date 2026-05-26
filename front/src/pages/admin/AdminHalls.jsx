import { useEffect, useState } from "react";
import { Plus, Users, Maximize2, Warehouse, Power } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { listComplexes, listHalls, createHall } from "@/api/endpoints";
import { SPORTS } from "@/lib/constants";
import { SPORT_BY_ID } from "@/data/mock";
import { formatToman, toFa } from "@/lib/utils";

export default function AdminHalls() {
  const [complexes, setComplexes] = useState([]);
  const [halls, setHalls] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    complexId: "",
    name: "",
    capacity: 20,
    base_price: 2000000,
    floor_type: "پارکت",
    dimensions: "۴۰×۲۰",
    supported_sport_ids: [],
  });

  async function load() {
    const cx = await listComplexes();
    setComplexes(cx);
    const lists = await Promise.all(cx.map((c) => listHalls(c.id)));
    setHalls(lists.flat());
    if (cx[0] && !form.complexId) setForm((f) => ({ ...f, complexId: cx[0].id }));
  }
  useEffect(() => {
    load();
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function toggleSport(id) {
    setForm((f) => ({
      ...f,
      supported_sport_ids: f.supported_sport_ids.includes(id)
        ? f.supported_sport_ids.filter((x) => x !== id)
        : [...f.supported_sport_ids, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { complexId, ...payload } = form;
      await createHall(complexId, {
        ...payload,
        capacity: Number(payload.capacity),
        base_price: Number(payload.base_price),
        supported_sport_ids: payload.supported_sport_ids.length
          ? payload.supported_sport_ids
          : [SPORTS[0].id],
      });
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const complexName = (id) => complexes.find((c) => c.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {halls ? `${toFa(halls.length)} سالن ثبت شده` : "در حال بارگذاری..."}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          سالن جدید
        </Button>
      </div>

      {!halls ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : halls.length === 0 ? (
        <EmptyState icon={Warehouse} title="سالنی ثبت نشده" description="اولین سالن را اضافه کن." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {halls.map((h) => (
            <Card key={h.id} className="overflow-hidden">
              <div className="relative h-32">
                <img src={h.images?.[0]} alt={h.name} className="h-full w-full object-cover" />
                <Badge
                  tone={h.is_active ? "success" : "muted"}
                  className="absolute right-2 top-2"
                >
                  <Power className="h-3 w-3" />
                  {h.is_active ? "فعال" : "غیرفعال"}
                </Badge>
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="font-bold">{h.name}</h3>
                  <p className="text-xs text-muted-foreground">{complexName(h.complex_id)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {h.supported_sport_ids.map((sid) => (
                    <Badge key={sid} tone="primary">
                      {SPORT_BY_ID[sid] || sid}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {toFa(h.capacity)} نفر
                  </span>
                  <span className="flex items-center gap-1">
                    <Maximize2 className="h-3.5 w-3.5" /> {h.dimensions}
                  </span>
                </div>
                <div className="border-t border-border pt-3 text-sm">
                  <span className="font-extrabold text-navy">
                    {formatToman(h.base_price)}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">تومان / سانس</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت سالن جدید"
        description="سالن را به یکی از مجموعه‌ها اضافه کن."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>مجموعه</Label>
            <Select value={form.complexId} onChange={(e) => set("complexId", e.target.value)}>
              {complexes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نام سالن</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="مثلاً سالن فوتسال شماره ۱"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>ورزش‌های قابل اجرا</Label>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggleSport(s.id)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (form.supported_sport_ids.includes(s.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-accent")
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>ظرفیت</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ابعاد</Label>
              <Input value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>کف‌پوش</Label>
              <Input value={form.floor_type} onChange={(e) => set("floor_type", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>قیمت پایه (ریال)</Label>
            <Input
              type="number"
              value={form.base_price}
              onChange={(e) => set("base_price", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              معادل {formatToman(form.base_price)} تومان
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              ثبت سالن
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
