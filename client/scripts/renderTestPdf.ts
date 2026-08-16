// TEMP — PDF 개편 검증 전용 스크립트(server-side Route Handler 방식은 Next.js RSC가
// 'use client' 컴포넌트를 서버에서 직접 invoke하는 것을 막아 실패 — 순수 Node/tsx로
// Next 빌드 파이프라인을 우회해서 렌더링). 검증 완료 후 삭제.
// 실행: cd client && npx tsx scripts/renderTestPdf.ts
// 사전 조건: server dev(4000)가 떠 있어야 함(GET /api/analyses/:id 호출).
import * as fs from 'fs';
import * as path from 'path';
import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { AnalysisDetail } from '../src/types';

async function main() {
  // 정적 import는 이 shim보다 먼저 평가되므로(호이스팅), AnalysisPdf.tsx의 모듈 레벨
  // Font.register가 window.location.origin을 읽기 전에 shim이 걸리도록 동적 import 사용.
  (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
  const { default: AnalysisPdf } = await import('../src/app/components/AnalysisPdf');

  const id = 'aa601e3a-3c36-4a8c-8e87-0c0aeff3490e'; // 에이피알
  const res = await fetch(`http://localhost:4000/api/analyses/${id}`);
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = (await res.json()) as AnalysisDetail;
  console.log('fetched analysis for', data.companyName, 'dataSource=', data.dataSource);

  const instance = pdf(createElement(AnalysisPdf, { data }) as any);
  const buffer: any = await instance.toBuffer();

  const chunks: Buffer[] = [];
  for await (const chunk of buffer) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const pdfBuffer = Buffer.concat(chunks);

  const outPath = path.resolve(__dirname, '../../apr_pdf_test.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log('PDF written to', outPath, `(${pdfBuffer.length} bytes)`);
}

main().catch(err => {
  console.error('FAILED', err);
  process.exit(1);
});
