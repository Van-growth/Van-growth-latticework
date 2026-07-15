import { Metadata } from 'next';
import ShareContent from './ShareContent';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const res = await fetch(`${API_URL}/api/share/${token}`, { cache: 'no-store' });
    if (!res.ok) return { title: '1min' };
    const data = await res.json();
    const company: string = data.companyName ?? '';
    const desc: string = data.summary_v2?.one_line ?? data.summary ?? `${company} 기업 심층 분석`;
    return {
      title: `${company} 분석 — 1min`,
      description: desc,
      openGraph: {
        title: `${company} 기업 분석 — 1min`,
        description: desc,
        type: 'article',
      },
      twitter: {
        card: 'summary',
        title: `${company} 분석 — 1min`,
        description: desc,
      },
    };
  } catch {
    return { title: '1min' };
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ShareContent token={token} />;
}
