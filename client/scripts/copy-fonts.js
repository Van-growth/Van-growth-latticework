const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', '@fontsource', 'noto-sans-kr', 'files');
const destDir = path.join(__dirname, '..', 'public', 'fonts');

fs.mkdirSync(destDir, { recursive: true });

const files = [
  { src: 'noto-sans-kr-korean-400-normal.woff', dest: 'noto-sans-kr-400.woff' },
  { src: 'noto-sans-kr-korean-700-normal.woff', dest: 'noto-sans-kr-700.woff' },
];

let copied = 0;
for (const { src, dest } of files) {
  const srcPath = path.join(srcDir, src);
  const destPath = path.join(destDir, dest);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`copied: ${src} → public/fonts/${dest}`);
    copied++;
  } else {
    console.warn(`font not found: ${srcPath}`);
  }
}

console.log(`font copy done: ${copied}/${files.length}`);
