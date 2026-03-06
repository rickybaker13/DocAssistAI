import { Sparkles } from 'lucide-react';
import { SocialMediaLinks } from '../SocialMediaLinks';

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 py-12 px-4 text-center">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2">
        <Sparkles className="h-6 w-6 text-teal-400" />
        <span className="text-xl font-bold text-slate-50">DocAssist Scribe</span>
      </div>

      {/* Social media links */}
      <SocialMediaLinks />

      {/* Copyright */}
      <p className="mt-8 text-sm text-slate-500">
        &copy; {new Date().getFullYear()} DocAssistAI. All rights reserved.
      </p>

      {/* Legal links */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
        <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy Policy</span>
        <span aria-hidden="true">&middot;</span>
        <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms of Service</span>
        <span aria-hidden="true">&middot;</span>
        <span className="hover:text-slate-300 transition-colors cursor-pointer">HIPAA Compliance</span>
      </div>
    </footer>
  );
}
