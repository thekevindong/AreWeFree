"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Upload, Users, Palette, Trash2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { UploadDropzone } from "@/components/upload-dropzone"
import { saveUploads, useUploadsState, type StoredUpload } from "@/lib/storage"
import { validateICSContent } from "@/lib/ics-parser"

const BRAND = "#0F52BA"
const defaultPalette = [BRAND, "#10B981", "#F59E0B", "#EC4899", "#06B6D4", "#8B5CF6", "#22C55E", "#F97316"]

export default function Page() {
  const router = useRouter()
  const { toast } = useToast()
  const [uploads, setUploads] = useUploadsState()
  const [validating, setValidating] = useState(false)

  const peopleCount = useMemo(() => new Set(uploads.map((u) => u.person.trim() || u.name)).size, [uploads])

  const handleAddFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      const start = uploads.length
      const next: StoredUpload[] = await Promise.all(
        files.map(async (file, i) => {
          const content = await file.text()
          const nameWithoutExt = file.name.replace(/\.ics$/i, "")
          return {
            id: crypto.randomUUID(),
            name: file.name,
            person: nameWithoutExt || `Person ${start + i + 1}`,
            color: defaultPalette[(start + i) % defaultPalette.length],
            content,
            size: file.size,
          }
        }),
      )
      const merged = [...uploads, ...next]
      setUploads(merged)
      saveUploads(merged)
    },
    [uploads, setUploads],
  )

  const updateUpload = useCallback(
    (id: string, patch: Partial<StoredUpload>) => {
      setUploads((prev) => {
        const updated = prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
        saveUploads(updated)
        return updated
      })
    },
    [setUploads],
  )

  const removeUpload = useCallback(
    (id: string) => {
      setUploads((prev) => {
        const updated = prev.filter((u) => u.id !== id)
        saveUploads(updated)
        return updated
      })
    },
    [setUploads],
  )

  // Validates each upload, persists valid flag, and shows badges
  const validateAll = useCallback(async () => {
    if (uploads.length === 0) {
      toast({ title: "No files to validate", description: "Add one or more .ics files first." })
      return
    }
    setValidating(true)
    let okCount = 0
    const results: { id: string; ok: boolean }[] = []
    for (const u of uploads) {
      const ok = await validateICSContent(u.content)
      if (ok) okCount++
      results.push({ id: u.id, ok })
    }
    setUploads((prev) => {
      const updated = prev.map((u) => {
        const r = results.find((x) => x.id === u.id)
        return r ? { ...u, valid: r.ok } : u
      })
      saveUploads(updated)
      return updated
    })
    setValidating(false)
    toast({ title: "Validation complete", description: `${okCount} of ${uploads.length} look valid.` })
  }, [uploads, toast, setUploads])

  const goParse = useCallback(() => {
    if (uploads.length === 0) {
      toast({ title: "Nothing to parse", description: "Add one or more .ics files first." })
      return
    }
    router.push("/schedules")
  }, [uploads, router, toast])

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#0f2027] via-[#203a43] to-[#2c5364] text-slate-100">
      <div className="mx-auto max-w-[980px] px-4 py-8 md:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2" style={{ background: `${BRAND}1A`, border: `1px solid ${BRAND}33` }}>
              <Calendar className="h-5 w-5" style={{ color: BRAND }} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">AreWeFree</h1>
              <p className="text-sm text-slate-600">Upload .ics files and label each person.</p>
            </div>
          </div>
          <div
            className="hidden items-center gap-3 rounded-lg px-3 py-2 backdrop-blur md:flex"
            style={{ background: "#1e293bcc", border: "1px solid #475569" }}
          >
            <Users className="h-4 w-4 text-slate-700" />
            <span className="text-sm text-slate-700">{peopleCount}</span>
            <Separator orientation="vertical" className="mx-2 h-4 bg-slate-200" />
            <Upload className="h-4 w-4 text-slate-700" />
            <span className="text-sm text-slate-700">{uploads.length}</span>
          </div>
        </header>

        <div className="space-y-6">
          <Card className="border-slate-600 bg-slate-800/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Drop .ics files</CardTitle>
              <CardDescription className="text-slate-300">Drag & drop or click to browse.</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadDropzone accept=".ics" onFilesSelected={handleAddFiles} />
              <p className="mt-2 text-xs text-slate-600">
                Supports .ics from Google Calendar, Outlook, Apple Calendar, and university systems.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="border-slate-200 bg-white/80 text-slate-800 hover:bg-white"
                  onClick={validateAll}
                  disabled={validating}
                >
                  {validating ? "Validating..." : "Validate"}
                </Button>
                <Button className="text-white hover:brightness-110" style={{ background: BRAND }} onClick={goParse}>
                  Parse Schedules
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-600 bg-slate-800/90 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">People & colors</CardTitle>
              <CardDescription className="text-slate-300">Rename each person and pick their color.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScrollArea className="max-h-[420px] pr-2">
                <div className="space-y-2">
                  {uploads.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-white/70 p-4 text-sm text-slate-600">
                      No files yet.
                    </div>
                  ) : (
                    uploads.map((u) => (
                      <Row
                        key={u.id}
                        name={u.name}
                        person={u.person}
                        color={u.color}
                        size={u.size}
                        valid={u.valid}
                        onPersonChange={(v) => updateUpload(u.id, { person: v })}
                        onColorChange={(v) => updateUpload(u.id, { color: v })}
                        onRemove={() => removeUpload(u.id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function Row({
  name,
  size,
  person,
  color,
  valid,
  onPersonChange,
  onColorChange,
  onRemove,
}: {
  name: string
  size: number
  person: string
  color: string
  valid?: boolean
  onPersonChange: (v: string) => void
  onColorChange: (v: string) => void
  onRemove: () => void
}) {
  const inputId = `p-${name}`
  const colorId = `c-${name}`
  const BRAND = "#0F52BA"

  const ring = valid === true ? "ring-1 ring-emerald-400/60" : valid === false ? "ring-1 ring-rose-400/70" : "ring-0"

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-700/70 px-3 py-2 ${ring}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-100">{name}</div>
        <div className="text-xs text-slate-400">{(size / 1024).toFixed(1)} KB</div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <Label htmlFor={inputId} className="sr-only">
          Person
        </Label>
        <Input
          id={inputId}
          className="h-8 w-40 border-slate-600 bg-slate-700 text-slate-100 focus:ring-0 focus:outline-none" // Added focus:ring-0 focus:outline-none
          value={person}
          onChange={(e) => onPersonChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-2 py-1">
          <Palette className="h-4 w-4" style={{ color: BRAND }} />
          <Label htmlFor={colorId} className="sr-only">
            Color
          </Label>
          <input
            id={colorId}
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded-md border-0 bg-transparent p-0"
          />
        </div>
        {valid === true ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valid
          </span>
        ) : valid === false ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
            <XCircle className="h-3.5 w-3.5" />
            Invalid
          </span>
        ) : (
          <span className="text-xs text-slate-500">Not validated</span>
        )}
        <Button
          variant="outline"
          size="icon"
          className="border-slate-200 bg-transparent text-slate-700"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove</span>
        </Button>
      </div>
    </div>
  )
}
