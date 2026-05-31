import { useEffect, useState } from "react";
import { Check, X, Building2, Warehouse } from "lucide-react";

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
import { toFa } from "@/lib/utils";

export default function PlatformApprovals() {
  const [complexes, setComplexes] = useState(null);
  const [halls, setHalls] = useState(null);
  const [owners, setOwners] = useState({});

  async function load() {
    const [cx, hl, us] = await Promise.all([
      listAdminComplexes({ status: "pending_approval" }),
      listAdminHalls({ status: "pending_approval" }),
      listUsers("venue_owner"),
    ]);
    setComplexes(cx);
    setHalls(hl);
    setOwners(Object.fromEntries(us.map((u) => [u.id, u])));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleComplex(id, approved) {
    try {
      if (approved) await approveComplex(id);
      else await rejectComplex(id);
      toast(approved ? "مجموعه تأیید شد" : "مجموعه رد شد");
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

  if (!complexes || !halls) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            مجموعه‌های در انتظار ({toFa(complexes.length)})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {complexes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">مجموعه‌ای در صف تأیید نیست.</p>
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>شهر</TH><TH>مالک</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {complexes.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>{c.city}</TD>
                    <TD className="text-sm text-muted-foreground">{owners[c.owner_id]?.full_name || c.owner_id}</TD>
                    <TD><StatusBadge kind="complex" status={c.status} /></TD>
                    <TD>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleComplex(c.id, true)}><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleComplex(c.id, false)}><X className="h-4 w-4 text-destructive" /></Button>
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
