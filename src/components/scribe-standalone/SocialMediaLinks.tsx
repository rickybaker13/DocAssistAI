import React from 'react';
import { ExternalLink } from 'lucide-react';

type SocialLink = {
  label: string;
  href: string;
};

const followLinks: SocialLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/docassistai' },
  { label: 'X', href: 'https://x.com/docassistai_app' },
  { label: 'Facebook', href: 'https://www.facebook.com/docassistai' },
  { label: 'Instagram', href: 'https://www.instagram.com/docassistai' },
  { label: 'YouTube', href: 'https://www.youtube.com/@docassistai' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@docassistai' },
];

const shareLinks: SocialLink[] = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocassistai.com',
  },
  {
    label: 'X',
    href: 'https://twitter.com/intent/tweet?url=https%3A%2F%2Fdocassistai.com&text=DocAssistAI%20helps%20make%20clinical%20documentation%20faster%20and%20easier.',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocassistai.com',
  },
  {
    label: 'Reddit',
    href: 'https://www.reddit.com/submit?url=https%3A%2F%2Fdocassistai.com&title=DocAssistAI%20for%20clinical%20documentation',
  },
  {
    label: 'WhatsApp',
    href: 'https://wa.me/?text=Check%20out%20DocAssistAI%20for%20clinical%20documentation%3A%20https%3A%2F%2Fdocassistai.com',
  },
];

const renderLinks = (links: SocialLink[]) =>
  links.map(({ label, href }) => (
    <a
      key={label}
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
    >
      {label}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  ));

export const SocialMediaLinks: React.FC = () => {
  return (
    <div className="mt-6 space-y-3 border-t border-slate-800 pt-4">
      <div>
        <p className="text-center text-xs uppercase tracking-wider text-slate-500">Follow DocAssistAI</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{renderLinks(followLinks)}</div>
      </div>
      <div>
        <p className="text-center text-xs uppercase tracking-wider text-slate-500">Post about DocAssistAI</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{renderLinks(shareLinks)}</div>
      </div>
    </div>
  );
};
