import 'dotenv/config'

const BRAND = 'Fishwife'
const BUCKET = 'tin-images'
const COMPANY_FOLDER = 'fishwife'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase env vars')
}

function imageSlug(brand, title) {
  return `${brand}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function publicImageUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${COMPANY_FOLDER}/${filename}`
}

async function fetchTins() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tins?brand=eq.${BRAND}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  )

  if (!res.ok) {
    throw new Error(`Fetch tins failed ${res.status}`)
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
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ image_url: imageUrl }),
    }
  )

  if (!res.ok) {
    throw new Error(`Update failed ${res.status}`)
  }
}

async function main() {
  const tins = await fetchTins()

  if (!tins.length) {
    console.log('⚠️ No tins found for brand:', BRAND)
    return
  }

  let updated = 0

  for (const tin of tins) {
    if (tin.image_url) {
      // Do not overwrite existing links
      continue
    }

    const slug = imageSlug(tin.brand, tin.product_name)
    const filename = `${slug}.png`
    const imageUrl = publicImageUrl(filename)

    try {
      await updateTin(tin.id, imageUrl)
      console.log(`✅ linked image → ${tin.product_name}`)
      updated++
    } catch (e) {
      console.log(`❌ failed to link → ${tin.product_name}`)
    }
  }

  console.log(`\nDone. Updated ${updated} tins.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
