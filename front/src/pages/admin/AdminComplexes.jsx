import { useEffect, useState } from "react";
import { Plus, MapPin, Building2, Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { listComplexes, createComplex } from "@/api/endpoints";
import { CITIES } from "@/lib/constants";
import { toFa } from "@/lib/utils";

const empty = { name: "", city: CITIES[0], neighborhood: "", address: "", description: "" };

export default function AdminComplexes() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  function load() {
    listComplexes().then(setItems);
  }
  useEffect(load, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createComplex({ ...form, slug: `complex-${Date.now()}` });
      setOpen(false);
      setForm(empty);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items ? `${toFa(items.length)} مجموعه ثبت شده` : "در حال بارگذاری..."}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          مجموعه جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!items ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>نام مجموعه</TH>
                  <TH>شهر</TH>
                  <TH>امتیاز</TH>
                  <TH>سانس آزاد</TH>
                  <TH>وضعیت</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TD>
                    <TD className="text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {c.city}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {toFa((c.rating_avg || 0).toFixed(1))}
                      </span>
                    </TD>
                    <TD>{toFa(c.available_slot_count || 0)}</TD>
                    <TD>
                      <StatusBadge kind="complex" status={c.status} />
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
        title="ثبت مجموعه جدید"
        description="اطلاعات مجموعه ورزشی را وارد کن."
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نام مجموعه</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="مثلاً مجموعه ورزشی آزادی"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>شهر</Label>
              <Select value={form.city} onChange={(e) => set("city", e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>محله</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)}
                placeholder="مثلاً ولنجک"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>آدرس</Label>
            <Input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="آدرس کامل"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>توضیحات</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="توضیح کوتاهی درباره مجموعه..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : <Plus className="h-4 w-4" />}
              ثبت مجموعه
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
