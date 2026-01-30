import fs from 'fs'
import path from 'path'

import 'dotenv/config'
// scripts/scrape-fishwife.mjs

import * as cheerio from 'cheerio'

console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

const COLLECTION_URL = 'https://eatfishwife.com/collections/tinned-fish'

const PER_PAGE_DELAY_MS = 250
const BRAND = 'Fishwife'
const DEFAULT_COUNTRY = 'USA'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function absUrl(href) {
  if (!href) return null
  if (href.startsWith('http')) return href.split('?')[0]
  if (href.startsWith('/'))
    return `https://eatfishwife.com${href.split('?')[0]}`
  return null
}

function inferPacking(title) {
  const t = title.toLowerCase()
  if (t.includes('olive oil')) return 'Olive oil'
  if (t.includes('tomato')) return 'Tomato sauce'
  if (t.includes('brine')) return 'Brine'
  if (t.includes('smoked')) return 'Smoked'
  if (t.includes('chili') || t.includes('chilli')) return 'Chili'
  if (t.includes('lemon')) return 'Lemon'
  return 'Other'
}

function inferFishType(title) {
  const t = title.toLowerCase()
  const map = [
    ['sardine', 'Sardines'],
    ['anchov', 'Anchovies'],
    ['mackerel', 'Mackerel'],
    ['salmon', 'Salmon'],
    ['trout', 'Trout'],
    ['tuna', 'Tuna'],
    ['eel', 'Eel'],
    ['octopus', 'Octopus'],
    ['mussel', 'Mussels'],
  ]

  for (const [needle, label] of map) {
    if (t.includes(needle)) return label
  }

  return null
}

/**
 * Exclude ONLY true non-tin products
 */
function isNonTin(product) {
  const t = (product?.title || '').toLowerCase()

  return [
    'hat',
    'cookbook',
    'book',
    'tongs',
    'merch',
    'gift',
    'starter',
    'build your own',
    'caviar',
  ].some((w) => t.includes(w))
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'tin-fish-scraper/1.0',
      accept: 'text/html',
    },
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`)
  return res.text()
}

/**
 * Step 1: extract product links
 */
async function extractProductLinks() {
  const html = await fetchHtml(COLLECTION_URL)
  const $ = cheerio.load(html)

  const links = new Set()

  $('a[href^="/products/"]').each((_, el) => {
    const href = $(el).attr('href')
    const full = absUrl(href)
    if (full) links.add(full)
  })

  return Array.from(links)
}

function imageSlug(brand, title) {
  return `${brand}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function downloadImage(url, outPath) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Image fetch failed ${res.status}`)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(outPath, buffer)
}

/**
 * Step 2: fetch Shopify product JSON
 */
async function fetchProductJSON(productUrl) {
  const res = await fetch(`${productUrl}.json`, {
    headers: {
      'user-agent': 'tin-fish-scraper/1.0',
      accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`JSON fetch failed ${res.status}`)
  }

  const data = await res.json()
  return data.product
}

// ---------- SUPABASE ----------
async function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return { url, serviceKey }
}

async function supabaseInsertTins(rows) {
  const { url, serviceKey } = await getSupabaseAdminClient()

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
    throw new Error(`Supabase insert failed ${res.status}\n${text}`)
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
      product = await fetchProductJSON(url)
    } catch {
      console.log('  Failed JSON fetch, skipping')
      continue
    }

    if (isNonTin(product)) {
      console.log('  Skipping non-tin:', product.title)
      continue
    }

    const title = product.title?.trim()
    if (!title) {
      console.log('  ⚠ Missing title, skipping')
      continue
    }

    // ✅ IMPORTANT FIX:
    // Do NOT skip the product if fish type inference fails.
    // Keep the row, set fish_type to 'Other', and log it.
    const fishType = inferFishType(title) || 'Other'
    if (fishType === 'Other') {
      console.log('  ⚠ fish type inferred as Other:', title)
    }

    const imageUrl = product.images?.[0]?.src || null

    if (!imageUrl) {
      console.log('  ⚠ No image found:', title)
    } else {
      const slug = imageSlug(BRAND, title)
      const outDir = path.join('raw-images', 'fishwife')
      const outPath = path.join(outDir, `${slug}.jpg`)

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }

      if (!fs.existsSync(outPath)) {
        try {
          await downloadImage(imageUrl, outPath)
          console.log('  🖼 downloaded image')
        } catch {
          console.log('  ❌ image download failed')
        }
      } else {
        console.log('  ↩ image already exists')
      }
    }

    rows.push({
      brand: BRAND,
      product_name: title,
      fish_type: fishType, // <-- now always populated
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
