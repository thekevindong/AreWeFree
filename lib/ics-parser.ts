import ICALImport from "ical.js"
const ICAL: any = (ICALImport as any)?.default ?? (ICALImport as any)

export interface CourseData {
  person: string
  courseCode: string
  courseName: string
  building: string
  room: string
  day: string
  startTime: string
  endTime: string
  startHour: number
  endHour: number
  type: string
  color: string
  professor?: string
  fullLocation?: string
}

export interface ProcessingProgress {
  stage: string
  progress: number
  message: string
}

export class ICSParser {
  private onProgress?: (progress: ProcessingProgress) => void

  constructor(onProgress?: (progress: ProcessingProgress) => void) {
    this.onProgress = onProgress
  }

  async parseICSFile(file: File, personName: string, color: string): Promise<CourseData[]> {
    const content = await file.text()
    return this.parseICSString(content, personName, color)
  }

  async parseICSString(content: string, personName: string, color: string): Promise<CourseData[]> {
    try {
      this.updateProgress("parsing", 30, "Parsing calendar data...")
      const jcalData = ICAL.parse(content)
      const comp = new ICAL.Component(jcalData)

      this.updateProgress("extracting", 50, "Extracting course information...")
      const events = comp.getAllSubcomponents("vevent")
      const courses: CourseData[] = []
      let skippedEvents = 0

      for (let i = 0; i < events.length; i++) {
        const event = events[i]
        const progress = 50 + (i / Math.max(events.length, 1)) * 40
        this.updateProgress("extracting", progress, `Processing event ${i + 1}/${events.length}...`)
        try {
          const courseData = this.parseEvent(event, personName, color)
          if (courseData.length > 0) courses.push(...courseData)
          else skippedEvents++
        } catch (error) {
          console.warn(`Skipping event ${i + 1} due to error:`, error)
          skippedEvents++
        }
      }

      this.updateProgress(
        "complete",
        100,
        `Processing complete! Found ${courses.length} classes, skipped ${skippedEvents} invalid events.`,
      )
      return courses
    } catch (error: any) {
      console.error("Error parsing ICS content:", error)
      throw new Error(`Failed to parse: ${error}`)
    }
  }

  private parseEvent(event: any, personName: string, color: string): CourseData[] {
    const summary = (event.getFirstPropertyValue("summary") as string) || "Unknown Course"
    const location = (event.getFirstPropertyValue("location") as string) || ""
    const description = (event.getFirstPropertyValue("description") as string) || ""

    let dtstart: any = null
    let dtend: any = null
    try {
      dtstart = event.getFirstPropertyValue("dtstart")
      dtend = event.getFirstPropertyValue("dtend")
    } catch (error) {
      console.warn(`Invalid date-time in event "${summary}":`, error)
      return []
    }

    if (!dtstart || !dtend) return []
    if (!this.isValidDateTime(dtstart) || !this.isValidDateTime(dtend)) return []
    if (!this.hasTimeComponent(dtstart) || !this.hasTimeComponent(dtend)) return []
    if (dtstart.compare(dtend) >= 0) return []

    const rrule = event.getFirstPropertyValue("rrule") as any
    const { courseCode, courseName, type } = this.parseSummary(summary)
    const { building, room, fullLocation } = this.parseLocation(location)
    const professor = this.extractProfessor(description, location, summary)

    const eventDays = this.getEventDays(dtstart, rrule)
    const courses: CourseData[] = []

    for (const day of eventDays) {
      try {
        const startTime = this.formatTime(dtstart)
        const endTime = this.formatTime(dtend)
        const startHour = this.getHourFromTime(dtstart)
        const endHour = this.getHourFromTime(dtend)
        if (startHour === endHour || startHour < 0 || endHour < 0 || startHour > 24 || endHour > 24) continue
        courses.push({
          person: personName,
          courseCode,
          courseName,
          building,
          room,
          day,
          startTime,
          endTime,
          startHour,
          endHour,
          type,
          color,
          professor,
          fullLocation,
        })
      } catch {}
    }
    return courses
  }

  private isValidDateTime(dateTime: any): boolean {
    try {
      if (!dateTime || typeof dateTime.year !== "number" || dateTime.year < 1900 || dateTime.year > 2100) return false
      const year = dateTime.year
      const month = dateTime.month
      const day = dateTime.day
      return year > 0 && month > 0 && month <= 12 && day > 0 && day <= 31
    } catch {
      return false
    }
  }

  private hasTimeComponent(dateTime: any): boolean {
    try {
      if (dateTime.isDate) return false
      const hour = dateTime.hour
      const minute = dateTime.minute
      return (
        typeof hour === "number" && typeof minute === "number" && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
      )
    } catch {
      return false
    }
  }

  private parseSummary(summary: string): { courseCode: string; courseName: string; type: string } {
    const courseCodeMatch = summary.match(/([A-Z]{2,8})\s*(\d{3,4}[A-Z]?)/i)
    let courseCode = "UNKNOWN"
    let courseName = summary
    let type = "Lecture"
    if (courseCodeMatch) {
      courseCode = `${courseCodeMatch[1].toUpperCase()} ${courseCodeMatch[2]}`
      courseName = summary.replace(courseCodeMatch[0], "").trim()
    }
    if (!courseName || courseName.length < 3) courseName = summary
    const s = summary.toLowerCase()
    if (s.includes("lab")) type = "Lab"
    else if (s.includes("recitation") || s.includes("rec")) type = "Recitation"
    else if (s.includes("seminar")) type = "Seminar"
    return { courseCode, courseName, type }
  }

  private parseLocation(location: string): { building: string; room: string; fullLocation: string } {
    const fullLocation = location || "TBD"
    if (!location || location.trim() === "" || location.toUpperCase().includes("TO BE ARRANGED")) {
      return { building: "TBD", room: "TBD", fullLocation: "TO BE ARRANGED" }
    }
    if (location.toUpperCase().includes("WEB BASED")) {
      return { building: "Online", room: "Web", fullLocation: location }
    }
    const roomBuildingMatch = location.match(/^(\d+[A-Z]?)\s+(.+)$/i)
    if (roomBuildingMatch)
      return { building: roomBuildingMatch[2].trim(), room: roomBuildingMatch[1].trim(), fullLocation }
    const buildingRoomMatch = location.match(/^(.+?)\s+(\d+[A-Z]?)$/i)
    if (buildingRoomMatch)
      return { building: buildingRoomMatch[1].trim(), room: buildingRoomMatch[2].trim(), fullLocation }
    if (location.includes("Hall") || location.includes("Building") || location.includes("Center")) {
      return { building: location.trim(), room: "TBD", fullLocation }
    }
    return { building: location.trim(), room: "TBD", fullLocation }
  }

  private extractProfessor(description: string, location: string, summary: string): string | undefined {
    const profPatterns = [
      /(?:instructor|professor|prof|teacher):\s*([^,\n]+)/i,
      /(?:taught by|with)\s+([^,\n]+)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*,\s*(?:Ph\.?D\.?|Dr\.?))?/g,
    ]
    for (const pattern of profPatterns) {
      const match = description.match(pattern)
      if (match && match[1]) {
        const prof = match[1].trim()
        if (
          prof.length > 3 &&
          !prof.toLowerCase().includes("class") &&
          !prof.toLowerCase().includes("course") &&
          !prof.toLowerCase().includes("section")
        )
          return prof
      }
    }
    return undefined
  }

  private getEventDays(dtstart: any, rrule: any): string[] {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    if (!rrule) {
      try {
        const dayIndex = dtstart.dayOfWeek() - 1
        if (dayIndex >= 0 && dayIndex < 7) return [dayNames[dayIndex]]
      } catch {}
      return []
    }

    const days: string[] = []
    try {
      if (rrule.freq === "WEEKLY" && rrule.parts?.BYDAY) {
        const byDays = Array.isArray(rrule.parts.BYDAY) ? rrule.parts.BYDAY : [rrule.parts.BYDAY]
        for (const byDay of byDays) {
          const dayAbbrev = typeof byDay === "string" ? byDay : byDay.toString()
          const dayName = convertDayAbbreviation(dayAbbrev)
          if (dayName) days.push(dayName)
        }
      }
    } catch {}

    if (days.length === 0) {
      try {
        const dayIndex = dtstart.dayOfWeek() - 1
        if (dayIndex >= 0 && dayIndex < 7) days.push(dayNames[dayIndex])
      } catch {}
    }
    return days
  }

  private formatTime(time: any): string {
    try {
      const hour = time.hour
      const minute = time.minute
      const period = hour >= 12 ? "PM" : "AM"
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`
    } catch {
      return "Invalid Time"
    }
  }

  private getHourFromTime(time: any): number {
    try {
      return time.hour + time.minute / 60
    } catch {
      return -1
    }
  }

  private updateProgress(stage: string, progress: number, message: string) {
    this.onProgress?.({ stage, progress, message })
  }
}

export function convertDayAbbreviation(abbrev: string): string | null {
  const dayMap: Record<string, string> = {
    SU: "Sunday",
    MO: "Monday",
    TU: "Tuesday",
    WE: "Wednesday",
    TH: "Thursday",
    FR: "Friday",
    SA: "Saturday",
  }
  try {
    const clean = abbrev.replace(/^\d+/, "").toUpperCase()
    return dayMap[clean] || null
  } catch {
    return null
  }
}

export function createICSParser(onProgress?: (progress: ProcessingProgress) => void): ICSParser {
  return new ICSParser(onProgress)
}

export function validateICSContent(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    resolve(!!content && content.includes("BEGIN:VCALENDAR") && content.includes("BEGIN:VEVENT"))
  })
}
