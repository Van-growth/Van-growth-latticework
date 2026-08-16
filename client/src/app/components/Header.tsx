'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';
import BenLauncher from './BenLauncher';

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const { language } = useLanguage();
  const t = getUiStrings(language).header;

  // 최상단 내비게이션 — 기업분석/산업별 보기/히스토리 3개 nav 링크 + 우측 Ben 버튼(상시) +
  // 아바타 드롭다운(설정/로그아웃, 2026-08-18) 구조. 설정/로그아웃은 이전엔 나머지와 같은
  // nav 링크였으나(2026-08-17 "1단 구조"), Ben 버튼 자리를 만들기 위해 아바타 클릭 시
  // 뜨는 드롭다운으로 재배치.
  const navLinkCls = (active: boolean) =>
    `text-sm ${active ? 'text-navy-600 font-medium' : 'text-gray-500 hover:text-gray-800'}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpen]);

  return (
    <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-[1280px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <span className="font-bold text-gray-900 text-lg shrink-0">1min</span>
          <div className="flex gap-4 flex-wrap">
            <Link href="/" className={navLinkCls(pathname === '/')}>{t.analysis}</Link>
            <Link href="/industries" className={navLinkCls(pathname === '/industries')}>{t.industries}</Link>
            <Link href="/history" className={navLinkCls(pathname === '/history')}>{t.history}</Link>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <BenLauncher />

          {!loading && (
            user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2"
                >
                  {user.user_metadata?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-navy-100 text-navy-700 text-xs font-semibold flex items-center justify-center">
                      {(user.email ?? '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-gray-500 hidden sm:inline max-w-[160px] truncate">{user.email}</span>
                </button>

                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20">
                    <div className="px-3 py-2 text-xs text-gray-400 truncate border-b border-gray-100 sm:hidden">{user.email}</div>
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t.settings}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenuOpen(false); signOut(); }}
                      aria-label={t.logoutAria}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t.logout}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="flex items-center gap-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 shadow-sm hover:bg-gray-50 transition-colors shrink-0"
              >
                <GoogleIcon />
                {t.loginWithGoogle}
              </button>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
