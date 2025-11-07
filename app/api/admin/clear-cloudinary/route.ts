import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Clear Cloudinary resources by prefix (default clears whole account). THIS IS DESTRUCTIVE.
 * Requires POST body: { confirm: true, confirmToken: "DELETE_ALL", prefix?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    if (!body?.confirm || body?.confirmToken !== "DELETE_ALL") {
      return NextResponse.json({ error: "Confirmation required. Set { confirm: true, confirmToken: 'DELETE_ALL' } in body." }, { status: 400 })
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
    const API_KEY = process.env.CLOUDINARY_API_KEY
    const API_SECRET = process.env.CLOUDINARY_API_SECRET

    if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
      return NextResponse.json({ error: "Cloudinary not configured on server" }, { status: 500 })
    }

    const prefix = typeof body.prefix === "string" ? body.prefix : ""

    const resourceTypes = ["image", "video", "raw"]
    const results: any = {}

    const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64")

    for (const rt of resourceTypes) {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/${rt}/delete_by_prefix`
      const payload: any = { prefix, invalidate: true }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const text = await res.text().catch(() => "<no body>")
      let json: any = null
      try {
        json = JSON.parse(text)
      } catch (e) {
        // ignore
      }

      // capture response headers for diagnostics
      const hdrs: Record<string, string> = {}
      try {
        res.headers.forEach((v, k) => (hdrs[k] = v))
      } catch (e) {
        // ignore header extraction errors
      }

      results[rt] = { url, status: res.status, headers: hdrs, body: json ?? text }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error("clear-cloudinary error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
