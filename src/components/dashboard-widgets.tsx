/**
 * Dashboard widgets shell built on DraggableWidgetGrid.
 * Each widget renders one dashboard metric block. Data is fetched on the
 * server (dashboard page) and passed down; the grid only handles layout.
 */
'use client'

import { DraggableWidgetGrid, type WidgetItem, type WidgetSize } from './ui/draggable-widget-grid'
import { Badge } from './ui/badge'
import Link from 'next/link'

export type DashboardData = {
  todayRows: {
    appointment_id: number
    patient_name: string
    doctor_name: string
    appt_time: string
    status: 'booked' | 'completed' | 'cancelled'
  }[]
  todayCount: number
  bookingCount: number
  completedCount: number
  cancelledCount: number
  revenue: { month: string; revenue: number }[]
  pendingBills: { count: number; amount: number }
  lowStock: { name: string; stock: number }[]
  workload: { doctor_name: string; total_appointments: number }[]
}

/* ------------------------------------------------------------------ *
 * Widget shell — consistent chrome inside every grid cell
 * ------------------------------------------------------------------ */

function Shell({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <div className="@container flex h-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between text-[14px] leading-none">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">{title}</h3>
        {meta ? <span className="font-mono text-[11px] text-mute">{meta}</span> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

function Big({ children, unit }: { children: React.ReactNode; unit?: string }) {
  return (
    <p className="font-serif text-[32px] leading-none tracking-[-0.03em] tabular-nums">
      {children}
      {unit && <span className="ml-1 font-mono text-[13px] text-mute">{unit}</span>}
    </p>
  )
}

const STATUS_TONE = { booked: 'blue', completed: 'green', cancelled: 'red' } as const

/* ------------------------------------------------------------------ *
 * Widgets
 * ------------------------------------------------------------------ */

type Kind = 'todayCount' | 'todayList' | 'revenue' | 'pendingBills' | 'lowStock' | 'workload'
export interface DashboardWidget extends WidgetItem {
  kind: Kind
}

function TodayCount({ data }: { data: DashboardData }) {
  return (
    <Shell title="Appointments today">
      <div className="mt-auto flex items-end justify-between gap-4">
        <Big>{data.todayCount}</Big>
        <span className="flex items-center justify-end gap-2 py-1">
          <Badge tone="blue">{data.bookingCount} booked</Badge>
          <Badge tone="green">{data.completedCount} done</Badge>
        </span>
      </div>
    </Shell>
  )
}

function TodayList({ data }: { data: DashboardData }) {
  return (
    <Shell title="Today's appointments" meta="first 5">
      <ol className="mt-auto space-y-2 text-sm">
        {data.todayRows.slice(0, 5).map((row) => (
          <li key={row.appointment_id} className="flex items-center justify-between gap-3">
            <Link
              href={`/appointments/${row.appointment_id}`}
              className="flex min-w-0 items-center gap-3 truncate hover:text-mute"
            >
              <span className="font-mono text-xs text-mute">{row.appt_time.slice(0, 5)}</span>
              <span className="truncate">{row.patient_name}</span>
              <span aria-hidden="true" className="truncate text-mute">
                · {row.doctor_name}
              </span>
            </Link>
            <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
          </li>
        ))}
        {data.todayRows.length === 0 ? (
          <li className="text-sm text-mute">No appointments today.</li>
        ) : (
          <li className="pt-1 text-xs text-mute">
            {Math.max(0, data.todayCount - data.todayRows.length)} more
          </li>
        )}
      </ol>
    </Shell>
  )
}

function Revenue({ data }: { data: DashboardData }) {
  const rows = data.revenue.slice(-6)
  const max = Math.max(1, ...rows.map((r) => r.revenue))
  const total = rows.reduce((sum, r) => sum + r.revenue, 0)
  return (
    <Shell title="Revenue" meta="last 6 months">
      <div className="flex items-baseline gap-2">
        <Big>₹ {total.toLocaleString('en-IN')}</Big>
      </div>
      <div className="mt-auto flex items-end gap-[3px]" aria-hidden="true">
        {rows.map((r) => (
          <span
            key={r.month}
            className="h-10 flex-1 rounded-t-[3px] bg-ink/10"
            style={{ height: `${Math.max(8, (r.revenue / max) * 100)}%` }}
          />
        ))}
      </div>
    </Shell>
  )
}

function PendingBills({ data }: { data: DashboardData }) {
  return (
    <Shell title="Pending bills">
      <div className="mt-auto flex items-end justify-between gap-4">
        <Big unit="bills">{data.pendingBills.count}</Big>
        <span className="text-sm text-mute tabular-nums">
          ₹ {data.pendingBills.amount.toLocaleString('en-IN')}
        </span>
      </div>
    </Shell>
  )
}

function LowStock({ data }: { data: DashboardData }) {
  return (
    <Shell title="Low stock" meta="< 10 units">
      <ol className="mt-auto space-y-2 text-sm">
        {data.lowStock.length === 0 ? (
          <li className="text-mute">All medicines sufficiently stocked.</li>
        ) : (
          data.lowStock.slice(0, 5).map((med) => (
            <li key={med.name} className="flex items-center justify-between gap-3">
              <span className="truncate">{med.name}</span>
              <Badge tone="yellow">{med.stock} left</Badge>
            </li>
          ))
        )}
      </ol>
    </Shell>
  )
}

function Workload({ data }: { data: DashboardData }) {
  const rows = data.workload.slice(0, 4)
  const max = Math.max(1, ...rows.map((w) => w.total_appointments))
  return (
    <Shell title="Doctor workload" meta="all time">
      <ol className="mt-auto space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.doctor_name} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{row.doctor_name}</span>
            <span className="flex flex-1 items-center justify-end gap-2">
              <span className="h-[3px] flex-1 max-w-24 rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-ink/60"
                  style={{ width: `${(row.total_appointments / max) * 100}%` }}
                />
              </span>
              <span className="font-mono text-xs text-mute">{row.total_appointments}</span>
            </span>
          </li>
        ))}
      </ol>
    </Shell>
  )
}

/* ------------------------------------------------------------------ *
 * Grid host
 * ------------------------------------------------------------------ */

const WIDGET_MAP: Record<Kind, (p: { data: DashboardData }) => React.ReactNode> = {
  todayCount: TodayCount,
  todayList: TodayList,
  revenue: Revenue,
  pendingBills: PendingBills,
  lowStock: LowStock,
  workload: Workload,
}

export default function DashboardWidgets({ data }: { data: DashboardData }) {
  const widgets: DashboardWidget[] = [
    { id: 'todayCount', kind: 'todayCount', size: 'sm', label: 'Appointments today' },
    { id: 'pendingBills', kind: 'pendingBills', size: 'sm', label: 'Pending bills' },
    { id: 'lowStock', kind: 'lowStock', size: 'sm', label: 'Low stock medicines' },
    { id: 'workload', kind: 'workload', size: 'sm', label: 'Doctor workload' },
    { id: 'revenue', kind: 'revenue', size: 'wide', label: 'Revenue' },
    { id: 'todayList', kind: 'todayList', size: 'wide', label: "Today's appointments" },
  ]
  const renderWidget = (item: WidgetItem) => {
    const W = WIDGET_MAP[(item as DashboardWidget).kind]
    return <W data={data} />
  }
  return (
    <DraggableWidgetGrid
      items={widgets}
      renderItem={renderWidget as (item: WidgetItem, size: WidgetSize) => React.ReactNode}
      radius={12}
      className="min-h-[640px]"
    />
  )
}
