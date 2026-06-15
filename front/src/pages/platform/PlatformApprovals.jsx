import { useEffect, useState } from "react";
import { Check, X, Building2, Warehouse, Hourglass } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import {
  listAdminComplexes,
  listAdminHalls,
  approveComplex,
  rejectComplex,
  approveHall,
  rejectHall,
  listUsers,
} from "@/api/endpoints";
import { toFa, formatJalaliDate } from "@/lib/utils";

export default function PlatformApprovals() {
  const [pending, setPending] = useState(null);
  const [reapprovals, setReapprovals] = useState(null);
  const [halls, setHalls] = useState(null);
  const [owners, setOwners] = useState({});

  async function load() {
    const [cx, hl, us] = await Promise.all([
      listAdminComplexes(),
      listAdminHalls({ status: "pending_approval" }),
      listUsers("venue_owner"),
    ]);
    setPending(cx.filter((c) => c.status === "pending_approval"));
    // Live complexes whose staged edits await re-approval.
    setReapprovals(cx.filter((c) => c.pending_changes));
    setHalls(hl);
    setOwners(Object.fromEntries(us.map((u) => [u.id, u])));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleComplex(c, approved, reviewingChanges) {
    try {
      if (approved) await approveComplex(c.id);
      else await rejectComplex(c.id);
      if (reviewingChanges) {
        toast(approved ? "تغییرات تأیید و اعمال شد" : "تغییرات رد شد و نسخه قبلی فعال ماند");
      } else {
        toast(approved ? "مجموعه تأیید شد" : "مجموعه رد شد");
      }
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleHall(id, approved) {
    try {
      if (approved) await approveHall(id);
      else await rejectHall(id);
      toast(approved ? "سالن تأیید شد" : "سالن رد شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (!pending || !reapprovals || !halls) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            مجموعه‌های در انتظار تأیید اولیه ({toFa(pending.length)})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">مجموعه‌ای در صف تأیید نیست.</p>
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>شهر</TH><TH>مالک</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {pending.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>{c.city}</TD>
                    <TD className="text-sm text-muted-foreground">{owners[c.owner_id]?.full_name || c.owner_id}</TD>
                    <TD><StatusBadge kind="complex" status={c.status} /></TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title="تأیید" onClick={() => handleComplex(c, true, false)}>
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" title="رد" onClick={() => handleComplex(c, false, false)}>
                          <X className="h-4 w-4 text-destructive" />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-primary" />
            تغییرات در انتظار تأیید مجدد ({toFa(reapprovals.length)})
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            این مجموعه‌ها قبلاً تأیید شده‌اند و ویرایش جدیدی ثبت کرده‌اند؛ تا تأیید شما، نسخه قبلی در سایت فعال می‌ماند.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {reapprovals.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">تغییری در صف تأیید نیست.</p>
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>شهر</TH><TH>مالک</TH><TH>تاریخ ثبت تغییرات</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {reapprovals.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.pending_changes?.name || c.name}</TD>
                    <TD>{c.pending_changes?.city || c.city}</TD>
                    <TD className="text-sm text-muted-foreground">{owners[c.owner_id]?.full_name || c.owner_id}</TD>
                    <TD className="text-sm text-muted-foreground">
                      {c.pending_changes?.submitted_at ? formatJalaliDate(c.pending_changes.submitted_at) : "—"}
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title="تأیید و اعمال تغییرات" onClick={() => handleComplex(c, true, true)}>
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="sm" variant="ghost" title="رد تغییرات (نسخه قبلی فعال می‌ماند)" onClick={() => handleComplex(c, false, true)}>
                          <X className="h-4 w-4 text-destructive" />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            سالن‌های در انتظار ({toFa(halls.length)})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {halls.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">سالنی در صف تأیید نیست.</p>
          ) : (
            <Table>
              <THead>
                <TR><TH>نام سالن</TH><TH>مجموعه</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {halls.map((h) => (
                  <TR key={h.id}>
                    <TD className="font-medium">{h.name}</TD>
                    <TD className="text-muted-foreground">{h.complex_id}</TD>
                    <TD><StatusBadge kind="hall" status={h.status} /></TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleHall(h.id, true)}><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleHall(h.id, false)}><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
