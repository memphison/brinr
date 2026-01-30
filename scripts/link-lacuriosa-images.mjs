import 'dotenv/config'

const BRAND = 'La Curiosa'
const BUCKET = 'tin-images'
const COMPANY_FOLDER = 'lacuriosa'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase env vars')
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function fetchTins() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tins?brand=eq.${encodeURIComponent(BRAND)}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  )

  if (!res.ok) throw new Error(`Fetch tins failed ${res.status}`)
  return res.json()
}

async function fetchStorageFiles() {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
    {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: `${COMPANY_FOLDER}/`,
        limit: 1000,
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to list storage files: ${text}`)
  }

  return res.json()
}

async function updateTin(id, imageUrl) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tins?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url: imageUrl }),
    }
  )

  if (!res.ok) throw new Error('Update failed')
}

async function main() {
  const tins = await fetchTins()
  const files = await fetchStorageFiles()

  const fileMap = files.map(f => {
  const filename = f.name.split('/').pop()
  return {
    name: filename,
    norm: normalize(filename.replace('.png', '')),
  }
})


  let updated = 0

 for (const tin of tins) {
  if (tin.image_url) continue

  const needle = normalize(`${tin.brand} ${tin.product_name}`)
  console.log('🔍 looking for:', needle)

  const match = fileMap.find(f => f.norm === needle)

  if (!match) {
    console.log(`⏭ no image for: ${tin.product_name}`)
    console.log(
      '   sample files:',
      fileMap.slice(0, 5).map(f => f.norm)
    )
    continue
  }

  const imageUrl =
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${COMPANY_FOLDER}/${match.name}`

  await updateTin(tin.id, imageUrl)
  console.log(`✅ linked → ${tin.product_name}`)
  updated++
}


  console.log(`\nDone. Updated ${updated} tins.`)
}

main().catch(console.error)
