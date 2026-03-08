import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const ScribePrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <article className="prose prose-invert prose-slate max-w-none">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">DocAssistAI Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-8">
            Effective date: March 3, 2026 &middot; Entity: DocAssistAI (&ldquo;DocAssistAI,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;)
          </p>

          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">1. Scope</h2>
              <p>This Privacy Policy explains how DocAssistAI collects, uses, discloses, and protects personal information when you use our websites, applications, APIs, and related services (the &ldquo;Services&rdquo;).</p>
              <p className="mt-2">If you are an end user accessing Services through a healthcare organization, that organization may control certain data-processing decisions. In those cases, we may act as a service provider/processor on its behalf.</p>
            </div>

            <div id="hipaa">
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">2. HIPAA and Clinical Data Context</h2>
              <p>Depending on service configuration and contracting:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>DocAssistAI may process Protected Health Information (PHI) as a Business Associate under a signed Business Associate Agreement (BAA).</li>
                <li>Where a BAA applies, PHI processing follows HIPAA/HITECH and the BAA terms.</li>
                <li>If no BAA is in place, Customers must not submit PHI unless legally permitted and contractually authorized.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">3. Information We Collect</h2>

              <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">3.1 Account and Identity Data</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Name, organization, work email, username, role</li>
                <li>Authentication metadata (login timestamps, IP-derived context, device/session identifiers)</li>
              </ul>

              <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">3.2 Customer-Submitted Content</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Clinical notes, transcripts, prompts, templates, and related healthcare workflow content</li>
                <li>Files, structured records, and integration payloads (e.g., EHR/FHIR-connected datasets where enabled)</li>
              </ul>

              <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">3.3 Technical and Usage Data</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Log files, diagnostics, feature usage metrics, API metadata, error reports</li>
                <li>Browser/device information and performance telemetry</li>
              </ul>

              <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">3.4 Communications Data</h3>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Support requests, account communications, security notices, and operational messages</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">4. How We Use Information</h2>
              <p>We use information to:</p>
              <ol className="list-decimal pl-6 mt-2 space-y-1">
                <li>Provide and operate the Services,</li>
                <li>Authenticate users and secure accounts,</li>
                <li>Generate requested AI-assisted outputs,</li>
                <li>Monitor performance, reliability, and abuse,</li>
                <li>Troubleshoot and provide support,</li>
                <li>Comply with legal, security, and contractual obligations,</li>
                <li>Improve Service quality and features, including through de-identified/aggregated analytics where permitted.</li>
              </ol>
              <p className="mt-2 font-medium text-slate-100">We do not sell PHI.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">5. Legal Bases (Where Applicable)</h2>
              <p>Depending on jurisdiction and context, legal bases may include:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>performance of a contract,</li>
                <li>legitimate interests (e.g., security and product improvement),</li>
                <li>compliance with legal obligations,</li>
                <li>consent where required.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">6. Disclosures of Information</h2>
              <p>We may disclose information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>to subprocessors/service providers (hosting, security, analytics, support, communications),</li>
                <li>to integration partners at your direction,</li>
                <li>to affiliates involved in service delivery,</li>
                <li>to regulators/law enforcement where legally required,</li>
                <li>in connection with mergers, financing, acquisition, or asset transfers,</li>
                <li>to protect rights, safety, security, and fraud-prevention interests.</li>
              </ul>
              <p className="mt-2">All disclosures are subject to contractual and legal controls appropriate to data sensitivity.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">7. Subprocessors and Vendor Management</h2>
              <p>DocAssistAI uses third-party providers for infrastructure and functionality (which may include AI model providers). We apply a vendor review process that may include security and contractual due diligence.</p>
              <p className="mt-2">On request (and where contractually required), we provide available subprocessor information relevant to the Services in use.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">8. Data Retention</h2>
              <p>We retain personal information only as long as necessary for service delivery, contractual commitments, legal and regulatory obligations, dispute resolution and enforcement, and security and fraud-prevention purposes.</p>
              <p className="mt-2">Retention periods vary by data category and Customer configuration.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">9. Security Measures</h2>
              <p>We implement safeguards designed to protect personal information, including as appropriate:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>encryption controls,</li>
                <li>access and authorization controls,</li>
                <li>logging and monitoring,</li>
                <li>secure development and change management practices,</li>
                <li>workforce confidentiality/security obligations,</li>
                <li>incident response procedures.</li>
              </ul>
              <p className="mt-2">No system is completely secure; however, we continuously assess and improve controls.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">10. International Data Transfers</h2>
              <p>If data is transferred across borders, we implement appropriate transfer safeguards required by applicable law and contract.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">11. Your Rights and Choices</h2>
              <p>Depending on jurisdiction, you may have rights to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>access personal information,</li>
                <li>correct inaccurate data,</li>
                <li>request deletion,</li>
                <li>object to or restrict certain processing,</li>
                <li>data portability,</li>
                <li>withdraw consent (where processing is consent-based).</li>
              </ul>
              <p className="mt-2">For data controlled by a healthcare organization using DocAssistAI, we may direct your request to that organization when required.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">12. Cookies and Similar Technologies</h2>
              <p>Our web properties may use cookies or similar technologies for essential functionality, performance and analytics, and security and session management.</p>
              <p className="mt-2">Where required, we provide consent controls.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">13. Children&rsquo;s Privacy</h2>
              <p>The Services are not intended for use by children under 13 as standalone users. We do not knowingly collect personal information directly from children in violation of law.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">14. Changes to This Policy</h2>
              <p>We may update this Privacy Policy periodically. We will post the revised version with a new effective date and provide additional notice where required.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">15. Contact Us</h2>
              <p>For privacy questions or rights requests:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Email: <a href="mailto:privacy@docassistai.com" className="text-teal-400 hover:text-teal-300">privacy@docassistai.com</a></li>
              </ul>
              <p className="mt-2">For HIPAA/privacy incidents, follow your contractual incident reporting path in addition to this contact.</p>
            </div>
          </section>
        </article>

        <div className="mt-12 pt-8 border-t border-slate-800 flex items-center justify-between text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} DocAssistAI. All rights reserved.</p>
          <Link to="/terms" className="text-teal-400 hover:text-teal-300 transition-colors">
            &larr; Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
};
