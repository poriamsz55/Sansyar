import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listUsers, listAllBookings } from "@/api/endpoints";
import { toFa } from "@/lib/utils";

export default function PlatformCustomers() {
  const [customers, setCustomers] = useState(null);
  const [bookingCounts, setBookingCounts] = useState({});

  useEffect(() => {
    Promise.all([listUsers("customer"), listAllBookings()]).then(([us, bookings]) => {
      setCustomers(us);
      const counts = {};
      for (const b of bookings) {
        counts[b.customer_id] = (counts[b.customer_id] || 0) + 1;
      }
      setBookingCounts(counts);
    });
  }, []);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{customers ? `${toFa(customers.length)} مشتری` : "..."}</p>
      <Card>
        <CardContent className="px-0 py-0">
          {!customers ? (
            <Skeleton className="m-4 h-48" />
          ) : (
            <Table>
              <THead>
                <TR><TH>نام</TH><TH>تلفن</TH><TH>رزروها</TH><TH>وضعیت</TH></TR>
              </THead>
              <TBody>
                {customers.map((c) => (
                  <TR key={c.id}>
                    <TD className="font-medium">{c.full_name}</TD>
                    <TD className="font-mono text-sm" dir="ltr">{c.phone}</TD>
                    <TD>{toFa(bookingCounts[c.id] || 0)}</TD>
                    <TD>
                      <Badge tone={c.status === "active" ? "success" : "destructive"}>
                        {c.status === "active" ? "فعال" : "معلق"}
                      </Badge>
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
