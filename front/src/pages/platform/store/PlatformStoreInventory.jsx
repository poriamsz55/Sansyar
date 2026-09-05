import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Minus, PackageSearch, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/Toast";
import { PageTransition } from "@/components/PageTransition";
import { adminListInventory, adminAdjustStock, adminListInventoryLogs } from "@/api/endpoints";
import { toFa } from "@/lib/utils";

const LOW_STOCK = 3;

function formatAt(iso) {
  try {
    return new Date(iso).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

const REASONS = {
  reserve: "رزرو سفارش",
  release: "آزادسازی رزرو",
  sale: "فروش",
  restock: "بازگشت کالا",
  reserve_rollback: "لغو رزرو",
};

/**
 * Platform: live inventory across all variants — stock, reserved, available;
 * manual adjustments and the per-variant audit trail.
 */
export default function PlatformStoreInventory() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [adjusting, setAdjusting] = useState(null); // variant row
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [logsFor, setLogsFor] = useState(null); // variant row
  const [logs, setLogs] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminListInventory()
      .then(setRows)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const filtered = (rows || []).filter((r) =>
    !q || r.productName.includes(q) || (r.sku || "").toLowerCase().includes(q.toLowerCase()) || (r.name || "").includes(q)
  );
  const lowCount = (rows || []).filter((r) => r.stock - r.reserved <= LOW_STOCK).length;

  async function applyAdjust() {
    const n = parseInt(delta, 10);
    if (!n) {
      toast("یک عدد غیرصفر وارد کنید", "error");
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      toast("دلیل تغییر را بنویسید", "error");
      return;
    }
    setBusy(true);
    try {
      await adminAdjustStock(adjusting.id, n, reason.trim());
      toast("موجودی به‌روزرسانی شد");
      setAdjusting(null);
      setDelta("");
      setReason("");
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function openLogs(row) {
    setLogsFor(row);
    setLogs(null);
    adminListInventoryLogs({ variantId: row.id })
      .then(setLogs)
      .catch((err) => toast(err.message, "error"));
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-black">انبار و موجودی</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            موجودی هر گونه، رزرو سفارش‌های پرداخت‌نشده و تغییرات دستی
            {rows && lowCount > 0 && (
              <Badge tone="warning" className="mr-2">{toFa(lowCount)} گونه کم‌موجود</Badge>
            )}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول، گونه یا SKU…" className="pr-9" />
        </div>

        {error && <Card><CardContent className="p-4 text-sm text-destructive">{error} — <button className="underline" onClick={load}>تلاش مجدد</button></CardContent></Card>}

        {!rows && [...Array(6)].map((_, i) => <Skeleton key={i} className="h-14" />)}

        {rows && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-right text-xs text-muted-foreground">
                      <th className="p-3 font-medium">محصول / گونه</th>
                      <th className="p-3 font-medium">SKU</th>
                      <th className="p-3 font-medium">موجودی</th>
                      <th className="p-3 font-medium">رزرو</th>
                      <th className="p-3 font-medium">قابل فروش</th>
                      <th className="p-3 font-medium">اقدامات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const available = row.stock - (row.reserved || 0);
                      return (
                        <tr key={row.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                          <td className="p-3">
                            <Link to={`/platform/store/products/${row.productId}`} className="font-medium hover:text-primary">
                              {row.productName}
                            </Link>
                            {row.name && <span className="text-xs text-muted-foreground"> — {row.name}</span>}
                          </td>
                          <td className="p-3 font-mono text-xs" dir="ltr">{row.sku}</td>
                          <td className="p-3">{toFa(row.stock)}</td>
                          <td className="p-3">{row.reserved ? <Badge tone="primary">{toFa(row.reserved)}</Badge> : "۰"}</td>
                          <td className="p-3">
                            {available <= 0 ? (
                              <Badge tone="destructive">ناموجود</Badge>
                            ) : available <= LOW_STOCK ? (
                              <Badge tone="warning">{toFa(available)} — کم</Badge>
                            ) : (
                              toFa(available)
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => setAdjusting(row)}>
                                <Plus className="h-3.5 w-3.5" /> تغییر موجودی
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openLogs(row)}>
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <PackageSearch className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        گونه‌ای یافت نشد
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Adjust stock dialog */}
      <Dialog open={!!adjusting} onClose={() => setAdjusting(null)} title={`تغییر موجودی — ${adjusting?.productName || ""} ${adjusting?.name ? `(${adjusting.name})` : ""}`}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            موجودی فعلی: {toFa(adjusting?.stock ?? 0)} — رزرو: {toFa(adjusting?.reserved ?? 0)}
          </p>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label>تغییر (مثبت یا منفی)</Label>
              <Input
                dir="ltr"
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="مثلاً 10 یا -3"
              />
            </div>
            <div className="flex gap-1 pb-1">
              <Button variant="outline" size="icon" onClick={() => setDelta((d) => String((parseInt(d, 10) || 0) + 1))}><Plus className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => setDelta((d) => String((parseInt(d, 10) || 0) - 1))}><Minus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>دلیل (برای گزارش انبار)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً: رسید انبار جدید" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAdjusting(null)}>انصراف</Button>
            <Button disabled={busy} onClick={applyAdjust}>ثبت تغییر</Button>
          </div>
        </div>
      </Dialog>

      {/* Inventory logs dialog */}
      <Dialog open={!!logsFor} onClose={() => setLogsFor(null)} title={`تاریخچه انبار — ${logsFor?.productName || ""}`} wide>
        {!logs ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : logs.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">تغییری ثبت نشده است</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-xs">
                <div>
                  <p className="font-bold">{REASONS[log.reason] || log.reason}{log.order_id ? ` — سفارش ${log.order_id.slice(0, 8)}` : ""}</p>
                  <p className="mt-0.5 text-muted-foreground">{formatAt(log.at)}</p>
                </div>
                <div className="flex gap-2 font-mono" dir="ltr">
                  {log.delta !== 0 && <span className={log.delta > 0 ? "text-success" : "text-destructive"}>stock {log.delta > 0 ? "+" : ""}{log.delta}</span>}
                  {log.reserved !== 0 && <span className="text-primary">rsv {log.reserved > 0 ? "+" : ""}{log.reserved}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </PageTransition>
  );
}
