import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const publicAssetsDir = path.join(projectRoot, 'public', 'assets');
const publicDir = path.join(projectRoot, 'public');

if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}

const tmpDir = path.join(projectRoot, '.tmp-icon-build');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

console.log('>>> [1/5] Extracting official circular HSECORE emblem...');
const originalLogoPath = path.join(publicAssetsDir, 'aistudio', 'ChatGPT_Image_Oct_8__2026__12_04_00_PM_42699341.png');

// The emblem in original 1024x1024 is at +185+185 with size 654x654
// Mask it cleanly with anti-aliasing
const emblemMask = path.join(tmpDir, 'emblem_mask.png');
const emblemCrop = path.join(tmpDir, 'emblem_crop.png');
const emblemClean = path.join(tmpDir, 'emblem_clean.png');

execSync(`convert -size 654x654 xc:black -fill white -draw "circle 327,327 327,1" "${emblemMask}"`);
execSync(`convert "${originalLogoPath}" -crop 654x654+185+185 +repage "${emblemCrop}"`);
execSync(`convert "${emblemCrop}" "${emblemMask}" -alpha off -compose CopyOpacity -composite "${emblemClean}"`);

console.log('>>> [2/5] Creating Windows squircle tile with 3D bevel and ambient depth...');
// Dimensions on 1024x1024:
// Rounded rect: x1=88, y1=76, x2=936, y2=924 -> size 848x848, radius=186
const dropShadow = path.join(tmpDir, 'tile_shadow.png');
const tileBase = path.join(tmpDir, 'tile_base.png');
const tileHighlight = path.join(tmpDir, 'tile_highlight.png');
const tileComposed = path.join(tmpDir, 'tile_composed.png');

// 1. Ambient drop shadow under tile
execSync(`
  convert -size 1024x1024 xc:none \
    -fill "rgba(0,8,22,0.45)" \
    -draw "roundrectangle 88,100 936,948 186,186" \
    -gaussian-blur 0x24 \
    "${dropShadow}"
`);

// 2. Base Squircle with rich modern Windows Fluent dark slate/navy gradient
const gradientBase = path.join(tmpDir, 'grad_base.png');
const squircleMask = path.join(tmpDir, 'squircle_mask.png');

execSync(`
  convert -size 1024x1024 gradient:"#1e2d42-#0b1320" \
    "${gradientBase}"
`);

execSync(`
  convert -size 1024x1024 xc:black \
    -fill white \
    -draw "roundrectangle 88,76 936,924 186,186" \
    "${squircleMask}"
`);

// Combine base gradient + mask
execSync(`
  convert "${gradientBase}" "${squircleMask}" -alpha off -compose CopyOpacity -composite \
    "${tileBase}"
`);

// 3. Delicate 3D Bevel Rim / Edge Highlight (specular top highlight)
execSync(`
  convert -size 1024x1024 xc:none \
    -stroke "rgba(255,255,255,0.24)" -strokewidth 2.5 -fill none \
    -draw "roundrectangle 89,77 935,923 185,185" \
    "${tileHighlight}"
`);

// Overlay shadow + tile base + highlight
execSync(`
  convert "${dropShadow}" "${tileBase}" -compose Over -composite \
    "${tileHighlight}" -compose Over -composite \
    "${tileComposed}"
`);

console.log('>>> [3/5] Resizing and placing HSECORE emblem with 3D elevation...');
// Resize emblem to 570x570
const emblemResized = path.join(tmpDir, 'emblem_570.png');
const emblemShadow = path.join(tmpDir, 'emblem_shadow.png');
const master1024 = path.join(publicAssetsDir, 'hsecore-app-icon.png');

execSync(`convert "${emblemClean}" -filter Lanczos -resize 570x570 "${emblemResized}"`);

// Soft drop shadow directly behind emblem (center is at 512, 500)
execSync(`
  convert -size 1024x1024 xc:none \
    -fill "rgba(0,0,0,0.40)" \
    -draw "circle 512,512 512,797" \
    -gaussian-blur 0x14 \
    "${emblemShadow}"
`);

// Master composite: Tile + Emblem Shadow + Emblem (at x=227, y=215 -> center 512, 500)
execSync(`
  convert "${tileComposed}" "${emblemShadow}" -compose Over -composite \
    "${emblemResized}" -geometry +227+215 -compose Over -composite \
    "${master1024}"
`);

console.log(`✓ Master 1024x1024 icon generated: ${master1024}`);

console.log('>>> [4/5] Generating multi-size PNG exports (512, 256, 192, 128, 64, 48, 32, 16)...');
const sizes = [512, 256, 192, 128, 64, 48, 32, 16];
for (const s of sizes) {
  const outPng = path.join(publicAssetsDir, `hsecore-icon-${s}.png`);
  execSync(`convert "${master1024}" -filter Lanczos -resize ${s}x${s} "${outPng}"`);
}

// Copy standard PWA icons
fs.copyFileSync(path.join(publicAssetsDir, 'hsecore-icon-512.png'), path.join(publicAssetsDir, 'icon-512.png'));
fs.copyFileSync(path.join(publicAssetsDir, 'hsecore-icon-192.png'), path.join(publicAssetsDir, 'icon-192.png'));

console.log('>>> [5/5] Generating standard Windows multi-resolution .ico bundles...');
const icoDestinations = [
  path.join(publicAssetsDir, 'hsecore-icon.ico'),
  path.join(publicDir, 'favicon.ico'),
  path.join(publicDir, 'icon.ico')
];

for (const dest of icoDestinations) {
  execSync(`
    convert \
      "${path.join(publicAssetsDir, 'hsecore-icon-256.png')}" \
      "${path.join(publicAssetsDir, 'hsecore-icon-128.png')}" \
      "${path.join(publicAssetsDir, 'hsecore-icon-64.png')}" \
      "${path.join(publicAssetsDir, 'hsecore-icon-48.png')}" \
      "${path.join(publicAssetsDir, 'hsecore-icon-32.png')}" \
      "${path.join(publicAssetsDir, 'hsecore-icon-16.png')}" \
      "${dest}"
  `);
  console.log(`✓ Windows ICO created: ${dest}`);
}

// Cleanup temp files
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {
  // Ignore
}

console.log('🎉 Standardized HSECORE Windows application icons successfully created and integrated!');
