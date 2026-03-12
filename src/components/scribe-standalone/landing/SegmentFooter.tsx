import { Link } from 'react-router-dom';
import { DocAssistLogo } from '../DocAssistLogo';

export default function SegmentFooter() {
  return (
    <footer className="border-t border-slate-800 py-12 px-4 text-center">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2">
        <DocAssistLogo className="h-10 w-10 rounded-lg" />
        <span className="text-xl font-bold text-slate-50">DocAssistAI</span>
      </div>

      {/* Tagline */}
      <p className="mt-3 text-sm text-slate-400 italic">
        Doc Assist AI &mdash; built by clinicians, for clinicians.
      </p>

      {/* Segment links */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <Link to="/for-pas" className="hover:text-slate-300 transition-colors">For PAs</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/for-nps" className="hover:text-slate-300 transition-colors">For NPs</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/for-residents" className="hover:text-slate-300 transition-colors">For Residents</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/for-practices" className="hover:text-slate-300 transition-colors">For Practices</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/security" className="hover:text-slate-300 transition-colors">Security</Link>
      </div>

      {/* Copyright */}
      <p className="mt-6 text-sm text-slate-500">
        &copy; {new Date().getFullYear()} DocAssistAI. All rights reserved.
      </p>

      {/* Legal links */}
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/privacy#hipaa" className="hover:text-slate-300 transition-colors">HIPAA</Link>
      </div>
    </footer>
  );
}
