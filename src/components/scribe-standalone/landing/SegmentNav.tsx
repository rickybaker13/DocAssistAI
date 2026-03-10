import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { DocAssistLogo } from '../DocAssistLogo';

const segmentLinks = [
  { label: 'For PAs', to: '/for-pas' },
  { label: 'For NPs', to: '/for-nps' },
  { label: 'For Residents', to: '/for-residents' },
  { label: 'For Practices', to: '/for-practices' },
];

interface SegmentNavProps {
  /** The currently active segment route, e.g. "/for-pas" */
  active?: string;
}

export default function SegmentNav({ active }: SegmentNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo → home */}
        <Link to="/" className="flex items-center gap-2">
          <DocAssistLogo className="h-12 w-12 rounded-xl" />
          <span className="text-lg font-bold text-slate-50">DocAssistAI</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-5 md:flex">
          {segmentLinks.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm transition-colors ${
                active === to
                  ? 'text-teal-400 font-medium'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/security"
            className={`text-sm transition-colors ${
              active === '/security'
                ? 'text-teal-400 font-medium'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Security
          </Link>
          <Link
            to="/scribe/login"
            className="text-sm text-slate-400 transition-colors hover:text-slate-100"
          >
            Sign In
          </Link>
          <Link
            to="/scribe/register"
            className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-teal-300"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden text-slate-400 hover:text-slate-100"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-800/50 bg-slate-950/95 backdrop-blur-lg md:hidden">
          <div className="space-y-1 px-4 py-4">
            {segmentLinks.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  active === to
                    ? 'bg-teal-400/10 text-teal-400 font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-50'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              to="/security"
              onClick={() => setMobileMenuOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                active === '/security'
                  ? 'bg-teal-400/10 text-teal-400 font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-50'
              }`}
            >
              Security
            </Link>
            <Link
              to="/scribe/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50"
            >
              Sign In
            </Link>
            <Link
              to="/scribe/register"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 block rounded-lg bg-teal-400 px-3 py-2.5 text-center text-sm font-semibold text-slate-900 transition-colors hover:bg-teal-300"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
