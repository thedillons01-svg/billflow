import sharp from 'sharp'
import { copyFileSync } from 'fs'

const src = 'pomatic_app_icon_512x512.png'

// Next.js App Router: icon.png → favicon, apple-icon.png → iOS home screen
await sharp(src).resize(32, 32).toFile('src/app/icon.png')
console.log('✓ src/app/icon.png (32×32 favicon)')

await sharp(src).resize(180, 180).toFile('src/app/apple-icon.png')
console.log('✓ src/app/apple-icon.png (180×180 iOS)')

// Keep a 512×512 in public/ for the Intuit app listing
await sharp(src).resize(512, 512).toFile('public/logo-512.png')
console.log('✓ public/logo-512.png (512×512 Intuit / OG)')

// Small version for in-app header (replaces the green square + icon)
await sharp(src).resize(28, 28).toFile('public/logo-28.png')
console.log('✓ public/logo-28.png (28×28 app header)')

console.log('Done')
