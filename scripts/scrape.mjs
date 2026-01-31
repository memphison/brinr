// scripts/scrape.mjs

import { attachImages } from './pipeline/uploadImages.mjs'
import { insertTins } from './pipeline/insertTins.mjs'

const args = process.argv.slice(2)
const brandArg = args.find(a => a.startsWith('--brand='))

if (!brandArg) {
  console.error('❌ Missing --brand parameter')
  console.error('   Example: npm run scrape -- --brand=fishwife')
  process.exit(1)
}

const brandName = brandArg.split('=')[1]

const brands = {
  lacuriosa: () => import('./brands/lacuriosa.mjs'),
  josegourmet: () => import('./brands/josegourmet.mjs'),
  fishwife: () => import('./brands/fishwife.mjs'),
}

if (!brands[brandName]) {
  console.error(`❌ Unknown brand: ${brandName}`)
  console.error('   Available brands:', Object.keys(brands).join(', '))
  process.exit(1)
}

console.log(`▶ Starting scrape for brand: ${brandName}`)

try {
  const mod = await brands[brandName]()

  // 1. Scrape raw rows (metadata + source_image_url)
  let rows = await mod.scrape()

  if (!rows?.length) {
    console.log('ℹ️ No rows returned from scraper')
    process.exit(0)
  }

  // 2. Attach images (resize → upload → guard → image_url)
  rows = await attachImages(rows)

  // 3. Upsert into Supabase
  await insertTins(rows)

  console.log(`🧾 Scraped ${rows.length} tins for ${brandName}`)
} catch (err) {
  console.error(`❌ Scrape failed for ${brandName}`)
  console.error(err)
  process.exit(1)
}
