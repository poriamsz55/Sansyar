import { useEffect, useState } from "react";
import { Check, X, Building2, Warehouse, Hourglass, Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import RequestDetail from "@/components/admin/RequestDetail";
import RejectDialog from "@/components/admin/RejectDialog";
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
  const [detailId, setDetailId] = useState(null);
  const [reject, setReject] = useState(null); // { type, id, name }

  async function load() {
    const [cx, hl, us] = await Promise.all([
      listAdminComplexes(),
      listAdminHalls({ status: "pending_approval" }),
      listUsers("venue_owner"),
    ]);
    setPending(cx.filter((c) => c.status === "pending_approval"));
    setReapprovals(cx.filter((c) => c.pending_changes));
    setHalls(hl);
    setOwners(Object.fromEntries(us.map((u) => [u.id, u])));
  }

  useEffect(() => {
    load();
  }, []);

  async function approveComplexReq(c) {
    try {
      await approveComplex(c.id);
      toast(c.pending_changes ? "تغییرات تأیید و اعمال شد" : "مجموعه تأیید شد");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function doReject(reason) {
    try {
      if (reject.type === "complex") await rejectComplex(reject.id, reason);
      else await rejectHall(reject.id, reason);
      toast("درخواست رد شد");
      setDetailId(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function approveHallReq(id) {
    try {
      await approveHall(id);
      toast("سالن تأیید شد");
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
      <ApprovalSection
        icon={Building2}
        title={`مجموعه‌های در انتظار تأیید اولیه (${toFa(pending.length)})`}
        empty="مجموعه‌ای در صف تأیید نیست."
        rows={pending}
        owners={owners}
        onView={(c) => setDetailId(c.id)}
        onApprove={approveComplexReq}
        onReject={(c) => setReject({ type: "complex", id: c.id, name: c.name })}
      />

      <ApprovalSection
        icon={Hourglass}
        title={`تغییرات در انتظار تأیید مجدد (${toFa(reapprovals.length)})`}
        note="این مجموعه‌ها قبلاً تأیید شده‌اند و ویرایش جدیدی ثبت کرده‌اند؛ تا تأیید شما، نسخه قبلی فعال می‌ماند."
        empty="تغییری در صف تأیید نیست."
        rows={reapprovals}
        owners={owners}
        changeDate
        onView={(c) => setDetailId(c.id)}
        onApprove={approveComplexReq}
        onReject={(c) => setReject({ type: "complex", id: c.id, name: c.name })}
      />

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
                        <Button size="sm" variant="ghost" onClick={() => approveHallReq(h.id)} title="تأیید"><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setReject({ type: "hall", id: h.id, name: h.name })} title="رد"><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {detailId && (
        <RequestDetail
          venueId={detailId}
          onClose={() => setDetailId(null)}
          onApprove={approveComplexReq}
          onReject={(c) => setReject({ type: "complex", id: c.id, name: c.name })}
        />
      )}
      <RejectDialog
        open={!!reject}
        onClose={() => setReject(null)}
        onConfirm={doReject}
        subject={reject?.name}
      />
    </div>
  );
}

function ApprovalSection({ icon: Icon, title, note, empty, rows, owners, changeDate, onView, onApprove, onReject }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>نام</TH>
                <TH>شهر</TH>
                <TH>مالک</TH>
                <TH>{changeDate ? "تاریخ ثبت تغییرات" : "وضعیت"}</TH>
                <TH>عملیات</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">{c.pending_changes?.name || c.name}</TD>
                  <TD>{c.pending_changes?.city || c.city}</TD>
                  <TD className="text-sm text-muted-foreground">{owners[c.owner_id]?.full_name || c.owner_id}</TD>
                  <TD className="text-sm text-muted-foreground">
                    {changeDate
                      ? c.pending_changes?.submitted_at
                        ? formatJalaliDate(c.pending_changes.submitted_at)
                        : "—"
                      : <StatusBadge kind="complex" status={c.status} />}
                  </TD>
                  <TD>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => onView(c)}>
                        <Eye className="h-3.5 w-3.5" />
                        جزئیات
                      </Button>
                      <Button size="sm" variant="ghost" title="تأیید" onClick={() => onApprove(c)}>
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="sm" variant="ghost" title="رد" onClick={() => onReject(c)}>
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
  );
}
