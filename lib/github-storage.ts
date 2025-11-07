/**
 * Cloudinary-backed storage helper.
 *
 * Exports the same function names as the previous GitHub helper so callers don't
 * need to change imports. Internally this uses Cloudinary's upload API.
 *
 * Required env vars:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 * Optional:
 * - CLOUDINARY_UPLOAD_PRESET (if you prefer unsigned uploads)
 */

import crypto from "crypto"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
const API_KEY = process.env.CLOUDINARY_API_KEY
const API_SECRET = process.env.CLOUDINARY_API_SECRET
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET

function ensureConfigured() {
  if (!CLOUD_NAME) throw new Error("CLOUDINARY_CLOUD_NAME not set")
  if (!API_KEY || !API_SECRET) {
    if (!UPLOAD_PRESET) {
      throw new Error("Cloudinary not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or CLOUDINARY_UPLOAD_PRESET for unsigned uploads.")
    }
  }
}

async function postForm(url: string, form: FormData) {
  const res = await fetch(url, { method: "POST", body: form })
  const text = await res.text()
  try {
    return { ok: res.ok, status: res.status, json: JSON.parse(text), text }
  } catch (e) {
    return { ok: res.ok, status: res.status, json: null, text }
  }
}

export async function uploadVideo(path: string, buffer: Buffer, message?: string) {
  ensureConfigured()

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`

  // Cloudinary accepts data URIs as the 'file' field
  const dataUri = `data:application/octet-stream;base64,${buffer.toString("base64")}`

  const form = new FormData()
  form.append("file", dataUri)

  // Use the provided path as the public_id (keeps folder-like structure)
  if (path) {
    form.append("public_id", path)
  }

  // If an upload preset is provided, use unsigned upload (no signature needed)
  if (UPLOAD_PRESET) {
    form.append("upload_preset", UPLOAD_PRESET)
  } else {
    // Signed upload: include api_key, timestamp and signature
    const timestamp = Math.floor(Date.now() / 1000)
    form.append("api_key", API_KEY as string)
    form.append("timestamp", String(timestamp))

    // Build string to sign (public_id and timestamp). Cloudinary requires parameters to be
    // sorted by key when building the signature string.
    const paramsToSign: Array<[string, string]> = []
    if (path) paramsToSign.push(["public_id", path])
    paramsToSign.push(["timestamp", String(timestamp)])

    const toSign = paramsToSign
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join("&")

    const signature = crypto.createHash("sha1").update(toSign + API_SECRET).digest("hex")
    form.append("signature", signature)
  }

  const result = await postForm(url, form)

  if (!result.ok) {
    const errText = result.text || JSON.stringify(result.json)
    const err = new Error(`Cloudinary upload failed: ${result.status} ${errText}`)
    ;(err as any).status = result.status
    ;(err as any).body = result.text
    throw err
  }

  const resp = result.json
  // Return a stable secure URL and the public_id so callers can store it as media_path
  return { apiResponse: resp, rawUrl: resp.secure_url, public_id: resp.public_id }
}

export async function deleteVideo(publicId: string, message?: string, resourceType: "image" | "video" = "image") {
  ensureConfigured()

  if (!publicId) {
    throw new Error("deleteVideo requires a publicId (media_path stored from upload)")
  }

  // Choose endpoint by resource type
  const endpointType = resourceType === "video" ? "video" : "image"
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${endpointType}/destroy`

  const timestamp = Math.floor(Date.now() / 1000)
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`
  const signature = crypto.createHash("sha1").update(paramsToSign + API_SECRET).digest("hex")

  const form = new FormData()
  form.append("public_id", publicId)
  form.append("api_key", API_KEY as string)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)
  // Ask Cloudinary to invalidate CDN cached versions so deleted resources stop serving
  form.append("invalidate", "true")

  const result = await postForm(url, form)

  if (!result.ok) {
    const errText = result.text || JSON.stringify(result.json)
    const err = new Error(`Cloudinary delete failed (${endpointType}): ${result.status} ${errText}`)
    ;(err as any).status = result.status
    ;(err as any).body = result.text
    throw err
  }

  return result.json
}

export default { uploadVideo, deleteVideo }

export async function checkRepoAccess() {
  // Return some basic diagnostic information about Cloudinary configuration and connectivity
  try {
    ensureConfigured()
  } catch (err) {
    return { ok: false, error: String(err) }
  }

  // Try a light-weight list call for images (max_results=1)
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/list?max_results=1`
  const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64")

  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  const text = await res.text().catch(() => "<no body>")
  if (!res.ok) {
    return { ok: false, status: res.status, body: text }
  }

  try {
    const json = JSON.parse(text)
    return { ok: true, status: res.status, info: { count: json.total_count ?? json.resources?.length ?? 0 } }
  } catch (e) {
    return { ok: true, status: res.status, body: text }
  }
}
