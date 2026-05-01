'use client';

import { useState } from 'react';
import { LinkedInDraft } from '@/types';

const STYLE_LABELS = ['인사이트 공유형', '질문형', '스토리텔링형'];

export default function LinkedInDraftCard({ draft }: { draft: LinkedInDraft }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(draft.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const label = STYLE_LABELS[draft.draft_number - 1] ?? `초안 ${draft.draft_number}`;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          {draft.draft_number}. {label}
        </span>
        <button
          onClick={handleCopy}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{draft.content}</p>
      <p className="mt-2 text-xs text-gray-400 text-right">{draft.content.length}자</p>
    </div>
  );
}
