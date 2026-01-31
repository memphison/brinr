// scripts/brands/fishwife.mjs

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as cheerio from 'cheerio'
import { classifySeafood } from '../taxonomy/seafoodClassifier.mjs'

export const brand = 'fishwife'

const COLLECTION_URL =
  'https://eatfishwife.com/collections/tinned-fish'

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

/**
 * Exclude ONLY true non-tin products
 */
function isNonTin(title) {
  const t = title.toLowerCase()

  return [
    'hat',
    'cookbook',
    'book',
    'tongs',
    'merch',
    'gift',
    'starter',
    'build your own',
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

/**
 * Fetch Shopify product JSON
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

export async function scrape() {
  console.log('Scraping Fishwife collection')

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

    const title = product?.title?.trim()
    if (!title) {
      console.log('  Missing title, skipping')
      continue
    }

    if (isNonTin(title)) {
      console.log('  Skipping non-tin:', title)
      continue
    }

    const seafood = classifySeafood(title)
    const imageUrl = product.images?.[0]?.src || null

    rows.push({
      brand: BRAND,
      product_name: title,
      fish_type: seafood.fish_type ?? 'Other',
      country: DEFAULT_COUNTRY,
      packing: inferPacking(title),
      source_url: url,
      source_image_url: imageUrl,
      notes: null,
    })

    await sleep(PER_PAGE_DELAY_MS)
  }

  console.log(`Prepared ${rows.length} tins.`)
  return rows
}
