const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'public', 'fonts');

fs.mkdirSync(destDir, { recursive: true });

const files = [
  { pkg: 'noto-sans-kr',  src: 'noto-sans-kr-korean-400-normal.woff',  dest: 'noto-sans-kr-400.woff' },
  { pkg: 'noto-sans-kr',  src: 'noto-sans-kr-korean-700-normal.woff',  dest: 'noto-sans-kr-700.woff' },
  // PDF 리포트 헤딩용(2026-08-16) — 풀 한글 char셋(2.4MB, sans 700의 ~2.7배) 필요.
  // /guide 페이지의 noto-serif-kr-700-guide.woff2는 고정 카피 전용 협소 서브셋이라
  // PDF의 동적 한글(회사명·생성 텍스트)엔 재사용 불가 — 별도 풀 char셋 파일로 확보.
  { pkg: 'noto-serif-kr', src: 'noto-serif-kr-korean-700-normal.woff', dest: 'noto-serif-kr-700.woff' },
];

let copied = 0;
for (const { pkg, src, dest } of files) {
  const srcPath = path.join(__dirname, '..', 'node_modules', '@fontsource', pkg, 'files', src);
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
