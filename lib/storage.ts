"use client"

import { useEffect, useState } from "react"

export type StoredUpload = {
  id: string
  name: string
  person: string
  color: string
  content: string
  size: number
  valid?: boolean 
}

const KEY = "whenwefree:uploads"

export function getUploads(): StoredUpload[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveUploads(list: StoredUpload[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
}

export function clearUploads() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

export function useUploadsState(): [
  StoredUpload[],
  (updater: StoredUpload[] | ((p: StoredUpload[]) => StoredUpload[])) => void,
] {
  const [state, setState] = useState<StoredUpload[]>([])
  useEffect(() => setState(getUploads()), [])
  const set = (updater: StoredUpload[] | ((p: StoredUpload[]) => StoredUpload[])) => {
    setState((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater
      saveUploads(next)
      return next
    })
  }
  return [state, set]
}
