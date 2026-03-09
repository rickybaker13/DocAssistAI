import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { DocAssistLogo } from './DocAssistLogo';
import HeroSection from './landing/HeroSection';
import PainPointSection from './landing/PainPointSection';
import HowItWorksSection from './landing/HowItWorksSection';
import InteractiveTourSection from './landing/InteractiveTourSection';
import FeaturesGrid from './landing/FeaturesGrid';
import PricingCTA from './landing/PricingCTA';
import LandingFooter from './landing/LandingFooter';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

function smoothScroll(hash: string) {
  const el = document.querySelector(hash);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

export default function ScribeLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    smoothScroll(href);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ─── Sticky Nav ─── */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <DocAssistLogo className="h-12 w-12 rounded-xl" />
            <span className="text-lg font-bold text-slate-50">DocAssistAI</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => handleNavClick(e, href)}
                className="text-sm text-slate-400 transition-colors hover:text-slate-100"
              >
                {label}
              </a>
            ))}
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

        {/* Mobile slide-down drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-800/50 bg-slate-950/95 backdrop-blur-lg md:hidden">
            <div className="space-y-1 px-4 py-4">
              {navLinks.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50"
                >
                  {label}
                </a>
              ))}
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

      {/* ─── Page Sections ─── */}
      <main>
        <HeroSection />
        <PainPointSection />
        <HowItWorksSection />
        <InteractiveTourSection />
        <FeaturesGrid />
        <PricingCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
