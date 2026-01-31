// scripts/pipeline/uploadImages.mjs

import crypto from 'crypto'
import dotenv from 'dotenv'
import sharp from 'sharp'
dotenv.config({ path: '.env.local' })

function isSupabaseImage(url) {
  return (
    typeof url === 'string' &&
    url.includes('/storage/v1/object/public/')
  )
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Folder key for storage
 * "Jose Gourmet" -> "josegourmet"
 * "La Curiosa"   -> "lacuriosa"
 */
function brandFolderKey(brand) {
  return String(brand || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

async function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return { url, serviceKey }
}

function normalizeImageUrl(u) {
  if (!u) return null
  const s = String(u).trim()
  if (s.startsWith('//')) return `https:${s}`
  return s
}

async function uploadToSupabase(
  { url, serviceKey },
  imageUrl,
  brand,
  title
) {
  const normalizedUrl = normalizeImageUrl(imageUrl)
  if (!normalizedUrl) return null

  const res = await fetch(normalizedUrl)
  if (!res.ok) {
    throw new Error(`Image fetch failed ${res.status} for ${normalizedUrl}`)
  }

  const originalBuffer = Buffer.from(await res.arrayBuffer())

  const buffer = await sharp(originalBuffer)
    .resize(400, 400, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85 })
    .toBuffer()

  const hash = crypto.createHash('md5').update(buffer).digest('hex')

  const folder = brandFolderKey(brand)
  const fileName = `${folder}/${slugify(title)}-${hash}.jpg`

  const uploadRes = await fetch(
    `${url}/storage/v1/object/tin-images/${fileName}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buffer,
    }
  )

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`Supabase upload failed\n${text}`)
  }

  return `${url}/storage/v1/object/public/tin-images/${fileName}`
}

export async function attachImages(rows) {
  const client = await getSupabaseAdminClient()

  for (const row of rows) {
    // nothing to upload
    if (!row.source_image_url) continue

    // NEVER overwrite an existing Supabase image
    if (row.image_url && isSupabaseImage(row.image_url)) {
      continue
    }

    const publicUrl = await uploadToSupabase(
      client,
      row.source_image_url,
      row.brand,
      row.product_name
    )

    if (!publicUrl) continue

    row.image_url = publicUrl
    delete row.source_image_url
  }

  return rows
}
