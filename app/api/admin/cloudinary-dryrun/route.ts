import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Dry-run listing of Cloudinary resources by prefix. Returns matched public_ids for image/video/raw.
 * POST body: { prefix?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const prefix = typeof body.prefix === "string" ? body.prefix : ""

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
    const API_KEY = process.env.CLOUDINARY_API_KEY
    const API_SECRET = process.env.CLOUDINARY_API_SECRET

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return NextResponse.json({ error: "Cloudinary not configured on server" }, { status: 500 })
    }

    const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64")
    const resourceTypes = ["image", "video", "raw"]
    const results: Record<string, any> = {}

    for (const rt of resourceTypes) {
      // Cloudinary admin list endpoint supports prefix and max_results
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${rt}/list?prefix=${encodeURIComponent(prefix)}&max_results=500`
      const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
      const text = await res.text().catch(() => "<no body>")
      let json: any = null
      try { json = JSON.parse(text) } catch (e) { json = null }

      // capture response headers for diagnostics
      const hdrs: Record<string, string> = {}
      try { res.headers.forEach((v, k) => (hdrs[k] = v)) } catch (e) { /* ignore */ }

      if (!res.ok) {
        results[rt] = { url, ok: false, status: res.status, headers: hdrs, body: json ?? text }
        continue
      }

      // map to public_id list
      const publicIds = Array.isArray(json?.resources) ? json.resources.map((r: any) => r.public_id) : []
      results[rt] = { url, ok: true, status: res.status, headers: hdrs, count: publicIds.length, public_ids: publicIds }
    }

    return NextResponse.json({ ok: true, prefix, results })
  } catch (err) {
    console.error("cloudinary-dryrun error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
