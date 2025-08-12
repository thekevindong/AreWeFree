"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { CourseData } from "@/lib/ics-parser"

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
const GAP_THRESHOLD_HOURS = 10 / 60
const BRAND = "#0F52BA"

export type OverlapGroup = {
  day: string
  startHour: number
  endHour: number
  events: CourseData[]
}

type Props = {
  events: CourseData[]
  startHour?: number
  endHour?: number
  hourHeight?: number
  minColWidth?: number
  onOpenGroup?: (group: OverlapGroup) => void
}

type BusySpan = {
  day: string
  person: string
  color: string
  startHour: number
  endHour: number
  startTime: string
  endTime: string
  events: CourseData[]
}

export function CalendarWeek(
  { events = [], startHour, endHour, hourHeight = 56, minColWidth = 160, onOpenGroup }: Props = {
    events: [],
    startHour: undefined,
    endHour: undefined,
    hourHeight: 56,
    minColWidth: 160,
    onOpenGroup: () => {},
  },
) {
  const weekdayEvents = useMemo(() => events.filter((e) => DAY_ORDER.includes(e.day)), [events])

  const busyByDay = useMemo(() => {
    const byDayPerson: Record<string, Record<string, CourseData[]>> = {}
    for (const e of weekdayEvents) {
      byDayPerson[e.day] = byDayPerson[e.day] || {}
      byDayPerson[e.day][e.person] = byDayPerson[e.day][e.person] || []
      byDayPerson[e.day][e.person].push(e)
    }
    const result: Record<string, BusySpan[]> = {}
    for (const day of DAY_ORDER) {
      const perPerson = byDayPerson[day] || {}
      const spans: BusySpan[] = []
      for (const person of Object.keys(perPerson)) {
        const list = perPerson[person].slice().sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour)
        if (!list.length) continue
        let curStart = list[0].startHour
        let curEnd = list[0].endHour
        let curEvents: CourseData[] = [list[0]]
        const color = list[0].color
        for (let i = 1; i < list.length; i++) {
          const ev = list[i]
          const gap = ev.startHour - curEnd
          if (gap <= GAP_THRESHOLD_HOURS) {
            curEnd = Math.max(curEnd, ev.endHour)
            curEvents.push(ev)
          } else {
            spans.push({
              day,
              person,
              color,
              startHour: curStart,
              endHour: curEnd,
              startTime: formatFromHour(curStart),
              endTime: formatFromHour(curEnd),
              events: curEvents.slice(),
            })
            curStart = ev.startHour
            curEnd = ev.endHour
            curEvents = [ev]
          }
        }
        spans.push({
          day,
          person,
          color,
          startHour: curStart,
          endHour: curEnd,
          startTime: formatFromHour(curStart),
          endTime: formatFromHour(curEnd),
          events: curEvents.slice(),
        })
      }
      spans.sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour)
      result[day] = spans
    }
    return result
  }, [weekdayEvents])

  const [minH, maxH] = useMemo(() => {
    return [8, 20] 
  }, [busyByDay])

  const H0 = startHour ?? minH
  const H1 = endHour ?? maxH
  const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i)

  const overlapsByDay = useMemo(() => {
    type Segment = { start: number; end: number; participants: BusySpan[] }
    const map: Record<string, Segment[]> = {}
    for (const day of DAY_ORDER) {
      const spans = busyByDay[day] || []
      const points: { t: number; type: "start" | "end"; span: BusySpan }[] = []
      for (const s of spans) {
        points.push({ t: s.startHour, type: "start", span: s })
        points.push({ t: s.endHour, type: "end", span: s })
      }
      points.sort((a, b) => (a.t === b.t ? (a.type === "end" ? -1 : 1) : a.t - b.t))
      const segs: Segment[] = []
      const active = new Set<BusySpan>()
      let lastT: number | null = null
      for (const p of points) {
        if (lastT !== null && p.t > lastT && active.size >= 2) {
          segs.push({ start: lastT, end: p.t, participants: Array.from(active) })
        }
        if (p.type === "start") active.add(p.span)
        else active.delete(p.span)
        lastT = p.t
      }
      map[day] = mergeTouching(segs)
    }
    return map

    function mergeTouching(segs: Segment[]) {
      if (!segs.length) return segs
      const same = (a: BusySpan[], b: BusySpan[]) =>
        a.length === b.length &&
        a.every((x) => b.some((y) => y.person === x.person && y.startHour === x.startHour && y.endHour === x.endHour))
      const out: Segment[] = []
      let cur = { ...segs[0], participants: segs[0].participants.slice() }
      for (let i = 1; i < segs.length; i++) {
        const s = segs[i]
        if ((s.start <= cur.end || Math.abs(s.start - cur.end) < 1e-6) && same(cur.participants, s.participants)) {
          cur.end = Math.max(cur.end, s.end)
        } else {
          out.push(cur)
          cur = { ...s, participants: s.participants.slice() }
        }
      }
      out.push(cur)
      return out
    }
  }, [busyByDay])

  return (
    <div className="h-full w-full overflow-hidden">
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: `68px repeat(${DAY_ORDER.length}, minmax(${minColWidth}px, 1fr))`,
          gridTemplateRows: "auto 1fr",
        }}
      >
        {/* Header Row */}
        <div className="pt-4 pb-3" />
        {DAY_ORDER.map((d) => (
          <div key={d} className="px-2 pt-4 pb-3">
            <div
              className="rounded-lg px-3 py-2 text-center text-sm font-medium text-slate-100 ring-1"
              style={{ background: `${BRAND}2F`, borderColor: `${BRAND}66` }}
            >
              {d.slice(0, 3)}
            </div>
          </div>
        ))}

        {/* Time labels */}
        <div className="relative">
          {hours.map((h) => (
            <div
              key={h}
              className="flex h-[var(--hour-h)] items-start justify-end pr-2 text-[11px] text-slate-600 md:text-xs"
              style={{ ["--hour-h" as any]: `${hourHeight}px` }}
            >
              <div className={cn("sticky top-0 translate-y-[-6px] text-slate-300")}>{formatHour(h)}</div>
            </div>
          ))}
        </div>

        {/* Columns */}
        {DAY_ORDER.map((day) => {
          const spans = busyByDay[day] || []
          const overlapSegs = overlapsByDay[day] || []
          return (
            <div key={day} className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="h-[var(--hour-h)]"
                  style={{ ["--hour-h" as any]: `${hourHeight}px`, borderTop: `1px solid ${BRAND}3F` }}
                />
              ))}

              <div className="pointer-events-none absolute inset-0">
                {spans.map((s, i) => {
                  const top = (s.startHour - H0) * hourHeight
                  const height = Math.max((s.endHour - s.startHour) * hourHeight, 26)
                  return (
                    <div
                      key={i}
                      className="pointer-events-auto absolute inset-x-2"
                      style={{ top, height, padding: 4 }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onOpenGroup?.({
                          day,
                          startHour: s.startHour,
                          endHour: s.endHour,
                          events: s.events,
                        })
                      }}
                      title={`${s.person} • ${s.startTime} – ${s.endTime}`}
                    >
                      <BusyCard span={s} />
                    </div>
                  )
                })}

                {overlapSegs.map((seg, idx) => {
                  const top = (seg.start - H0) * hourHeight
                  const height = Math.max((seg.end - seg.start) * hourHeight, 20)
                  const allEvents = seg.participants.flatMap((p) =>
                    p.events.filter((e) => e.startHour < seg.end && e.endHour > seg.start),
                  )
                  return (
                    <div
                      key={idx}
                      className="pointer-events-auto absolute inset-x-2 z-10"
                      style={{ top, height, padding: 4 }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onOpenGroup?.({
                          day,
                          startHour: seg.start,
                          endHour: seg.end,
                          events: allEvents,
                        })
                      }}
                      title={`OVERLAP • ${formatFromHour(seg.start)} – ${formatFromHour(seg.end)}`}
                    >
                      <OverlapCard />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BusyCard({ span }: { span: BusySpan }) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col rounded-xl ring-1 text-white shadow-[0_8px_20px_rgba(0,0,0,.12)]",
      )}
      style={{
        borderColor: "#64748B",
        background: glassGradient(span.color, 0.65),
      }}
    >
      {/* Person name at top */}
      <div className="flex-shrink-0 px-2 pt-2 text-center">
        <div className="truncate text-xs font-semibold leading-tight text-white">{span.person}</div>
      </div>

      {/* Time at bottom */}
      <div className="mt-auto flex-shrink-0 px-2 pb-2 text-center">
        <div className="text-[10px] leading-tight text-white/90">
          {span.startTime} – {span.endTime}
        </div>
      </div>
    </div>
  )
}

function OverlapCard() {
  return (
    <div className="relative flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/90 to-rose-600/80 ring-2 ring-rose-400 shadow-lg">
      <div className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_20px_rgba(0,0,0,.15)]" />

      {/* Simple centered OVERLAP badge */}
      <div className="rounded-md bg-rose-700 px-2 py-1 text-xs font-bold leading-none text-white shadow-sm">
        OVERLAP ⚠️
      </div>
    </div>
  )
}

/* Utilities */
function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM"
  const d = h % 12 === 0 ? 12 : h % 12
  return `${d} ${period}`
}

function formatFromHour(h: number) {
  const totalMin = Math.round(h * 60)
  const hour = Math.floor(totalMin / 60)
  const minute = totalMin % 60
  const period = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
}

function glassGradient(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `linear-gradient(180deg, rgba(${r},${g},${b},${alpha}) 0%, rgba(${r},${g},${b},${alpha * 0.7}) 60%, rgba(0,0,0,0.10) 100%)`
}

function hexToRgb(hex: string) {
  let m = hex.replace("#", "")
  if (m.length === 3)
    m = m
      .split("")
      .map((c) => c + c)
      .join("")
  const bigint = Number.parseInt(m, 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}
