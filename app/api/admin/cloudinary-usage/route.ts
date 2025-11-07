import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Removed: Cloudinary usage endpoint is no longer used by the UI.
export async function GET() {
  return NextResponse.json({ ok: false, error: "Cloudinary usage endpoint removed" }, { status: 410 })
}
