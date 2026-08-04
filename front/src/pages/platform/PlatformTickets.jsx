import { useEffect, useState } from "react";
import {
  Search,
  Eye,
  ChevronRight,
  ChevronLeft,
  Send,
  Phone,
  User,
  CalendarDays,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/PageTransition";
import { toast } from "@/components/Toast";
import {
  adminListTickets,
  adminGetTicket,
  adminReplyTicket,
  adminUpdateTicketStatus,
} from "@/api/endpoints";
import { TICKET_STATUS, TICKET_CATEGORY } from "@/lib/constants";
import { toFa, formatJalaliDate, formatTime } from "@/lib/utils";

export default function PlatformTickets() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ status: "", category: "" });
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const limit = 15;

  async function load() {
    setData(null);
    try {
      const res = await adminListTickets({ ...filters, page, limit });
      setData(res);
    } catch (err) {
      toast(err.message, "error");
      setData({ items: [], total: 0, page: 1, limit });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-44">
            <label className="mb-1 block text-xs text-muted-foreground">وضعیت</label>
            <Select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">همه</option>
              {Object.entries(TICKET_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-muted-foreground">دسته‌بندی</label>
            <Select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
              <option value="">همه</option>
              {Object.entries(TICKET_CATEGORY).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 py-0">
          {!data ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : data.items.length === 0 ? (
            <div className="p-6"><EmptyState icon={Search} title="تیکتی با این فیلترها یافت نشد" /></div>
          ) : (
            <Table>
              <THead>
                <TR><TH>موضوع</TH><TH>ارسال‌کننده</TH><TH>دسته‌بندی</TH><TH>تاریخ</TH><TH>وضعیت</TH><TH>عملیات</TH></TR>
              </THead>
              <TBody>
                {data.items.map((t) => (
                  <TR key={t.id}>
                    <TD className="max-w-xs truncate font-medium">{t.subject}</TD>
                    <TD>
                      <span className="font-medium">{t.name || "—"}</span>
                      <span className="block font-mono text-xs text-muted-foreground" dir="ltr">{toFa(t.phone)}</span>
                    </TD>
                    <TD>{TICKET_CATEGORY[t.category] || t.category}</TD>
                    <TD className="text-muted-foreground">
                      {formatJalaliDate(t.created_at)}
                      <span className="block tnum text-xs">{formatTime(t.created_at)}</span>
                    </TD>
                    <TD><StatusBadge kind="ticket" status={t.status} /></TD>
                    <TD>
                      <Button size="sm" variant="outline" onClick={() => setDetailId(t.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{toFa(data.total)} تیکت</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronRight className="h-4 w-4" /> قبلی
            </Button>
            <span className="text-sm">صفحه {toFa(page)} از {toFa(totalPages)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              بعدی <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {detailId && (
        <TicketDetail id={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}
    </div>
  );
}

function TicketDetail({ id, onClose, onChanged }) {
  const [t, setT] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  function load() {
    adminGetTicket(id).then(setT).catch(() => setT(false));
  }
  useEffect(load, [id]);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await adminReplyTicket(id, reply.trim());
      toast("پاسخ ارسال شد");
      setReply("");
      load();
      onChanged();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status) {
    setStatusSaving(true);
    try {
      await adminUpdateTicketStatus(id, status);
      toast("وضعیت تیکت به‌روزرسانی شد");
      load();
      onChanged();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} wide title="جزئیات تیکت" description={t ? t.subject : undefined}>
      {!t ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge kind="ticket" status={t.status} />
            <span className="text-xs text-muted-foreground">{TICKET_CATEGORY[t.category] || t.category}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field icon={User} label="نام" value={t.name || "—"} />
            <Field icon={Phone} label="تلفن" value={toFa(t.phone)} ltr />
            <Field icon={CalendarDays} label="تاریخ ارسال" value={`${formatJalaliDate(t.created_at)} ${formatTime(t.created_at)}`} />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">پیام</h3>
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-7">{t.message}</p>
          </div>

          {t.admin_reply && (
            <div>
              <h3 className="mb-2 text-sm font-bold">پاسخ ثبت‌شده</h3>
              <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-7">{t.admin_reply}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold">ارسال پاسخ</h3>
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ خود را بنویسید..." />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()}>
                {sending ? <Spinner /> : <Send className="h-3.5 w-3.5" />}
                ارسال پاسخ
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">تغییر وضعیت:</span>
              <Select value={t.status} onChange={(e) => changeStatus(e.target.value)} disabled={statusSaving} className="w-44">
                {Object.entries(TICKET_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </div>
            <Button variant="ghost" onClick={onClose}>بستن</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Field({ icon: Icon, label, value, ltr }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      <div className="mt-0.5 text-sm font-medium" dir={ltr ? "ltr" : undefined}>{value}</div>
    </div>
  );
}
