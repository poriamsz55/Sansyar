import { useEffect, useState } from "react";
import { Plus, UserX, Eye, Building2, Ticket, Banknote, Clock, CreditCard, Home, RotateCcw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { adminListOwners, adminGetOwner, createUser, updateUser, suspendUser } from "@/api/endpoints";
import { ROLE } from "@/lib/constants";
import { toFa, formatToman, formatJalaliDate } from "@/lib/utils";

const empty = { full_name: "", phone: "", password: "" };

export default function PlatformOwners() {
  const [owners, setOwners] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState(null);

  async function load() {
    setOwners(await adminListOwners());
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({ ...form, role: "venue_owner" });
      toast("مالک مجموعه ایجاد شد");
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(o) {
    try {
      if (o.status === "active") {
        await suspendUser(o.id);
        toast("حساب غیرفعال شد");
      } else {
        await updateUser(o.id, { status: "active" });
        toast("حساب فعال شد");
      }
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{owners ? `${toFa(owners.length)} مالک مجموعه` : "..."}</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> مالک جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!owners ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>تلفن</TH><TH>کد ملی</TH><TH>مجموعه‌ها</TH><TH>رزروها</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {owners.map((o) => (
                  <TR key={o.id}>
                    <TD className="font-medium">{o.full_name}</TD>
                    <TD className="font-mono text-sm" dir="ltr">{toFa(o.phone)}</TD>
                    <TD className="font-mono text-sm" dir="ltr">{o.national_id ? toFa(o.national_id) : "—"}</TD>
                    <TD>{toFa(o.venue_count || 0)}</TD>
                    <TD>{toFa(o.booking_count || 0)}</TD>
                    <TD>
                      <Badge tone={o.status === "active" ? "success" : "destructive"}>
                        {o.status === "active" ? "فعال" : "معلق"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setDetailId(o.id)}>
                          <Eye className="h-3.5 w-3.5" /> پروفایل
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(o)} title={o.status === "active" ? "تعلیق" : "فعال‌سازی"}>
                          {o.status === "active" ? <UserX className="h-4 w-4 text-destructive" /> : <RotateCcw className="h-4 w-4 text-success" />}
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="ایجاد مالک مجموعه" description={`نقش: ${ROLE.venue_owner}`}>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نام کامل</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>تلفن</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" required />
          </div>
          <div className="space-y-1.5">
            <Label>رمز عبور</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? <Spinner /> : <Plus className="h-4 w-4" />} ایجاد</Button>
          </div>
        </form>
      </Dialog>

      {detailId && <OwnerDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function OwnerDetail({ id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    adminGetOwner(id).then(setData).catch(() => setData(false));
  }, [id]);

  return (
    <Dialog open onClose={onClose} wide title="پروفایل مالک" description={data ? data.full_name : undefined}>
      {!data ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field icon={CreditCard} label="کد ملی" value={data.national_id ? toFa(data.national_id) : "—"} ltr />
            <Field icon={Home} label="آدرس" value={data.address || "—"} />
            <Field icon={Clock} label="تاریخ ثبت‌نام" value={formatJalaliDate(data.created_at)} />
            <Field icon={Clock} label="آخرین فعالیت" value={data.last_activity_at ? formatJalaliDate(data.last_activity_at) : "—"} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Building2} label="مجموعه‌ها" value={toFa(data.venues?.length || 0)} />
            <Stat icon={Ticket} label="کل رزروها" value={toFa(data.stats?.total || 0)} />
            <Stat icon={Ticket} label="لغو شده" value={toFa(data.stats?.cancelled || 0)} />
            <Stat icon={Banknote} label="درآمد" value={`${formatToman(data.stats?.revenue || 0)} ت`} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">مجموعه‌های ثبت‌شده</h3>
            {data.venues?.length ? (
              <div className="space-y-2">
                {data.venues.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                    <span className="text-sm font-medium">{v.name}</span>
                    <StatusBadge kind="complex" status={v.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">مجموعه‌ای ثبت نکرده است.</p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}

function Field({ icon: Icon, label, value, ltr }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-0.5 text-sm font-medium" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
