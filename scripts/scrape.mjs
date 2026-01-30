// scripts/scrape.mjs

const args = process.argv.slice(2)
const brandArg = args.find(a => a.startsWith('--brand='))

if (!brandArg) {
  console.error('❌ Missing --brand parameter')
  console.error('   Example: npm run scrape -- --brand=lacuriosa')
  process.exit(1)
}

const brandName = brandArg.split('=')[1]

const brands = {
  lacuriosa: () => import('./brands/lacuriosa.mjs'),
  josegourmet: () => import('./brands/josegourmet.mjs'),
  // fishwife: () => import('./brands/fishwife.mjs'),
}

if (!brands[brandName]) {
  console.error(`❌ Unknown brand: ${brandName}`)
  console.error('   Available brands:', Object.keys(brands).join(', '))
  process.exit(1)
}

console.log(`▶ Starting scrape for brand: ${brandName}`)

try {
  const mod = await brands[brandName]()
  const rows = await mod.scrape()

  console.log(
    `✅ Scraped ${rows?.length ?? 0} tins for ${brandName}`
  )
} catch (err) {
  console.error(`❌ Scrape failed for ${brandName}`)
  console.error(err)
  process.exit(1)
}
