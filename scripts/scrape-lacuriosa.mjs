import 'dotenv/config'
// scripts/scrape-lacuriosa.mjs

import * as cheerio from 'cheerio'

console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

const COLLECTION_URL =
  'https://lacuriosa.es/en/canned-goods/'

const PER_PAGE_DELAY_MS = 300
const BRAND = 'La Curiosa'
const DEFAULT_COUNTRY = 'Spain'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function inferPacking(title) {
  const t = title.toLowerCase()
  if (t.includes('olive oil')) return 'Olive oil'
  if (t.includes('tomato')) return 'Tomato sauce'
  if (t.includes('spicy')) return 'Spicy'
  if (t.includes('brine')) return 'Brine'
  if (t.includes('ink')) return 'Ink'
  if (t.includes('escabeche')) return 'Escabeche'
  if (t.includes('pickled')) return 'Pickled'
  return 'Other'
}

function inferFishType(title) {
  const t = title.toLowerCase()
  const map = [
    ['sardine', 'Sardines'],
    ['anchov', 'Anchovies'],
    ['mackerel', 'Mackerel'],
    ['tuna', 'Tuna'],
    ['octopus', 'Octopus'],
    ['squid', 'Squid'],
    ['mussel', 'Mussels'],
    ['cockle', 'Cockles'],
    ['clam', 'Clams'],
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
    },
  })

  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status}`)
  }

  return res.text()
}

/**
 * Step 1: crawl paginated collection pages (404-safe)
 */
async function extractProductLinks() {
  const links = new Set()
  let page = 1

  while (true) {
    const pageUrl =
      page === 1
        ? COLLECTION_URL
        : `${COLLECTION_URL}page/${page}/`

    console.log(`Scanning page ${page}: ${pageUrl}`)

    let html
    try {
      html = await fetchHtml(pageUrl)
    } catch (e) {
      if (e.message.includes('404')) break
      throw e
    }

    const $ = cheerio.load(html)

    const productLinks =
      $('li.product a.woocommerce-LoopProduct-link')

    if (!productLinks.length) break

    productLinks.each((_, el) => {
      const href = $(el).attr('href')
      if (href) links.add(href)
    })

    page++
    await sleep(200)
  }

  return Array.from(links)
}

/**
 * Step 2: scrape product page
 */
async function scrapeProduct(url) {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const title = $('h1').first().text().trim()
  if (!title) throw new Error('No product title found')

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
  console.log('Scraping La Curiosa canned goods')

  const links = await extractProductLinks()
  console.log(`Found ${links.length} product links.`)

  const rows = []

  for (let i = 0; i < links.length; i++) {
    const url = links[i]
    console.log(`(${i + 1}/${links.length}) ${url}`)

    let product
    try {
      product = await scrapeProduct(url)
    } catch (e) {
      console.log(`  Failed parse (${e.message}), skipping`)
      continue
    }

    const fishType =
      inferFishType(product.title) ?? 'Unknown'

    rows.push({
      brand: BRAND,
      product_name: product.title,
      fish_type: fishType,
      country: DEFAULT_COUNTRY,
      packing: inferPacking(product.title),
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
