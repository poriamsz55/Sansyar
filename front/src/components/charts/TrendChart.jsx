import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatJalaliDate, toFa } from "@/lib/utils";

function TrendTooltip({ active, payload, formatValue }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-soft-lg">
      <p className="mb-1 text-muted-foreground">{formatJalaliDate(point.payload.date)}</p>
      <p className="font-bold">{formatValue ? formatValue(point.value) : toFa(point.value)}</p>
    </div>
  );
}

/**
 * A single-series daily trend area chart. `data` is [{date: "YYYY-MM-DD", value}].
 * One hue per chart (this app never shows two trends overlaid on one axis).
 */
export function TrendChart({ data, color = "hsl(var(--primary))", formatValue, height = 220 }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`trend-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatJalaliDate(d).split(" ").slice(0, 2).join(" ")}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={{ stroke: "hsl(var(--border))" }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => toFa(v)}
          width={40}
        />
        <Tooltip content={<TrendTooltip formatValue={formatValue} />} cursor={{ stroke: "hsl(var(--border))" }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#trend-${color})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
