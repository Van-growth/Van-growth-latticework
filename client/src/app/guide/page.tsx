import Link from 'next/link';
import Header from '@/app/components/Header';
import styles from './guide.module.css';

// "사용법" 페이지 — ceo_staff_ben_guide.html 원본 구조/카피 그대로 이식(2026-08-18).
// 로그인 여부와 무관하게 누구나 접근 가능(다른 인증 게이트 없음, 공유 링크로 바로 열람
// 가능해야 한다는 요구사항) — Header는 다른 메인 탭과 동일하게 항상 렌더.
export default function GuidePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.brandRow}>
            <div className={styles.brand}>CEO Staff Ben</div>
            <div className={styles.brandTag}>사용 가이드</div>
          </div>

          <div className={styles.hero}>
            <span className={styles.eyebrow}>1분 기업분석</span>
            <h1 className={styles.serif}>
              비서를 따로 두지 않아도,
              <br />
              1분이면 기업 하나를 파악합니다
            </h1>
            <p>인수·투자·파트너십·고객사 검토 — 무엇을 위한 리서치든, 회사명 하나만 입력하면 됩니다.</p>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>시작하기</div>
            <h2 className={styles.serif}>3단계면 끝나요</h2>
            <div className={styles.steps}>
              <div className={styles.step}>
                <div className={`${styles.stepNum} ${styles.serif}`}>1</div>
                <div className={styles.stepBody}>
                  <h3>회사명을 입력하세요</h3>
                  <p>한국·미국 상장사 모두 검색됩니다. &quot;삼성전자&quot;, &quot;Apple&quot; 처럼 편하게 입력하세요.</p>
                </div>
              </div>
              <div className={styles.step}>
                <div className={`${styles.stepNum} ${styles.serif}`}>2</div>
                <div className={styles.stepBody}>
                  <h3>이 분석이 왜 필요한지 알려주세요</h3>
                  <p>인수합병 / 투자 / 파트너십 / 고객 / 기타 중 하나를 고르고, 상황을 한두 줄로 적어주시면 리포트가 그 목적에 맞춰 만들어집니다.</p>
                </div>
              </div>
              <div className={styles.step}>
                <div className={`${styles.stepNum} ${styles.serif}`}>3</div>
                <div className={styles.stepBody}>
                  <h3>분석하기를 누르고 기다리세요</h3>
                  <p>9개 섹션이 동시에 만들어져요. 완료된 것부터 바로 읽으실 수 있고, 전체 완료까지 1~2분 정도 걸립니다.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>리포트 안에 있는 것</div>
            <h2 className={styles.serif}>한 번에 9가지 + 1</h2>
            <div className={styles.cardGrid}>
              <div className={styles.card}>
                <div className={styles.cardIcon}>📋</div>
                <h4>요약</h4>
                <p>이 회사가 무엇을 하는 곳인지, 핵심만 세 줄로.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>🔗</div>
                <h4>밸류체인</h4>
                <p>이 회사가 산업 안 어디에 위치하는지.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>🏢</div>
                <h4>비즈니스모델</h4>
                <p>어떻게 돈을 버는 회사인지.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>⚔️</div>
                <h4>경쟁사</h4>
                <p>누구와 경쟁하고 있는지.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>📊</div>
                <h4>재무</h4>
                <p>매출·이익·성장률 — 공식 공시 기준.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>🎯</div>
                <h4>전략</h4>
                <p>지금 이 회사가 어디로 가려 하는지.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>👤</div>
                <h4>창업자·경영진</h4>
                <p>누가 이끄는 회사인지.</p>
              </div>
              <div className={styles.card}>
                <div className={styles.cardIcon}>📚</div>
                <h4>출처</h4>
                <p>모든 수치와 사실의 근거를 한 곳에 모아 보여드려요.</p>
              </div>
              <div className={`${styles.card} ${styles.wide}`} style={{ borderColor: 'var(--navy-deep)' }}>
                <div className={styles.cardIcon}>💡</div>
                <h4>
                  산업 역사·기술 진화 <span style={{ fontWeight: 400, color: 'var(--muted)' }}>— CEO Staff Ben만의 기능</span>
                </h4>
                <p>이 산업이 지금 어떤 국면에 있고, 어떤 기술 변화가 이 회사를 흔들고 있는지 — 겉으로 드러난 숫자 너머의 맥락을 짚어드립니다.</p>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>더 깊이 물어보기</div>
            <h2 className={styles.serif}>AI CEO Staff, Ben에게 직접 질문하세요</h2>
            <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '-12px 0 20px' }}>
              Ben은 분석 요청한 기업의 정보를 바탕으로 의사결정을 지원합니다.
            </p>
            <div className={styles.tipBox}>
              <ul>
                <li>리포트 옆 채팅창의 Ben은 방금 만든 리포트 내용을 전부 알고 있어요.</li>
                <li>&quot;이 회사 재무 건전성이 우리 인수 조건에 맞나?&quot; 처럼, 궁금한 걸 그대로 물어보시면 됩니다.</li>
                <li>정해진 질문 목록이 아니라, 그때그때 떠오르는 걸 편하게 물어보시는 용도예요.</li>
              </ul>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>상황별 활용</div>
            <h2 className={styles.serif}>목적에 따라 이렇게 써보세요</h2>
            <div className={styles.purposeList}>
              <div className={styles.purposeRow}>
                <div className={styles.purposeTag}>인수합병</div>
                <div>
                  <p>인수 후보군을 좁힐 때, 재무 건전성과 사업 적합성을 먼저 훑어보세요.</p>
                  <p className={styles.ex}>예: &quot;우리가 인수할 만한 OO 분야 회사를 찾아, 재무 건전성을 확인하고 싶어&quot;</p>
                </div>
              </div>
              <div className={styles.purposeRow}>
                <div className={styles.purposeTag}>투자</div>
                <div>
                  <p>투자 검토 전, 산업 내 포지션과 성장 시나리오를 한눈에 확인하세요.</p>
                </div>
              </div>
              <div className={styles.purposeRow}>
                <div className={styles.purposeTag}>파트너십</div>
                <div>
                  <p>제휴·협업을 제안하기 전, 상대 회사와의 fit을 미리 가늠해보세요.</p>
                </div>
              </div>
              <div className={styles.purposeRow}>
                <div className={styles.purposeTag}>고객</div>
                <div>
                  <p>미팅 전, 고객사의 현재 상황과 관심사를 빠르게 파악하세요.</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>알아두면 좋은 것</div>
            <h2 className={styles.serif}>이용 팁</h2>
            <div className={styles.tipBox}>
              <ul>
                <li><strong>산업별 보기</strong> 탭에서는 업종별 매출 상위 기업을 바로 훑어볼 수 있어요.</li>
                <li><strong>히스토리</strong> 탭에서 예전에 본 회사를 다시 찾을 수 있고, 별표를 눌러두면 즐겨찾기로 상단에 고정돼요.</li>
                <li>수치 옆의 🟢🟡⚪ 표시는 출처 신뢰도예요 — 🟢공식(SEC·DART 등 공시), 🟡참고, ⚪추정.</li>
                <li>같은 회사를 다시 검색해도 최근 분석 결과를 바로 불러오니, 매번 새로 기다릴 필요 없어요.</li>
              </ul>
            </div>
          </div>

          <div className={styles.cta}>
            <h2 className={styles.serif}>지금 바로 시작해보세요</h2>
            <p>회사명 하나만 입력하면, 1~2분 안에 리포트가 만들어집니다.</p>
            <Link href="/" className={styles.ctaButton}>
              지금 분석해보기 →
            </Link>
          </div>

          <div className={styles.footerNote}>CEO Staff Ben · 회장님의 리서치를 대신하는 1분</div>
        </div>
      </div>
    </div>
  );
}
