import { Suspense } from 'react';
import Header from './components/Header';
import HomeContent from './components/HomeContent';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

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
