import { Link } from 'react-router-dom';
import { SocialMediaLinks } from '../SocialMediaLinks';
import { DocAssistLogo } from '../DocAssistLogo';

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 py-12 px-4 text-center">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2">
        <DocAssistLogo className="h-6 w-6 rounded" />
        <span className="text-xl font-bold text-slate-50">DocAssistAI</span>
      </div>

      {/* Social media links */}
      <SocialMediaLinks />

      {/* Copyright */}
      <p className="mt-8 text-sm text-slate-500">
        &copy; {new Date().getFullYear()} DocAssistAI. All rights reserved.
      </p>

      {/* Legal links */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/privacy#hipaa" className="hover:text-slate-300 transition-colors">HIPAA Compliance</Link>
      </div>
    </footer>
  );
}
