import { useEffect, useState } from "react";
import { Plus, UserX, Pencil } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import { listUsers, createUser, updateUser, suspendUser, listAdminComplexes } from "@/api/endpoints";
import { ROLE } from "@/lib/constants";
import { toFa } from "@/lib/utils";

const empty = { full_name: "", phone: "", password: "", email: "" };

export default function PlatformOwners() {
  const [owners, setOwners] = useState(null);
  const [complexes, setComplexes] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [us, cx] = await Promise.all([listUsers("venue_owner"), listAdminComplexes()]);
    setOwners(us);
    setComplexes(cx);
  }

  useEffect(() => {
    load();
  }, []);

  function complexesForOwner(ownerId) {
    return complexes.filter((c) => c.owner_id === ownerId);
  }

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

  async function toggleStatus(owner) {
    try {
      if (owner.status === "active") {
        await suspendUser(owner.id);
        toast("حساب غیرفعال شد");
      } else {
        await updateUser(owner.id, { status: "active" });
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
          <Plus className="h-4 w-4" />
          مالک جدید
        </Button>
      </div>

      <Card>
        <CardContent className="px-0 py-0">
          {!owners ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>تلفن</TH><TH>مجموعه‌ها</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {owners.map((o) => {
                  const cx = complexesForOwner(o.id);
                  return (
                    <TR key={o.id}>
                      <TD className="font-medium">{o.full_name}</TD>
                      <TD className="font-mono text-sm" dir="ltr">{o.phone}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {cx.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            cx.map((c) => (
                              <Badge key={c.id} tone={c.status === "approved" ? "success" : "warning"}>{c.name}</Badge>
                            ))
                          )}
                        </div>
                      </TD>
                      <TD>
                        <Badge tone={o.status === "active" ? "success" : "destructive"}>
                          {o.status === "active" ? "فعال" : "معلق"}
                        </Badge>
                      </TD>
                      <TD>
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(o)}>
                          <UserX className="h-4 w-4" />
                          {o.status === "active" ? "تعلیق" : "فعال‌سازی"}
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
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
            <Button type="submit" disabled={saving}>{saving ? <Spinner /> : <Pencil className="h-4 w-4" />} ایجاد</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
