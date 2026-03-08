import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const ScribeTermsPage: React.FC = () => {
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
          <h1 className="text-3xl font-bold text-slate-50 mb-2">DocAssistAI Terms of Service</h1>
          <p className="text-sm text-slate-500 mb-8">
            Effective date: March 3, 2026 &middot; Entity: DocAssistAI (&ldquo;DocAssistAI,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; &ldquo;our&rdquo;)
          </p>

          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">1. Agreement and Acceptance</h2>
              <p>
                These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the DocAssistAI platform, including web applications, APIs, integrations, and related services (collectively, the &ldquo;Services&rdquo;).
              </p>
              <p className="mt-2">
                By creating an account, executing an order form, or using the Services, you agree to be bound by these Terms. If you use the Services on behalf of an organization, you represent that you are authorized to bind that organization, and &ldquo;Customer&rdquo; means that organization.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">2. Intended Users and Non-Emergency Use</h2>
              <p>DocAssistAI is designed for healthcare workflows and authorized support personnel.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>The Services are <strong className="text-slate-100">not</strong> an emergency service.</li>
                <li>Do not use the Services to seek or deliver emergency care.</li>
                <li>If there is an emergency, call 911 or applicable emergency services immediately.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">3. Clinical Support Disclaimer</h2>
              <p>DocAssistAI may generate summaries, draft notes, coding suggestions, and other AI-assisted outputs. These outputs are support tools only.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Outputs may contain errors, omissions, or outdated information.</li>
                <li>You are solely responsible for clinical review, professional judgment, final documentation, coding, billing, and treatment decisions.</li>
                <li>You must independently verify material outputs before relying on them.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">4. HIPAA, PHI, and Business Associate Status</h2>
              <ol className="list-decimal pl-6 mt-2 space-y-2">
                <li><strong className="text-slate-100">BAA requirement:</strong> If Customer is a HIPAA covered entity or business associate and intends to disclose PHI to DocAssistAI, the parties must execute a Business Associate Agreement (&ldquo;BAA&rdquo;) before PHI disclosure through the Services.</li>
                <li><strong className="text-slate-100">No implied BAA:</strong> No provision in these Terms creates a BAA by implication.</li>
                <li><strong className="text-slate-100">Scope controls:</strong> If a BAA is in effect, PHI handling is governed by the BAA and applicable law; if there is a conflict, the BAA controls for PHI matters.</li>
                <li><strong className="text-slate-100">Customer responsibilities:</strong> Customer represents it has legal authority to disclose data to DocAssistAI and to direct processing.</li>
              </ol>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">5. Eligibility, Accounts, and Authorized Users</h2>
              <p>Customer is responsible for:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>maintaining accurate account information,</li>
                <li>safeguarding credentials,</li>
                <li>restricting access to authorized users,</li>
                <li>promptly disabling access for departed users, and</li>
                <li>all activity under Customer accounts (except where caused solely by DocAssistAI breach of these Terms).</li>
              </ul>
              <p className="mt-2">You must promptly notify us of suspected unauthorized account access.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">6. Acceptable Use and Prohibited Conduct</h2>
              <p>You will not (and will not permit others to):</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>use the Services in violation of law, regulation, or professional obligations;</li>
                <li>upload data you are not authorized to process or disclose;</li>
                <li>attempt to reverse engineer, copy, or derive source code from the Services except as expressly permitted by law;</li>
                <li>interfere with service integrity, availability, or security;</li>
                <li>test vulnerabilities without written authorization;</li>
                <li>use the Services to develop or benchmark a competing service without written consent;</li>
                <li>use outputs as the sole basis for clinical or patient-safety critical decisions.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">7. Data Processing and Security Commitments</h2>
              <p>DocAssistAI implements and maintains reasonable and appropriate administrative, physical, and technical safeguards designed to protect data in our custody. These may include, as appropriate:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>access controls and authentication controls,</li>
                <li>encryption in transit and at rest (where technically supported),</li>
                <li>logging and audit controls,</li>
                <li>environment segregation,</li>
                <li>vendor/subprocessor oversight,</li>
                <li>incident response procedures.</li>
              </ul>
              <p className="mt-2">No method of transmission or storage is 100% secure; we do not guarantee absolute security.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">8. Incident and Breach Cooperation</h2>
              <p>If we confirm a security incident involving Customer data, we will notify Customer as required by applicable law and/or contract (including any BAA), and cooperate reasonably with Customer&rsquo;s response obligations.</p>
              <p className="mt-2">Customer remains responsible for its own regulatory, legal, and communication obligations unless otherwise expressly agreed in writing.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">9. Customer Data, Ownership, and License</h2>
              <ul className="list-disc pl-6 mt-2 space-y-2">
                <li><strong className="text-slate-100">Customer ownership:</strong> As between the parties, Customer retains ownership of Customer Data.</li>
                <li><strong className="text-slate-100">Service license:</strong> Customer grants DocAssistAI a limited, non-exclusive right to process Customer Data solely to provide, secure, maintain, and improve the Services as permitted by law and contract.</li>
                <li><strong className="text-slate-100">De-identified/aggregated data:</strong> DocAssistAI may use de-identified and/or aggregated data that cannot reasonably identify individuals to operate, secure, benchmark, and improve Services, subject to applicable law and contractual restrictions.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">10. AI Features and Model Providers</h2>
              <p>Certain features may rely on third-party AI or infrastructure providers. DocAssistAI may route requests through subprocessors necessary to provide features selected by Customer.</p>
              <p className="mt-2">DocAssistAI will maintain a process to evaluate providers for security and contractual compliance, but model behavior and uptime may vary by provider.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">11. Fees and Payment</h2>
              <p>If Services are paid, fees, billing cycles, taxes, and payment terms are set in an order form or plan terms.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Fees are non-refundable unless required by law or expressly stated otherwise.</li>
                <li>Late payments may accrue permitted charges and may result in suspension after notice.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">12. Confidentiality</h2>
              <p>Each party may receive non-public information from the other (&ldquo;Confidential Information&rdquo;). The receiving party will:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>use Confidential Information only to perform under these Terms,</li>
                <li>protect it with reasonable care (at least the same care used for its own similar information), and</li>
                <li>not disclose it except to personnel/contractors with a need to know and confidentiality obligations.</li>
              </ul>
              <p className="mt-2">Confidentiality obligations do not apply to information that is public through no fault of the receiver, independently developed, already known without restriction, or lawfully received from a third party.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">13. Intellectual Property</h2>
              <p>DocAssistAI and its licensors retain all rights, title, and interest in the Services, software, models, interfaces, and documentation, excluding Customer Data.</p>
              <p className="mt-2">No rights are granted except those expressly stated.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">14. Warranties and Disclaimers</h2>
              <p>DocAssistAI warrants that it will provide Services in a commercially reasonable manner.</p>
              <p className="mt-2">Except as expressly stated, Services are provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the maximum extent permitted by law, DocAssistAI disclaims all implied warranties, including merchantability, fitness for a particular purpose, title, and non-infringement.</p>
              <p className="mt-2">We do not warrant that outputs will be error-free, complete, medically or legally sufficient, or suitable for any particular reimbursement or compliance objective.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">15. Indemnification</h2>
              <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">15.1 By Customer</h3>
              <p>Customer will defend and indemnify DocAssistAI and its affiliates against third-party claims arising from Customer&rsquo;s unlawful data submission or use of Services, violation of these Terms, or negligence, misconduct, or violation of professional obligations.</p>
              <h3 className="text-base font-medium text-slate-200 mt-4 mb-2">15.2 By DocAssistAI</h3>
              <p>DocAssistAI will defend and indemnify Customer against third-party claims alleging the core Services infringe valid U.S. intellectual property rights, excluding claims arising from Customer data, Customer modifications, or combination with non-DocAssistAI systems not provided by DocAssistAI.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">16. Limitation of Liability</h2>
              <p>To the fullest extent permitted by law:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>neither party is liable for indirect, incidental, special, consequential, punitive, or exemplary damages, or lost profits/revenues/data/goodwill;</li>
                <li>each party&rsquo;s aggregate liability under these Terms is limited to amounts paid (or payable) by Customer to DocAssistAI for the Services in the 12 months preceding the event giving rise to liability.</li>
              </ul>
              <p className="mt-2">The limitations above do not apply to liabilities that cannot be limited by law, or to each party&rsquo;s confidentiality breaches, indemnification obligations, fraud, or willful misconduct.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">17. Term, Suspension, and Termination</h2>
              <p>These Terms begin on first acceptance and continue until terminated.</p>
              <p className="mt-2">DocAssistAI may suspend access if necessary to address security risk, prevent legal/regulatory harm, investigate suspected misuse, or enforce payment obligations.</p>
              <p className="mt-2">Either party may terminate for material breach not cured within 30 days of notice (or shorter period if required by law or imminent harm).</p>
              <p className="mt-2">Upon termination: rights to access Services end, Customer must cease use, each party will return/delete Confidential Information as required, and data export/deletion will be handled per agreement and law.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">18. Changes to Services or Terms</h2>
              <p>We may update Services and these Terms from time to time. For material changes, we will provide reasonable notice (e.g., in-app or by email). Continued use after effective date constitutes acceptance.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">19. Export, Sanctions, and Compliance</h2>
              <p>Customer will comply with applicable export control, sanctions, anti-corruption, healthcare, and privacy laws in connection with use of the Services.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">20. Governing Law; Venue</h2>
              <p>Unless otherwise set in an executed order form, these Terms are governed by the laws of the State of Delaware, without regard to conflicts principles. Exclusive venue is state or federal courts located in Delaware.</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">21. Miscellaneous</h2>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Entire agreement (plus incorporated order forms/BAA/DPA if any).</li>
                <li>No waiver except in writing.</li>
                <li>Severability applies to invalid provisions.</li>
                <li>Assignment requires consent, except in connection with merger/reorganization/sale of substantially all assets.</li>
                <li>Force majeure excuses delays caused by events beyond reasonable control.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-100 mt-8 mb-3">22. Contact</h2>
              <p>For legal notices and terms questions:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Email: <a href="mailto:admin@docassistai.app" className="text-teal-400 hover:text-teal-300">admin@docassistai.app</a></li>
              </ul>
            </div>
          </section>
        </article>

        <div className="mt-12 pt-8 border-t border-slate-800 flex items-center justify-between text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} DocAssistAI. All rights reserved.</p>
          <Link to="/privacy" className="text-teal-400 hover:text-teal-300 transition-colors">
            Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};
