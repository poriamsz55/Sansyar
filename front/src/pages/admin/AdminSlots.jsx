import { useEffect, useMemo, useState } from "react";
import { Plus, Power, PowerOff } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import {
  listOwnerComplexes,
  listHalls,
  listSlots,
  createSlot,
  setSlotStatus,
} from "@/api/endpoints";
import { useSportsMap } from "@/hooks/useSportsMap";
import {
  formatToman,
  toFa,
  formatJalaliDate,
  formatTimeRange,
} from "@/lib/utils";

export default function AdminSlots() {
  const sportsMap = useSportsMap();
  const [complexes, setComplexes] = useState([]);
  const [halls, setHalls] = useState([]);
  const [slots, setSlots] = useState(null);
  const [filterComplex, setFilterComplex] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    hall_id: "",
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    time: "18:00",
    base_price: 2000000,
    discount_percent: 0,
  });

  async function load() {
    const [cx, sl] = await Promise.all([listOwnerComplexes(), listSlots()]);
    setComplexes(cx);
    const hl = (await Promise.all(cx.map((c) => listHalls(c.id, { includeInactive: true })))).flat();
    setHalls(hl);
    setSlots(sl);
    if (hl[0] && !form.hall_id) setForm((f) => ({ ...f, hall_id: hl[0].id }));
  }
  useEffect(() => {
    load();
  }, []);

  const hallMap = useMemo(
    () => Object.fromEntries(halls.map((h) => [h.id, h])),
    [halls]
  );
  const complexMap = useMemo(
    () => Object.fromEntries(complexes.map((c) => [c.id, c])),
    [complexes]
  );

  const visible = useMemo(() => {
    if (!slots) return null;
    const list = filterComplex
      ? slots.filter((s) => s.complex_id === filterComplex)
      : slots;
    return [...list].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [slots, filterComplex]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function toggle(slot) {
    const next = slot.status === "available" ? "blocked" : "available";
    await setSlotStatus(slot.id, next);
    load();
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const hall = hallMap[form.hall_id];
      const start = new Date(`${form.date}T${form.time}:00`);
      const end = new Date(start.getTime() + 90 * 60000);
      await createSlot({
        hall_id: form.hall_id,
        complex_id: hall.complex_id,
        sport_id: hall.supported_sport_ids[0],
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        base_price: Number(form.base_price),
        discount_percent: Number(form.discount_percent),
        payment_policy: "full_online",
        min_deposit_amount: Math.round(Number(form.base_price) * 0.4),
      });
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-56">
          <Select
            value={filterComplex}
            onChange={(e) => setFilterComplex(e.target.value)}
          >
            <option value="">همه مجموعه‌ها</option>
            {complexes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          سانس جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!visible ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>سالن</TH>
                  <TH>ورزش</TH>
                  <TH>تاریخ</TH>
                  <TH>ساعت</TH>
                  <TH>قیمت نهایی</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {visible.slice(0, 40).map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">
                      {hallMap[s.hall_id]?.name || "—"}
                      <span className="block text-xs text-muted-foreground">
                        {complexMap[s.complex_id]?.name}
                      </span>
                    </TD>
                    <TD>{sportsMap[s.sport_id] || s.sport_id}</TD>
                    <TD className="text-muted-foreground">
                      {formatJalaliDate(s.starts_at)}
                    </TD>
                    <TD className="tnum text-muted-foreground">
                      {formatTimeRange(s.starts_at, s.ends_at)}
                    </TD>
                    <TD>
                      <span className="font-semibold">{formatToman(s.final_price)}</span>
                      {s.discount_percent > 0 && (
                        <span className="mr-1 text-xs text-success">
                          ({toFa(s.discount_percent)}٪)
                        </span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge kind="slot" status={s.status} />
                    </TD>
                    <TD>
                      {s.status === "reserved" ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggle(s)}
                          className={
                            s.status === "available"
                              ? "text-destructive"
                              : "text-success"
                          }
                        >
                          {s.status === "available" ? (
                            <>
                              <PowerOff className="h-3.5 w-3.5" /> غیرفعال
                            </>
                          ) : (
                            <>
                              <Power className="h-3.5 w-3.5" /> فعال
                            </>
                          )}
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="ثبت سانس جدید"
        description="زمان و قیمت سانس را مشخص کن."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>سالن</Label>
            <Select value={form.hall_id} onChange={(e) => set("hall_id", e.target.value)}>
              {halls.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {complexMap[h.complex_id]?.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>تاریخ</Label>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>ساعت شروع</Label>
              <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>قیمت پایه (ریال)</Label>
              <Input
                type="number"
                value={form.base_price}
                onChange={(e) => set("base_price", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>درصد تخفیف</Label>
              <Input
                type="number"
                min={0}
                max={90}
                value={form.discount_percent}
                onChange={(e) => set("discount_percent", e.target.value)}
              />
            </div>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            قیمت نهایی:{" "}
            <b>
              {formatToman(
                Math.round(
                  (Number(form.base_price) * (100 - Number(form.discount_percent))) / 100
                )
              )}{" "}
              تومان
            </b>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              ثبت سانس
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
