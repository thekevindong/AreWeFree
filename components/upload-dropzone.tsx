"use client"

import { useCallback, useRef, useState } from "react"
import { Upload } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  accept?: string
  onFilesSelected?: (files: File[]) => void
}

const BRAND = "#0F52BA"

export function UploadDropzone(
  { accept = ".ics", onFilesSelected }: Props = { accept: ".ics", onFilesSelected: () => {} },
) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const arr = Array.from(files).filter((f) => (accept ? f.name.toLowerCase().endsWith(".ics") : true))
      onFilesSelected?.(arr)
    },
    [accept, onFilesSelected],
  )

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-white p-8 text-center transition",
      )}
      style={{
        borderColor: `${BRAND}66`,
        background: dragOver ? "#1e293b" : "#334155",
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      aria-label="Upload .ics files"
      tabIndex={0}
    >
      <Upload className="mb-2 h-7 w-7" style={{ color: BRAND }} />
      <div className="text-sm text-slate-100">Drag & drop .ics files</div>
      <div className="text-xs text-slate-300">or click to browse</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
