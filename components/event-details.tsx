"use client"

import type React from "react"
import { Fragment, useMemo } from "react"
import { CalendarDays, MapPin, School, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input" // Import Input
import type { OverlapGroup } from "./calendar-week"
import type { CourseData } from "@/lib/ics-parser"
import type { StoredUpload } from "@/lib/storage" // Import StoredUpload type

const BRAND = "#0F52BA"

export function EventDetailsDialog(
  {
    group,
    onOpenChange,
    uploads, 
    setUploads, 
  }: {
    group: OverlapGroup | null
    onOpenChange?: (open: boolean) => void
    uploads: StoredUpload[] 
    setUploads: (updater: StoredUpload[] | ((p: StoredUpload[]) => StoredUpload[])) => void 
  } = { group: null, onOpenChange: () => {}, uploads: [], setUploads: () => {} },
) {
  const open = !!group

  const byPerson = useMemo(() => {
    if (!group) return []
    const map = new Map<string, { person: string; color: string; classes: CourseData[] }>()
    for (const e of group.events) {
      const key = e.person
      if (!map.has(key)) map.set(key, { person: e.person, color: e.color, classes: [] })
      map.get(key)!.classes.push(e)
    }
    const arr = Array.from(map.values()).map((p) => ({
      ...p,
      classes: p.classes.slice().sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour),
    }))
    arr.sort((a, b) => a.person.localeCompare(b.person))
    return arr
  }, [group])

  const totals = useMemo(() => {
    if (!group) return { count: 0, people: 0, durMin: 0 }
    const count = group.events.length
    const people = new Set(group.events.map((e) => e.person)).size
    const durMin = Math.round((group.endHour - group.startHour) * 60)
    return { count, people, durMin }
  }, [group])

  const handlePersonNameChange = (oldName: string, newName: string) => {
    setUploads((prevUploads) => {
      const updatedUploads = prevUploads.map((upload) => {
        if (upload.person === oldName) {
          return { ...upload, person: newName }
        }
        return upload
      })
      return updatedUploads
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-slate-600 bg-slate-800/95 text-slate-100 backdrop-blur max-h-[calc(100vh-100px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {group ? `${totals.count} ${totals.count === 1 ? "Class" : "Classes"}` : "Details"}
            <div className="ml-1 flex items-center gap-2">
              {byPerson.slice(0, 4).map((p, i) => (
                <span
                  key={p.person + i}
                  className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
                  style={{ background: p.color }}
                />
              ))}
            </div>
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            {group ? `${group.day} • ${formatWindow(group.startHour)} – ${formatWindow(group.endHour)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {byPerson.map((p) => (
            <section key={p.person} className="rounded-xl border border-slate-600 bg-slate-700/70">
              <div className="flex items-center gap-2 border-b border-slate-600 px-4 py-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
                  style={{ background: p.color }}
                />
                <Input
                  className="h-8 w-40 border-slate-600 bg-slate-700 text-slate-100 focus:ring-0 focus:outline-none"
                  value={p.person}
                  onChange={(e) => handlePersonNameChange(p.person, e.target.value)}
                />
              </div>

              <div className="space-y-3 p-3">
                {p.classes.map((e, idx) => (
                  <Card key={idx} className="border-slate-600 bg-slate-700/80">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <School className="h-4 w-4 text-slate-300" />
                          {e.courseCode}
                        </span>
                        <span
                          className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                          style={{ background: e.color }}
                          aria-hidden
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                      <InfoItem icon={<CalendarDays className="h-4 w-4" />} label="Schedule">
                        {e.day}, {e.startTime} – {e.endTime}
                      </InfoItem>
                      <InfoItem icon={<MapPin className="h-4 w-4" />} label="Location">
                        {e.fullLocation || `${e.building} ${e.room}`}
                      </InfoItem>
                      {e.professor ? (
                        <InfoItem icon={<User className="h-4 w-4" />} label="Professor">
                          {e.professor}
                        </InfoItem>
                      ) : (
                        <Fragment />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-2 rounded-xl border border-slate-600 bg-slate-700/70 p-3">
          <div className="mb-1 text-sm font-medium text-slate-100">Summary 📊</div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-300">
            <li>
              {totals.count} {totals.count === 1 ? "class" : "classes"} in this time block
            </li>
            <li>
              {totals.people} {totals.people === 1 ? "student" : "students"} involved
            </li>
            <li>
              Duration: {Math.floor(totals.durMin / 60)} hours {totals.durMin % 60} minutes
            </li>
          </ul>
        </div>

        <Separator className="my-2 bg-slate-600" />

        <div className="flex justify-end">
          <Button
            className="text-white hover:brightness-110"
            style={{ background: BRAND }}
            onClick={() => onOpenChange?.(false)}
          >
            Close Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-700/70 p-2 text-sm">
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </div>
      <div className="text-slate-100">{children}</div>
    </div>
  )
}

function formatWindow(hour: number) {
  const totalMin = Math.round(hour * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const period = h >= 12 ? "PM" : "AM"
  const displayHour = h % 12 === 0 ? 12 : h % 12
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`
}
