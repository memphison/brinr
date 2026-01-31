import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const DRY_RUN = false // ← set to false to actually delete

function isSupabaseImage(url) {
  return typeof url === 'string' &&
    url.includes('/storage/v1/object/public/')
}

async function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return { url, serviceKey }
}

async function fetchAllTins() {
  const { url, serviceKey } = await getSupabaseAdminClient()

  const res = await fetch(`${url}/rest/v1/tins?select=*`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status}`)
  }

  return res.json()
}

function pickWinner(rows) {
  return rows
    .slice()
    .sort((a, b) => {
      // 1. Supabase image wins
      const aSup = isSupabaseImage(a.image_url)
      const bSup = isSupabaseImage(b.image_url)
      if (aSup !== bSup) return bSup - aSup

      // 2. Any image wins
      const aImg = !!a.image_url
      const bImg = !!b.image_url
      if (aImg !== bImg) return bImg - aImg

      // 3. Source URL wins
      const aSrc = !!a.source_url
      const bSrc = !!b.source_url
      if (aSrc !== bSrc) return bSrc - aSrc

      // 4. Newest wins
      return new Date(b.created_at) - new Date(a.created_at)
    })[0]
}

async function deleteRows(ids) {
  if (!ids.length) return

  const { url, serviceKey } = await getSupabaseAdminClient()

  const res = await fetch(
    `${url}/rest/v1/tins?id=in.(${ids.join(',')})`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Delete failed ${res.status}\n${text}`)
  }
}

async function run() {
  const rows = await fetchAllTins()
  console.log(`Fetched ${rows.length} tins`)

  const groups = new Map()

  for (const row of rows) {
    const key =
      `${row.brand?.toLowerCase()}|${row.product_name?.toLowerCase()}`

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  let deleteCount = 0

  for (const [key, group] of groups) {
    if (group.length === 1) continue

    const winner = pickWinner(group)
    const losers = group.filter(r => r.id !== winner.id)

    deleteCount += losers.length

    console.log(
      `🧹 ${key}: keeping ${winner.id}, deleting ${losers.length}`
    )

    if (!DRY_RUN) {
      await deleteRows(losers.map(r => r.id))
    }
  }

  console.log(
    DRY_RUN
      ? `🧪 DRY RUN: ${deleteCount} rows would be deleted`
      : `✅ Deleted ${deleteCount} duplicate rows`
  )
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
