import Header from '@/app/components/Header';

// 개인정보처리방침 — 최소 버전 템플릿(2026-08-18 신규). 구글 OAuth 로그인 심사 요건 +
// 로그인 모달의 동의 문구 링크 대상으로 우선 생성. CLAUDE.md에 이미 기록된 실제 데이터
// 관행(구글 로그인, analysis_usage 이용 기록, Posthog/Clarity 분석, Supabase 백엔드)만
// 정직하게 서술 — 법적 자문 없이 작성된 최소 버전이라 과장된 준수 주장은 넣지 않는다.
// /guide와 동일하게 로그인 여부 무관 접근 가능, 한국어 전용(기존 /guide 컨벤션과 동일).
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">개인정보처리방침</h1>
        <p className="text-sm text-gray-400 mb-8">시행일: 2026-08-18 · 최소 버전</p>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. 수집하는 정보</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-600 leading-relaxed">
            <li>구글 로그인 시: 이메일 주소, 이름, 프로필 사진(구글 계정에서 제공하는 범위)</li>
            <li>서비스 이용 기록: 조회·분석한 기업명, 분석 요청 일시</li>
            <li>온보딩 설문(선택 입력 시): 소속 회사명, 조직 규모, 산업, 직무, 목적, 지역</li>
            <li>서비스 이용 행동 데이터(Posthog, Microsoft Clarity) — 클릭·페이지 이동 등
              사용 패턴, 일부 세션에서는 화면 재생(세션 리플레이)이 포함될 수 있음</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. 이용 목적</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-600 leading-relaxed">
            <li>로그인 및 계정 식별</li>
            <li>무료 이용 횟수 관리, 분석 히스토리 제공</li>
            <li>서비스 품질 개선(어떤 기능이 실제로 쓰이는지 파악)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. 보관 기간 및 제3자 제공</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            수집한 정보는 계정이 유지되는 동안 보관되며, 광고 목적의 제3자 판매·공유는
            하지 않습니다. 데이터는 Supabase(데이터베이스), Google(로그인), Posthog·
            Microsoft Clarity(이용 행동 분석) 등 서비스 운영에 필요한 처리자를 통해서만
            저장·처리됩니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. 계정 삭제 및 문의</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            계정 삭제나 보유 정보 확인을 원하시면 아래 연락처로 문의해 주세요.
          </p>
          <p className="text-sm text-gray-900 mt-2">sg.van.p@gmail.com</p>
        </section>

        <p className="text-xs text-gray-400 mt-10 pt-6 border-t border-gray-100">
          이 페이지는 서비스 초기 단계의 최소 버전 안내이며, 서비스 확장에 따라
          업데이트될 수 있습니다.
        </p>
      </div>
    </div>
  );
}
