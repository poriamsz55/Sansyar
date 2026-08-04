import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { toFa } from "@/lib/utils";

function RankTooltip({ active, payload, formatValue }) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-soft-lg">
      <p className="mb-1 font-semibold">{row.payload.label}</p>
      <p className="font-bold">{formatValue ? formatValue(row.value) : toFa(row.value)}</p>
    </div>
  );
}

/**
 * Horizontal ranked bar chart: one bar per category, all same hue by default
 * (categories are already distinguished by their label, not color) unless
 * `colorFor(row)` is passed — used for the one chart that legitimately
 * encodes state (reservations by status), where each bar's color is that
 * status's already-established tone.
 */
export function RankBarChart({
  data,
  dataKey = "count",
  color = "hsl(var(--primary))",
  colorFor,
  formatValue,
  height,
}) {
  if (!data?.length) return null;
  const rowHeight = 36;
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(120, data.length * rowHeight)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => toFa(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<RankTooltip formatValue={formatValue} />} cursor={{ fill: "hsl(var(--accent))" }} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((row, i) => (
            <Cell key={i} fill={colorFor ? colorFor(row) : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
