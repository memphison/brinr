// scripts/pipeline/insertTins.mjs

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const CHUNK_SIZE = 50
const INSERT_DELAY_MS = 250

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey)
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return { url, serviceKey }
}

export async function insertTins(rows, { dryRun = false } = {}) {
  if (!rows?.length) {
    console.log('ℹ️ No rows to insert')
    return 0
  }

  if (dryRun) {
    console.log(`🧪 DRY RUN: ${rows.length} tins`)
    return rows.length
  }

  const { url, serviceKey } = await getSupabaseAdminClient()
  let affected = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  const chunk = rows.slice(i, i + CHUNK_SIZE).map(row => {
    const clean = { ...row }
    delete clean.source_image_url
    return clean
  })

    const res = await fetch(
      `${url}/rest/v1/tins?on_conflict=brand,product_name`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          // 🔐 THIS IS THE KEY LINE
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(chunk),
      }
    )

    const text = await res.text()
    if (!res.ok) {
      throw new Error(
        `Supabase upsert failed ${res.status}\n${text}`
      )
    }

    const data = JSON.parse(text)
    affected += data.length

    console.log(`✅ Upserted ${affected}/${rows.length}`)
    await sleep(INSERT_DELAY_MS)
  }

  return affected
}
