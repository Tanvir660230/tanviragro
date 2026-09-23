"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  ResponsiveContainer, LineChart as RechartsLine, Line, AreaChart as RechartsArea, Area,
  BarChart as RechartsBar, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"

export const CHART_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#84cc16", // lime-500
]

export const chartColorClass = {
  emerald: "text-emerald-500",
  blue: "text-blue-500",
  amber: "text-amber-500",
  violet: "text-violet-500",
  red: "text-red-500",
  cyan: "text-cyan-500",
  pink: "text-pink-500",
  lime: "text-lime-500",
}

/* ── ChartContainer ──────────────────────────────────────────────── */

export interface ChartContainerProps extends React.ComponentProps<"div"> {
  title?: string
  description?: string
  height?: number
  loading?: boolean
  action?: React.ReactNode
}

function ChartContainer({
  title, description, height = 260, loading = false, action, className, children, ...props
}: ChartContainerProps) {
  return (
    <div
      data-slot="chart-container"
      className={cn("rounded-2xl border border-border/70 bg-card p-4 sm:p-5", className)}
      {...props}
    >
      {(title || description || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {title && <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ── ChartTooltip ────────────────────────────────────────────────── */

export interface ChartTooltipPayload {
  name?: string | number
  value?: string | number
  color?: string
  dataKey?: string | number
}

export interface ChartTooltipProps {
  active?: boolean
  label?: string | number
  payload?: ChartTooltipPayload[]
  formatter?: (value: number | string, name: string) => React.ReactNode
}

function ChartTooltip({ active, label, payload, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-dropdown">
      {label !== undefined && label !== "" && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color ?? "#10b981" }} />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
            <span className="ml-auto pl-3 font-semibold text-foreground tabular-nums">
              {formatter ? formatter(entry.value ?? "", String(entry.name ?? "")) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── ChartLegend ─────────────────────────────────────────────────── */

export interface ChartLegendEntry {
  name: string
  color?: string
  value?: string | number
}

function ChartLegend({ items }: { items: ChartLegendEntry[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map(item => (
        <span key={item.name} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? "#10b981" }} />
          <span className="capitalize">{item.name}</span>
          {item.value !== undefined && <span className="font-semibold text-foreground tabular-nums">{item.value}</span>}
        </span>
      ))}
    </div>
  )
}

const defaultAxis = { stroke: "var(--border)" } as const
const tickStyle = { fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "inherit" } as const

export { ChartContainer, ChartTooltip, ChartLegend }

export interface ChartSeries {
  name: string
  dataKey: string
  color?: string
  yAxisId?: string
}

export interface ChartDataPoint {
  label: string
  [key: string]: string | number
}

interface BaseChartProps {
  data: ChartDataPoint[]
  series: ChartSeries[]
  xKey?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  stacked?: boolean
  formatY?: (value: string | number) => string
  formatX?: (value: string | number) => string
  className?: string
}

/* ── LineChart ───────────────────────────────────────────────────── */

function LineChartComponent({
  data, series, xKey = "label", height = 260, showGrid = true,
  showLegend = true, formatY, formatX, className,
}: BaseChartProps) {
  return (
    <div data-slot="line-chart" className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLine data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />}
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: defaultAxis.stroke }} tick={tickStyle} tickFormatter={formatX} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={tickStyle} tickFormatter={formatY} width={52} />
          <Tooltip content={<ChartTooltip formatter={(v, n) => `${formatY ? formatY(v) : v}`} />} />
          {showLegend && <Legend content={<ChartLegend items={series.map((s, i) => ({ name: s.name, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }))} />} />}
          {series.map((s, i) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </RechartsLine>
      </ResponsiveContainer>
    </div>
  )
}

/* ── AreaChart ───────────────────────────────────────────────────── */

function AreaChartComponent({
  data, series, xKey = "label", height = 260, showGrid = true, showLegend = true, formatY, className,
}: BaseChartProps) {
  return (
    <div data-slot="area-chart" className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsArea data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />}
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: defaultAxis.stroke }} tick={tickStyle} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={tickStyle} tickFormatter={formatY} width={52} />
          <Tooltip content={<ChartTooltip formatter={(v, n) => `${formatY ? formatY(v) : v}`} />} />
          {showLegend && <Legend content={<ChartLegend items={series.map((s, i) => ({ name: s.name, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }))} />} />}
          {series.map((s, i) => (
            <Area
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </RechartsArea>
      </ResponsiveContainer>
    </div>
  )
}

/* ── BarChart ────────────────────────────────────────────────────── */

export interface BarChartProps extends BaseChartProps {
  layout?: "horizontal" | "vertical"
  radius?: [number, number, number, number] | number
}

function BarChartComponent({
  data, series, xKey = "label", height = 260, showGrid = true,
  showLegend = true, stacked = false, formatY, className, layout = "horizontal", radius = 4,
}: BarChartProps) {
  return (
    <div data-slot="bar-chart" className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBar data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />}
          {layout === "vertical" ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={tickStyle} tickFormatter={formatY} />
              <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={{ stroke: defaultAxis.stroke }} tick={tickStyle} width={72} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: defaultAxis.stroke }} tick={tickStyle} dy={6} />
              <YAxis tickLine={false} axisLine={false} tick={tickStyle} tickFormatter={formatY} width={52} />
            </>
          )}
          <Tooltip content={<ChartTooltip formatter={(v, n) => `${formatY ? formatY(v) : v}`} />} />
          {showLegend && <Legend content={<ChartLegend items={series.map((s, i) => ({ name: s.name, color: s.color ?? CHART_COLORS[i % CHART_COLORS.length] }))} />} />}
          {series.map((s, i) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              stackId={stacked ? "stack" : undefined}
              radius={radius}
              maxBarSize={42}
            />
          ))}
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  )
}

/* ── PieChart / DonutChart ───────────────────────────────────────── */

export interface PieDatum {
  label: string
  value: number
  color?: string
}

export interface PieChartProps {
  data: PieDatum[]
  height?: number
  donut?: boolean
  innerRadius?: string | number
  outerRadius?: string | number
  showLegend?: boolean
  valueFormatter?: (value: number | string) => string
  className?: string
}

function PieChartComponent({
  data, height = 260, donut = false, innerRadius = 0, outerRadius = "78%",
  showLegend = true, valueFormatter, className,
}: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div data-slot="pie-chart" className={className}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPie margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={donut ? innerRadius || "58%" : innerRadius}
              outerRadius={outerRadius}
              paddingAngle={donut ? 2 : 1}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={d.label} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatter={(v, n) => valueFormatter ? valueFormatter(v) : String(v)} />} />
          </RechartsPie>
        </ResponsiveContainer>
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {data.map((d, i) => (
            <span key={d.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="capitalize">{d.label}</span>
              <span className="font-semibold text-foreground tabular-nums">
                {valueFormatter ? valueFormatter(d.value) : d.value}
              </span>
              <span className="opacity-70">({Math.round((d.value / Math.max(total, 1)) * 100)}%)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export {
  LineChartComponent as LineChart,
  AreaChartComponent as AreaChart,
  BarChartComponent as BarChart,
  PieChartComponent as PieChart,
}