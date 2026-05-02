import { Suspense } from 'react';
import Link from 'next/link';
import HomeContent from './components/HomeContent';

export default function Home() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-lg">Latticework</span>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-blue-600 font-medium">분석</Link>
            <Link href="/history" className="text-gray-500 hover:text-gray-800">히스토리</Link>
            <Link href="/linkedin" className="text-gray-500 hover:text-gray-800">LinkedIn</Link>
          </div>
        </div>
      </nav>

      <Suspense fallback={
        <div className="max-w-4xl mx-auto px-4 py-24 text-center text-gray-400 text-sm">
          로딩 중...
        </div>
      }>
        <HomeContent />
      </Suspense>
    </div>
  );
}
