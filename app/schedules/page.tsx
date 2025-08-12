"use client"

import { useCallback } from "react"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Calendar, CircleAlert, Download, Loader2, Users, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { CalendarWeek, type OverlapGroup } from "@/components/calendar-week"
import { EventDetailsDialog } from "@/components/event-details"
import { createICSParser, type CourseData } from "@/lib/ics-parser"
import { getUploads, clearUploads, saveUploads, type StoredUpload } from "@/lib/storage"
import { toPng } from "html-to-image"
import { Input } from "@/components/ui/input"

const BRAND = "#0F52BA"
const GAP_THRESHOLD_HOURS = 10 / 60
const defaultPalette = [BRAND, "#10B981", "#F59E0B", "#EC4899", "#06B6D4"] // Removed one more color to make it 5

export default function SchedulesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [uploads, setUploads] = useState<StoredUpload[]>([])
  const [events, setEvents] = useState<CourseData[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<OverlapGroup | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const calendarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const data = getUploads()
    setUploads(data)
    if (!data.length) {
      toast({ title: "No uploads found", description: "Add .ics files first." })
      router.replace("/")
      return
    }
    reparse(data)
  }, [router, toast])

  const stats = useMemo(() => buildAnalytics(events), [events])

  const reparse = (data: StoredUpload[]) => {
    setLoading(true)
    ;(async () => {
      const parser = createICSParser()
      const out: CourseData[] = []
      for (let i = 0; i < data.length; i++) {
        const u = data[i]
        try {
          const items = await parser.parseICSString(u.content, u.person, u.color)
          out.push(...items)
        } catch (e: any) {
          console.error(e)
        }
      }
      setEvents(out)
      setLoading(false)
    })()
  }

  const updateUpload = useCallback(
    (id: string, patch: Partial<StoredUpload>) => {
      setUploads((prev) => {
        const next = prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
        saveUploads(next)
        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => reparse(next), 200)
        return next
      })
    },
    [setUploads],
  )

  async function handleExport() {
    if (!calendarRef.current) {
      toast({ title: "Nothing to export", description: "Render the calendar first." })
      return
    }
    try {
      setExporting(true)
      const dataUrl = await toPng(calendarRef.current, {
        backgroundColor: "#1e293b", // Changed from #ffffff to a dark background color
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: false,
      })
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `whenwefree-week.png`
      a.click()
      toast({ title: "Exported", description: "Calendar saved as PNG." })
    } catch (e) {
      console.error(e)
      toast({ title: "Export failed", description: "Try again or reduce the calendar size." })
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#0f2027] via-[#203a43] to-[#2c5364] text-slate-100">
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2" style={{ background: `${BRAND}1A`, border: `1px solid ${BRAND}33` }}>
              <Calendar className="h-5 w-5" style={{ color: BRAND }} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Weekly Schedules ✨</h1>
            </div>
          </div>
          <div
            className="flex items-center gap-3 rounded-lg px-3 py-2 backdrop-blur"
            style={{ background: "#1e293bcc", border: "1px solid #475569" }}
          >
            <div className="hidden items-center gap-2 md:flex">
              <Users className="h-4 w-4 text-slate-300" />
              <span className="text-sm text-slate-300">{stats.people}</span>
              <Separator orientation="vertical" className="mx-2 h-4 bg-slate-600" />
              <Calendar className="h-4 w-4 text-slate-300" />
              <span className="text-sm text-slate-300">{stats.classes}</span>
              <Separator orientation="vertical" className="mx-2 h-4 bg-slate-600" />
              <CircleAlert className="h-4 w-4 text-slate-300" />
              <span className="text-sm text-slate-300">{stats.overlapBlocks}</span>
            </div>
            <Button
              variant="outline"
              className="border-slate-600 bg-slate-700/80 text-slate-200 hover:bg-slate-600"
              onClick={handleExport}
              disabled={exporting || loading}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? "Exporting..." : "Export"}
            </Button>
            <Button
              className="text-white hover:brightness-110"
              style={{ background: BRAND }}
              onClick={() => {
                clearUploads()
                router.push("/")
              }}
            >
              New Upload
            </Button>
          </div>
        </header>

        <div className="space-y-6">
          <Card className="border-slate-600 bg-slate-800/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Weekly Calendar 📅</CardTitle>
              <CardDescription className="text-slate-300">Click a block for full class details.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-80 items-center justify-center text-slate-300">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Parsing schedules...
                </div>
              ) : events.length === 0 ? (
                <div className="flex h-80 items-center justify-center text-slate-600">No classes found.</div>
              ) : (
                <div className="rounded-3xl border border-slate-600 bg-slate-700/70 p-3 md:p-4">
                  <div ref={calendarRef} className="h-[750px]">
                    <CalendarWeek events={events} onOpenGroup={(g) => setSelectedGroup(g)} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Students */}
          <Card className="border-slate-600 bg-slate-800/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-slate-300" />
                Students 👨‍🎓
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {uploads.map((u) => {
                  const p = perPerson(u.person, events)
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-700/70 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className="grid h-12 w-12 place-items-center rounded-full text-base font-semibold"
                          style={{
                            background: "#1e293b",
                            color: "#f8fafc",
                            border: "1px solid rgba(148,163,184,.35)",
                          }}
                          aria-hidden
                        >
                          {getInitials(u.person)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Input
                              className="h-8 w-40 border-slate-600 bg-slate-700 text-slate-100 focus:ring-0 focus:outline-none"
                              value={u.person}
                              onChange={(e) => updateUpload(u.id, { person: e.target.value })}
                            />
                            <span
                              className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
                              style={{ background: u.color }}
                              aria-hidden
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                            <Chip icon="📚">{p.classes} classes</Chip>
                            <Chip icon="⏱️">{p.busyHours.toFixed(1)} busy hrs</Chip>
                            <Chip icon="⚠️">{p.overlapBlocks} overlaps</Chip>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {" "}
                        {/* Changed to flex-col */}
                        <div className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-700/70 px-2 py-1">
                          <span className="text-xs text-slate-300">Color</span>
                          <input
                            id={`c-${u.id}`}
                            type="color"
                            value={u.color}
                            onChange={(e) => updateUpload(u.id, { color: e.target.value })}
                            className="h-6 w-8 cursor-pointer rounded-md border-0 bg-transparent p-0"
                            aria-label="Pick color"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {" "}
                          {/* Added pre-toggled colors */}
                          {defaultPalette.map((paletteColor, index) => (
                            <button
                              key={index}
                              className="h-5 w-5 rounded-full ring-1 ring-white/50 hover:ring-2"
                              style={{ backgroundColor: paletteColor }}
                              onClick={() => updateUpload(u.id, { color: paletteColor })}
                              aria-label={`Set color to ${paletteColor}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-slate-600 bg-slate-800/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-slate-300" />
                Schedule Analysis Summary 📊
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryLine icon="📚" label="Total classes" value={String(stats.classes)} />
                <SummaryLine icon="👥" label="People" value={String(stats.people)} />
                <SummaryLine icon="⏱️" label="Total busy hours" value={`${stats.totalBusyHours.toFixed(1)} hrs`} />
                <SummaryLine icon="⚠️" label="Overlap time blocks" value={String(stats.overlapBlocks)} />
                <SummaryLine
                  icon="🏆"
                  label="Busiest person"
                  value={`${stats.busiest.person ?? "—"} (${stats.busiest.hours.toFixed(1)} hrs)`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EventDetailsDialog
        group={selectedGroup}
        onOpenChange={(o) => !o && setSelectedGroup(null)}
        uploads={uploads}
        setUploads={setUploads}
      />
    </main>
  )
}

function Chip({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-1 text-slate-200 ring-1 ring-slate-600">
      {icon && <span className="mr-1">{icon}</span>}
      {children}
    </span>
  )
}

function SummaryLine({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/70 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-slate-300">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-100">{value}</span>
    </div>
  )
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* Analytics helpers (per person quick view) */
function perPerson(person: string, events: CourseData[]) {
  const DAY_SET = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
  const list = events.filter((e) => e.person === person && DAY_SET.has(e.day))
  list.sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour)
  const spans: { start: number; end: number }[] = []
  for (const e of list) {
    if (!spans.length) spans.push({ start: e.startHour, end: e.endHour })
    else {
      const last = spans[spans.length - 1]
      if (e.startHour - last.end <= GAP_THRESHOLD_HOURS) last.end = Math.max(last.end, e.endHour)
      else spans.push({ start: e.startHour, end: e.endHour })
    }
  }
  const busyHours = spans.reduce((acc, s) => acc + (s.end - s.start), 0)
  // Count overlaps involving this person
  let overlapBlocks = 0
  const byDay = groupBy(events, (x) => x.day)
  for (const day of Object.keys(byDay)) {
    const sameDay = byDay[day].filter((e) => e.person === person)
    const others = byDay[day].filter((e) => e.person !== person)
    for (const s of sameDay) {
      if (others.some((o) => s.startHour < o.endHour && o.startHour < s.endHour)) overlapBlocks++
    }
  }
  return { classes: list.length, busyHours, overlapBlocks }
}

function groupBy<T, K extends string | number>(arr: T[], key: (x: T) => K): Record<K, T[]> {
  return arr.reduce(
    (acc, cur) => {
      const k = key(cur)
      ;(acc[k] ||= []).push(cur)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

function buildBusySpansByDay(events: CourseData[]) {
  const DAY_SET = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
  const byDayPerson: Record<string, Record<string, CourseData[]>> = {}
  for (const e of events) {
    if (!DAY_SET.has(e.day)) continue
    byDayPerson[e.day] = byDayPerson[e.day] || {}
    byDayPerson[e.day][e.person] = byDayPerson[e.day][e.person] || []
    byDayPerson[e.day][e.person].push(e)
  }
  const result: Record<string, { person: string; start: number; end: number }[]> = {}
  for (const day of Object.keys(byDayPerson)) {
    const spans: { person: string; start: number; end: number }[] = []
    for (const person of Object.keys(byDayPerson[day])) {
      const list = byDayPerson[day][person].slice().sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour)
      let s = list[0].startHour
      let e = list[0].endHour
      for (let i = 1; i < list.length; i++) {
        const ev = list[i]
        if (ev.startHour - e <= GAP_THRESHOLD_HOURS) e = Math.max(e, ev.endHour)
        else {
          spans.push({ person, start: s, end: e })
          s = ev.startHour
          e = ev.endHour
        }
      }
      spans.push({ person, start: s, end: e })
    }
    result[day] = spans
  }
  return result
}

function buildOverlapSegments(spansByDay: Record<string, { person: string; start: number; end: number }[]>) {
  const out: Record<string, { start: number; end: number; participants: string[] }[]> = {}
  for (const day of Object.keys(spansByDay)) {
    const spans = spansByDay[day]
    const pts: { t: number; type: "start" | "end"; p: string }[] = []
    for (const s of spans) {
      pts.push({ t: s.start, type: "start", p: s.person })
      pts.push({ t: s.end, type: "end", p: s.person })
    }
    pts.sort((a, b) => (a.t === b.t ? (a.type === "end" ? -1 : 1) : a.t - b.t))
    const segs: { start: number; end: number; participants: string[] }[] = []
    const active = new Map<string, number>()
    let last: number | null = null
    for (const pt of pts) {
      if (last !== null && pt.t > last) {
        const participants = Array.from(active.keys())
        if (participants.length >= 2) segs.push({ start: last, end: pt.t, participants })
      }
      if (pt.type === "start") active.set(pt.p, (active.get(pt.p) || 0) + 1)
      else {
        const v = (active.get(pt.p) || 1) - 1
        if (v <= 0) active.delete(pt.p)
        else active.set(pt.p, v)
      }
      last = pt.t
    }
    out[day] = segs
  }
  return out
}

function buildAnalytics(events: CourseData[]) {
  const people = Array.from(new Set(events.map((e) => e.person))).length
  const classes = events.length
  const spansByDay = buildBusySpansByDay(events)
  let totalBusy = 0
  for (const day of Object.keys(spansByDay)) {
    for (const s of spansByDay[day]) totalBusy += s.end - s.start
  }
  const overlapSegs = buildOverlapSegments(spansByDay)
  const overlapBlocks = Object.values(overlapSegs).reduce((acc, segs) => acc + segs.length, 0)

  const hoursByPerson: Record<string, number> = {}
  for (const day of Object.keys(spansByDay)) {
    for (const s of spansByDay[day]) hoursByPerson[s.person] = (hoursByPerson[s.person] || 0) + (s.end - s.start)
  }
  let busiest = { person: "", hours: 0 }
  for (const p of Object.keys(hoursByPerson)) {
    if (hoursByPerson[p] > busiest.hours) busiest = { person: p, hours: hoursByPerson[p] }
  }
  return { people, classes, totalBusyHours: totalBusy, overlapBlocks, busiest }
}
