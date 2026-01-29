import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

/**
 * CONFIG
 */
const BRAND = 'fishwife' // lowercase folder name
const INPUT_DIR = path.join('raw-images', BRAND)
const OUTPUT_DIR = path.join('brinr-images', BRAND)
const SIZE = 400

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const validExts = ['.jpg', '.jpeg', '.png']

function isImage(file) {
  return validExts.includes(path.extname(file).toLowerCase())
}

async function processImage(file) {
  const inputPath = path.join(INPUT_DIR, file)

  const baseName = path.parse(file).name
  const outputPath = path.join(OUTPUT_DIR, `${baseName}.png`)

  // Skip if already processed
  if (fs.existsSync(outputPath)) {
    console.log(`↩ already exists: ${baseName}.png`)
    return
  }

  try {
    const image = sharp(inputPath)
    const meta = await image.metadata()

    const size = Math.min(meta.width, meta.height)

    await image
      .extract({
        left: Math.floor((meta.width - size) / 2),
        top: Math.floor((meta.height - size) / 2),
        width: size,
        height: size,
      })
      .resize(SIZE, SIZE)
      .png({ quality: 100 })
      .toFile(outputPath)

    console.log(`✅ processed: ${baseName}.png`)
  } catch (err) {
    console.error(`❌ failed: ${file}`, err.message)
  }
}

async function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Missing input folder: ${INPUT_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(INPUT_DIR).filter(isImage)

  console.log(`brinr-image: processing ${files.length} images for ${BRAND}`)

  for (const file of files) {
    await processImage(file)
  }

  console.log('Done.')
}

main()
