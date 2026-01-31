// scripts/brands/lacuriosa.mjs

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as cheerio from 'cheerio'
import { classifySeafood } from '../taxonomy/seafoodClassifier.mjs'

export const brand = 'lacuriosa'

const COLLECTION_URL = 'https://lacuriosa.es/en/canned-goods/'

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
    } catch {
      break
    }

    const $ = cheerio.load(html)
    const productLinks = $('li.product a.woocommerce-LoopProduct-link')

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

async function fetchProduct(url) {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const title = $('h1').first().text().trim()
  if (!title) throw new Error('No product title')

  const imageUrl =
    $('img.wp-post-image').attr('src') || null

  return { title, imageUrl }
}

export async function scrape() {
  console.log('Scraping La Curiosa canned goods')

  const links = await extractProductLinks()
  console.log(`Found ${links.length} product links.`)

  const rows = []

  for (let i = 0; i < links.length; i++) {
    const url = links[i]
    console.log(`(${i + 1}/${links.length}) ${url}`)

    let product
    try {
      product = await fetchProduct(url)
    } catch {
      console.log('  Failed parse, skipping')
      continue
    }

    const seafood = classifySeafood(product.title)

    rows.push({
  brand: BRAND,
  product_name: product.title,
  fish_type,
  country: DEFAULT_COUNTRY,
  packing: inferPacking(product.title),
  source_url: url,
  source_image_url: product.imageUrl,
  notes: null,
})


    await sleep(PER_PAGE_DELAY_MS)
  }

  console.log(`Prepared ${rows.length} tins.`)
  return rows
}
