// ⚠️ MIGRATION SCRIPT — DO NOT AUTO-RUN


import fs from 'fs'
import path from 'path'
import 'dotenv/config'

const BRAND = 'lacuriosa' // lowercase
const LOCAL_DIR = path.join('brinr-images', BRAND)
const BUCKET = 'tin-images'

// Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase env vars')
}

async function uploadImage(file) {
  const localPath = path.join(LOCAL_DIR, file)
  const storagePath = `${BRAND}/${file}`

  const buffer = fs.readFileSync(localPath)

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: buffer,
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed: ${text}`)
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`
  return publicUrl
}

async function main() {
  if (!fs.existsSync(LOCAL_DIR)) {
    console.error(`Missing local dir: ${LOCAL_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(LOCAL_DIR).filter(f => f.endsWith('.png'))

  console.log(`Uploading ${files.length} images for ${BRAND}`)

  for (const file of files) {
    try {
      const url = await uploadImage(file)
      console.log(`✅ ${file}`)
      console.log(`   ${url}`)
    } catch (e) {
      console.error(`❌ ${file}`, e.message)
    }
  }

  console.log('Done.')
}

main()
