// scripts/brands/josegourmet.mjs

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as cheerio from 'cheerio'
import { classifySeafood } from '../taxonomy/seafoodClassifier.mjs'

export const brand = 'josegourmet'

const COLLECTION_URL = 'https://josegourmet.com/products/canned-goods'

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
  if (href.startsWith('//')) return `https:${href.split('?')[0]}`
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

  if (cleaned.toLowerCase().includes(BRAND_SLOGAN.toLowerCase())) {
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

function pickFromSrcset(srcset) {
  if (!srcset) return null
  const first = String(srcset).split(',')[0]?.trim()
  if (!first) return null
  const urlPart = first.split(' ')[0]?.trim()
  return absUrl(urlPart) || urlPart
}

function parseLdJsonImage($) {
  const scripts = $('script[type="application/ld+json"]')
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).text()
    if (!raw) continue
    try {
      const data = JSON.parse(raw)

      const image =
        data?.image ||
        data?.[0]?.image ||
        data?.mainEntity?.image ||
        data?.mainEntity?.[0]?.image

      if (typeof image === 'string') return absUrl(image) || image
      if (Array.isArray(image) && image[0]) return absUrl(image[0]) || image[0]
      if (image?.url) return absUrl(image.url) || image.url
    } catch {
      // ignore malformed JSON blocks
    }
  }
  return null
}

async function fetchProductFromHtml(productUrl) {
  const html = await fetchHtml(productUrl)
  const $ = cheerio.load(html)

  const metaImg =
    $('meta[property="og:image:secure_url"]').attr('content') ||
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    null

  const ldImg = parseLdJsonImage($)

  const firstImg =
    $('img[src]').first().attr('src') ||
    null

  const firstSrcset =
    pickFromSrcset($('img[srcset]').first().attr('srcset')) ||
    null

  const source_image_url =
    absUrl(metaImg) ||
    absUrl(ldImg) ||
    absUrl(firstSrcset) ||
    absUrl(firstImg) ||
    null

  const rawMeta =
    $('meta[name="twitter:title"]').attr('content') ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text()

  const metaTitle = cleanTitle(rawMeta)
  const title = metaTitle || titleFromSlug(productUrl)

  if (!title) throw new Error('No valid product title found')

  return { title, source_image_url }
}

export async function scrape() {
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
    const seafood = classifySeafood(title)

    rows.push({
      brand: BRAND,
      product_name: title,
      fish_type: seafood.fish_type ?? 'Other',
      country: DEFAULT_COUNTRY,
      packing: inferPacking(title),
      source_url: url,
      source_image_url: product.source_image_url,
      notes: null,
    })

    await sleep(PER_PAGE_DELAY_MS)
  }

  console.log(`Prepared ${rows.length} tins.`)
  return rows
}
