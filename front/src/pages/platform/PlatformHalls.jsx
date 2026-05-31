import { useEffect, useState } from "react";
import { Check, X, Pencil, Trash2, Globe, GlobeLock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/Toast";
import {
  listAdminHalls,
  listAdminComplexes,
  approveHall,
  rejectHall,
  publishHall,
  unpublishHall,
  adminDeleteHall,
} from "@/api/endpoints";
import { formatToman, toFa } from "@/lib/utils";

export default function PlatformHalls() {
  const [halls, setHalls] = useState(null);
  const [complexMap, setComplexMap] = useState({});
  const [error, setError] = useState(null);

  async function load() {
    setError(null);
    try {
      const [hl, cx] = await Promise.all([listAdminHalls(), listAdminComplexes()]);
      setHalls(hl);
      setComplexMap(Object.fromEntries(cx.map((c) => [c.id, c])));
    } catch (err) {
      setError(err.message);
      setHalls([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id, approved) {
    try {
      if (approved) await approveHall(id);
      else await rejectHall(id);
      toast(approved ? "سالن تأیید شد" : "سالن رد شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handlePublish(id, publish) {
    try {
      if (publish) await publishHall(id);
      else await unpublishHall(id);
      toast(publish ? "سالن منتشر شد" : "انتشار سالن لغو شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleDelete(id) {
    if (!confirm("این سالن غیرفعال شود؟")) return;
    try {
      await adminDeleteHall(id);
      toast("سالن غیرفعال شد");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {halls ? `${toFa(halls.length)} سالن در سیستم` : "..."}
      </p>
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Card>
        <CardContent className="px-0 py-0">
          {!halls ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>سالن</TH>
                  <TH>مجموعه</TH>
                  <TH>قیمت</TH>
                  <TH>وضعیت</TH>
                  <TH>عملیات</TH>
                </TR>
              </THead>
              <TBody>
                {halls.map((h) => (
                  <TR key={h.id}>
                    <TD className="font-medium">{h.name}</TD>
                    <TD>{complexMap[h.complex_id]?.name || h.complex_id}</TD>
                    <TD>{formatToman(h.base_price)}</TD>
                    <TD>
                      <StatusBadge kind="hall" status={h.status || "approved"} />
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {h.status === "pending_approval" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleApprove(h.id, true)} title="تأیید">
                              <Check className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleApprove(h.id, false)} title="رد">
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {h.status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => handlePublish(h.id, true)} title="انتشار">
                            <Globe className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {h.status === "published" && (
                          <Button size="sm" variant="ghost" onClick={() => handlePublish(h.id, false)} title="لغو انتشار">
                            <GlobeLock className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(h.id)} title="حذف">
                          <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  );
}
