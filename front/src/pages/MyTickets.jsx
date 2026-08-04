import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquare, LifeBuoy, CalendarDays } from "lucide-react";

import { PageTransition, EmptyState } from "@/components/PageTransition";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { myTickets } from "@/api/endpoints";
import { useAuth } from "@/context/AuthContext";
import { TICKET_CATEGORY } from "@/lib/constants";
import { formatJalaliDate, formatJalaliWeekday } from "@/lib/utils";

export default function MyTickets() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [tickets, setTickets] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login?redirect=/my-tickets");
      return;
    }
    myTickets().then((items) =>
      setTickets([...items].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    );
  }, [isAuthenticated]);

  return (
    <PageTransition>
      <div className="container max-w-4xl py-8">
        <h1 className="text-2xl font-extrabold">تیکت‌های من</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          وضعیت پیام‌ها و گزارش‌های ارسالی‌ات را اینجا پیگیری کن.
        </p>

        <div className="mt-6 space-y-4">
          {!tickets ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="هنوز تیکتی ثبت نکرده‌ای"
              description="از فوتر سایت می‌توانی با ما در تماس باشی یا مشکلی را گزارش کنی."
              action={<Button onClick={() => navigate("/")}>بازگشت به خانه</Button>}
            />
          ) : (
            tickets.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        <MessageSquare className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-bold">{t.subject}</h3>
                        <p className="text-xs text-muted-foreground">
                          {TICKET_CATEGORY[t.category] || t.category}
                        </p>
                      </div>
                    </div>
                    <StatusBadge kind="ticket" status={t.status} />
                  </div>

                  <p className="mt-3 text-sm leading-7 text-foreground/80">{t.message}</p>

                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatJalaliWeekday(t.created_at)}، {formatJalaliDate(t.created_at)}
                  </p>

                  {t.admin_reply && (
                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="mb-1 text-xs font-semibold text-primary">پاسخ پشتیبانی</p>
                      <p className="text-sm leading-7">{t.admin_reply}</p>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
