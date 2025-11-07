import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/mongo-client"
import { ObjectId } from "mongodb"

export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const logs = await db.collection("logs").find({}).sort({ archived_at: -1 }).toArray()
    const editorIds = Array.from(new Set(logs.map((l: any) => l.editor_id).filter(Boolean)))
    const editors = await db.collection("editors").find({ id: { $in: editorIds } }).toArray()
    const editorMap: Record<string, any> = {}
    editors.forEach((e: any) => (editorMap[e.id] = e))

    // Ensure each log has a stable `id` string property (clients expect `id`).
    const mapped = logs.map((l: any) => {
      const id = l.id ?? (l._id ? String(l._id) : undefined)
      return {
        ...l,
        id,
        editors: editorMap[l.editor_id] ? { name: editorMap[l.editor_id].name, type: editorMap[l.editor_id].type } : null,
      }
    })

    return NextResponse.json(mapped)
  } catch (error) {
    console.error("Error fetching logs:", error)
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { logIds } = await request.json()

    // sanitize input: only accept non-empty string IDs
    const cleanIds = Array.isArray(logIds) ? logIds.filter((id: any) => !!id && typeof id === 'string') : []
    if (!cleanIds || cleanIds.length === 0) return NextResponse.json({ error: "Invalid or empty log IDs" }, { status: 400 })

    const db = await getDb()
    // attempt delete by ObjectId where possible, fallback to id field
    const objectIds = []
    const stringIds = []
    for (const id of cleanIds) {
      try {
        objectIds.push(new ObjectId(id))
      } catch (e) {
        stringIds.push(id)
      }
    }

    let deletedCount = 0
    if (objectIds.length) {
      const r = await db.collection("logs").deleteMany({ _id: { $in: objectIds } })
      deletedCount += r.deletedCount || 0
    }
    if (stringIds.length) {
      const r = await db.collection("logs").deleteMany({ id: { $in: stringIds } })
      deletedCount += r.deletedCount || 0
    }

    return NextResponse.json({ success: true, deletedCount })
  } catch (error) {
    console.error("Error deleting logs:", error)
    return NextResponse.json({ error: "Failed to delete logs" }, { status: 500 })
  }
}
