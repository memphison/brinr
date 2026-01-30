import 'dotenv/config'
// scripts/scrape-josegourmet.mjs

import * as cheerio from 'cheerio'

console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

const COLLECTION_URL =
  'https://josegourmet.com/products/canned-goods'

const PER_PAGE_DELAY_MS = 300
const BRAND = 'Jose Gourmet'
const DEFAULT_COUNTRY = 'Portugal'
const BRAND_SLOGAN = 'Seafood of distinction'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function absUrl(href) {
  if (!href) return null
  if (href.startsWith('http')) return href.split('?')[0]
  if (href.startsWith('/'))
    return `https://josegourmet.com${href.split('?')[0]}`
  return null
}

function titleFromSlug(url) {
  const slug = url.split('/').pop()
  if (!slug) return null

  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function cleanTitle(raw) {
  if (!raw) return null

  const cleaned = raw
    .replace(/\s*\|\s*José Gourmet.*/i, '')
    .replace(/\s*\|\s*Jose Gourmet.*/i, '')
    .trim()

  if (
    cleaned.toLowerCase().includes(BRAND_SLOGAN.toLowerCase())
  ) {
    return null
  }

  return cleaned
}

function inferPacking(title) {
  const t = title.toLowerCase()
  if (t.includes('olive oil')) return 'Olive oil'
  if (t.includes('tomato')) return 'Tomato sauce'
  if (t.includes('brine')) return 'Brine'
  if (t.includes('ink')) return 'Ink'
  if (t.includes('curry')) return 'Curry sauce'
  if (t.includes('ragout')) return 'Ragout'
  if (t.includes('butter')) return 'Butter'
  return 'Other'
}

function inferFishType(title) {
  const t = title.toLowerCase()
  const map = [
    ['sardine', 'Sardines'],
    ['mackerel', 'Mackerel'],
    ['tuna', 'Tuna'],
    ['octopus', 'Octopus'],
    ['squid', 'Squid'],
    ['cod', 'Cod'],
    ['salmon', 'Salmon'],
    ['trout', 'Trout'],
    ['hake', 'Hake'],
    ['roe', 'Roe'],
    ['cockle', 'Cockles'],
    ['mussel', 'Mussels'],
  ]

  for (const [needle, label] of map) {
    if (t.includes(needle)) return label
  }

  return null
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'tin-fish-scraper/1.0',
      accept: 'text/html',
      'accept-language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`)
  return res.text()
}

/**
 * Step 1: extract ONLY canned-goods product links
 */
async function extractProductLinks() {
  const html = await fetchHtml(COLLECTION_URL)
  const $ = cheerio.load(html)

  const links = new Set()

  $('a[href^="/products/canned-goods/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    if (href.split('/').length < 4) return

    const full = absUrl(href)
    if (full) links.add(full)
  })

  return Array.from(links)
}

/**
 * Step 2: extract product title (slug fallback)
 */
async function fetchProductFromHtml(productUrl) {
  const html = await fetchHtml(productUrl)
  const $ = cheerio.load(html)

  const rawMeta =
    $('meta[name="twitter:title"]').attr('content') ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text()

  const metaTitle = cleanTitle(rawMeta)

  const title = metaTitle || titleFromSlug(productUrl)

  if (!title) {
    throw new Error('No valid product title found')
  }

  return { title }
}

// ---------- SUPABASE ----------
async function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey)
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return { url, serviceKey }
}

async function supabaseInsertTins(rows) {
  const { url, serviceKey } =
    await getSupabaseAdminClient()

  const res = await fetch(`${url}/rest/v1/tins`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(
      `Supabase insert failed ${res.status}\n${text}`
    )
  }

  return JSON.parse(text)
}
// --------------------------------

async function main() {
  console.log('Scraping collection:', COLLECTION_URL)

  const links = await extractProductLinks()
  console.log(`Found ${links.length} product links.`)

  const rows = []

  for (let i = 0; i < links.length; i++) {
    const url = links[i]
    console.log(`(${i + 1}/${links.length}) ${url}`)

    let product
    try {
      product = await fetchProductFromHtml(url)
    } catch (e) {
      console.log(`  Failed HTML parse (${e.message}), skipping`)
      continue
    }

    const title = product.title
    const fishType = inferFishType(title)

    if (!fishType) {
      console.log('  Skipping non-fish:', title)
      continue
    }

    rows.push({
      brand: BRAND,
      product_name: title,
      fish_type: fishType,
      country: DEFAULT_COUNTRY,
      packing: inferPacking(title),
      notes: null,
    })

    await sleep(PER_PAGE_DELAY_MS)
  }

  console.log(`Prepared ${rows.length} tins to insert.`)
  if (!rows.length) return

  const chunkSize = 50
  let inserted = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const result = await supabaseInsertTins(chunk)
    inserted += result.length
    console.log(`Inserted ${inserted}`)
    await sleep(250)
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
