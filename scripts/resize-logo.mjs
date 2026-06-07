import sharp from 'sharp'

const src = 'pomatic_app_icon_512x512.png'

// Favicon and app store sizes (full image, no crop)
await sharp(src).resize(32, 32).toFile('src/app/icon.png')
console.log('✓ src/app/icon.png (32×32 favicon)')

await sharp(src).resize(180, 180).toFile('src/app/apple-icon.png')
console.log('✓ src/app/apple-icon.png (180×180 iOS)')

await sharp(src).resize(512, 512).toFile('public/logo-512.png')
console.log('✓ public/logo-512.png (512×512 Intuit / OG)')

// Header version: trim whitespace so the P mark fills the space
await sharp(src)
  .trim({ threshold: 30, background: '#f5f5f5' })
  .resize(28, 28, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile('public/logo-28.png')
console.log('✓ public/logo-28.png (28×28 trimmed for header)')

console.log('Done')
