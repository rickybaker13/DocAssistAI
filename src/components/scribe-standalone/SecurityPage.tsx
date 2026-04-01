import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  Shield,
  Lock,
  ShieldOff,
  Database,
  Radio,
  UserCheck,
  Mic,
  FileText,
  Sparkles,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  Eye,
  Server,
  HardDrive,
  Brain,
} from 'lucide-react';
import SegmentNav from './landing/SegmentNav';
import SegmentFooter from './landing/SegmentFooter';

/* ─── Animation helpers ─── */
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ─── Flow steps for the PII diagram ─── */
const flowSteps = [
  {
    icon: Mic,
    label: 'Audio Recording',
    detail: 'Clinician records the patient encounter on their device.',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
  },
  {
    icon: Radio,
    label: 'Encrypted Transit (TLS)',
    detail: 'Audio is encrypted end-to-end via TLS through Caddy reverse proxy.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: FileText,
    label: 'Transcription',
    detail: 'Audio is transcribed to text on our secure server. Audio is not persisted.',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
  },
  {
    icon: Shield,
    label: 'Presidio De-identification',
    detail:
      'Microsoft Presidio identifies and replaces all PII/PHI with typed tokens: [PERSON_0], [DATE_0], [MEDICAL_RECORD_NUMBER_0], etc.',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    highlight: true,
  },
  {
    icon: Sparkles,
    label: 'AI Note Generation',
    detail:
      'Only de-identified text reaches the AI model. The AI generates a structured clinical note using tokens — it never sees real patient data.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: Shield,
    label: 'Presidio Re-injection',
    detail:
      'Presidio replaces tokens with original PHI values using a request-scoped substitution map. The map is never persisted or logged.',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    highlight: true,
  },
  {
    icon: Radio,
    label: 'Encrypted Response (TLS)',
    detail: 'The complete note with restored PHI is encrypted and sent back to the clinician.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: UserCheck,
    label: 'Clinician Review',
    detail:
      'The clinician reviews, edits, and finalizes the note before it is used for any clinical purpose.',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
  },
];

/* ─── Security commitments ─── */
const commitments = [
  {
    icon: Shield,
    title: 'Patient data is de-identified before it ever reaches the AI',
    detail:
      'Microsoft Presidio analyzes every text field for 20+ entity types: names, dates, MRNs, phone numbers, addresses, and more. Each detected entity is replaced with a typed placeholder token before the text is sent to the AI model.',
  },
  {
    icon: ShieldOff,
    title: 'If de-identification is unavailable, the system stops',
    detail:
      'DocAssistAI operates on a fail-closed principle. If the Presidio service is unreachable or returns an error, the system returns a 503 error to the client. The AI is never called without de-identification.',
  },
  {
    icon: Database,
    title: 'Substitution maps are request-scoped, never persisted, never logged',
    detail:
      'The mapping between tokens ([PERSON_0]) and real values exists only in server memory for the duration of a single request. It is garbage-collected immediately after the response is sent. No log file, database, or cache ever contains this mapping.',
  },
  {
    icon: Radio,
    title: 'All traffic encrypted via TLS',
    detail:
      'Caddy reverse proxy handles TLS termination with automatic certificate management. Audio uploads, API requests, and responses are encrypted in transit. Internal service communication runs over Docker\u2019s isolated network.',
  },
  {
    icon: Lock,
    title: 'HIPAA-compliant architecture',
    detail:
      'DocAssistAI is designed to meet the HIPAA Security Rule requirements for access controls, audit controls, transmission security, and integrity controls. Business Associate Agreements (BAAs) are available.',
  },
  {
    icon: UserCheck,
    title: 'Clinician reviews every note before it is finalized',
    detail:
      'AI output is always a draft. The clinician must review, edit if needed, and approve the note before it can be used. DocAssistAI is a clinical support tool, not an autonomous documentation system.',
  },
];

/* ─── FAQ data ─── */
const faqItems = [
  {
    q: 'Can the AI see my patients\u2019 names or medical record numbers?',
    a: 'No. Before any text reaches the AI, our de-identification software (Microsoft Presidio) automatically finds and replaces patient names, dates of birth, MRNs, Social Security numbers, phone numbers, addresses, and 20+ other identifier types with generic placeholders like [PERSON_0]. The AI only ever sees these placeholders \u2014 never the real data.',
  },
  {
    q: 'What happens if the de-identification system goes down?',
    a: 'DocAssistAI stops working entirely. This is by design. We use what\u2019s called a \u201cfail-closed\u201d architecture: if the de-identification service is unavailable for any reason, the system returns an error and the AI is never called. There is no way to bypass this protection, even temporarily.',
  },
  {
    q: 'Is DocAssistAI HIPAA compliant?',
    a: 'DocAssistAI is designed to meet HIPAA Security Rule requirements including access controls, audit controls, transmission security, and integrity controls. We offer Business Associate Agreements (BAAs) for organizations that require them. Our transcription provider (Groq) also has a BAA in effect. Because we de-identify all data before it reaches the AI, the AI provider (Anthropic) never receives protected health information.',
  },
  {
    q: 'Do you store audio recordings of patient encounters?',
    a: 'No. Audio is streamed to our transcription service, converted to text in memory, and immediately discarded. There is no audio archive on our servers. We could not replay a recording even if asked to, because the audio file no longer exists after transcription.',
  },
  {
    q: 'Is patient data used to train AI models?',
    a: 'No. We use Anthropic\u2019s Claude API, which has a zero-retention policy for API calls. Your transcripts, notes, and clinical content are not stored by the AI provider and are never used to train, fine-tune, or improve any AI model.',
  },
  {
    q: 'Can I use this with residents and medical students?',
    a: 'Yes. DocAssistAI works on any device with a web browser \u2014 no installation or IT department involvement required. Each user has their own account with their own credentials. The privacy protections apply equally to every user regardless of role or training level.',
  },
  {
    q: 'Does this integrate with our EHR (Epic, Cerner, etc.)?',
    a: 'DocAssistAI works with any EHR through copy-and-paste. The clinician generates and reviews a note in DocAssistAI, then copies it into their EHR. This means no IT integration is required \u2014 no Epic module, no Cerner plugin, no firewall changes, no IT tickets. Clinicians can start using it today.',
  },
  {
    q: 'What does a Business Associate Agreement (BAA) cover?',
    a: 'A BAA is a contract required by HIPAA when a third party handles protected health information (PHI) on behalf of a covered entity. Our BAA covers the limited PHI that passes through our system during processing (audio in transit, text in memory during de-identification). We are happy to provide a BAA to any organization that requires one \u2014 contact admin@docassistai.app.',
  },
  {
    q: 'How is this different from other AI scribes when it comes to privacy?',
    a: 'Most AI scribes send the full, unredacted transcript \u2014 including patient names, dates, and medical record numbers \u2014 directly to an AI model. DocAssistAI is different: we de-identify everything first. The AI never sees real patient data. Additionally, if our de-identification system is unavailable, the entire product stops rather than proceeding without protection. This \u201cfail-closed\u201d approach is uncommon in the industry.',
  },
  {
    q: 'Who built this?',
    a: 'DocAssistAI was built by clinicians who understand the documentation burden firsthand and who take patient privacy personally. We are not a large enterprise vendor \u2014 we are a focused team building the tool we wish existed during our own clinical training.',
  },
];

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqItems.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-800/30 transition-colors"
            >
              <span className="text-slate-100 font-medium text-sm sm:text-base leading-snug">{item.q}</span>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-teal-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 flex-shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-6 pb-5">
                <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <SegmentNav active="/security" />

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-slate-950 px-4 pt-24 pb-16 sm:pt-32 sm:pb-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06)_0%,transparent_70%)]" />
          <motion.div
            className="relative z-10 mx-auto max-w-3xl text-center"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          >
            <motion.div variants={fadeIn}>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-300 mb-6">
                <Shield className="w-3.5 h-3.5" />
                Security & Privacy
              </span>
            </motion.div>

            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-50 tracking-tight leading-tight"
              variants={fadeIn}
            >
              Your Patients' Data Never Reaches the AI
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed"
              variants={fadeIn}
            >
              Built by clinicians who take patient privacy personally. DocAssistAI de-identifies all patient data &mdash; from recordings and pasted chart data alike &mdash; before sending anything to the AI model.
              If de-identification fails, the system stops. It never proceeds unprotected.
            </motion.p>
          </motion.div>
        </section>

        {/* ─── Plain-English Summary (for non-technical decision-makers) ─── */}
        <section className="bg-slate-950 py-20 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-300 mb-6">
                <Building2 className="w-3.5 h-3.5" />
                For Program Directors &amp; Administrators
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
                The Short Version
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                No jargon. Here is exactly what happens to patient data when a clinician uses DocAssistAI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-teal-400/20 bg-slate-900 p-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-400/10 mb-4">
                  <Shield className="w-7 h-7 text-teal-400" />
                </div>
                <h3 className="text-slate-50 font-bold text-lg mb-3">Names, dates, and IDs are stripped out before the AI sees anything</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  When a clinician records an encounter, software on our server automatically finds every patient name, date of birth, medical record number, and other identifying information. It replaces them with generic placeholders like [PERSON_0] before the text is ever sent to the AI.
                </p>
              </div>

              <div className="rounded-2xl border border-teal-400/20 bg-slate-900 p-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-400/10 mb-4">
                  <ShieldOff className="w-7 h-7 text-teal-400" />
                </div>
                <h3 className="text-slate-50 font-bold text-lg mb-3">If the protection system is down, the entire product stops</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  There is no override. There is no &ldquo;skip for now.&rdquo; If the de-identification service is unavailable for any reason, DocAssistAI will not generate a note. It returns an error instead. Patient data is never sent unprotected.
                </p>
              </div>

              <div className="rounded-2xl border border-teal-400/20 bg-slate-900 p-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-teal-400/10 mb-4">
                  <UserCheck className="w-7 h-7 text-teal-400" />
                </div>
                <h3 className="text-slate-50 font-bold text-lg mb-3">Clinicians review every note before it is used</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  DocAssistAI generates a draft. The clinician reads it, makes any corrections, and decides whether to use it. Nothing is auto-submitted to any EHR or chart. The clinician is always the final decision-maker.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ─── PII Flow Diagram ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 text-center mb-4">
              How Your Data Flows
            </h2>
            <p className="text-slate-400 text-lg text-center max-w-2xl mx-auto mb-14">
              Every step from recording to final note, with de-identification at the center.
            </p>

            <div className="space-y-0">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === flowSteps.length - 1;
                return (
                  <div key={step.label + index}>
                    <motion.div
                      className={`flex items-start gap-4 rounded-xl border p-5 ${
                        step.highlight
                          ? 'border-teal-400/30 bg-teal-400/5'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.06 }}
                    >
                      <div
                        className={`flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg ${step.bg}`}
                      >
                        <Icon className={`w-5 h-5 ${step.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <h3 className="text-slate-50 font-semibold">{step.label}</h3>
                        </div>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    </motion.div>

                    {/* Arrow connector */}
                    {!isLast && (
                      <div className="flex justify-center py-1.5">
                        <ArrowDown className="w-4 h-4 text-slate-700" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ─── Example: Before and After De-identification ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 text-center mb-4">
              What the AI Actually Sees
            </h2>
            <p className="text-slate-400 text-lg text-center max-w-2xl mx-auto mb-12">
              Patient data is replaced with typed tokens before the AI processes anything.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before */}
              <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-red-400 font-semibold">Original Transcript</h3>
                </div>
                <p className="font-mono text-sm text-slate-300 leading-relaxed">
                  &ldquo;
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">John Smith</span>
                  {' '}is a{' '}
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">67-year-old</span>
                  {' '}male presenting on{' '}
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">March 10, 2026</span>
                  {' '}with chest pain. MRN{' '}
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">4829103</span>.
                  Patient reports pain started two days ago.&rdquo;
                </p>
              </div>

              {/* After */}
              <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  <h3 className="text-teal-400 font-semibold">What the AI Receives</h3>
                </div>
                <p className="font-mono text-sm text-slate-300 leading-relaxed">
                  &ldquo;
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[PERSON_0]</span>
                  {' '}is a{' '}
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[AGE_0]</span>
                  {' '}male presenting on{' '}
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[DATE_TIME_0]</span>
                  {' '}with chest pain. MRN{' '}
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[MEDICAL_RECORD_NUMBER_0]</span>.
                  Patient reports pain started two days ago.&rdquo;
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500 text-center mt-6">
              After the AI generates the note, tokens are replaced with the original values before the clinician sees the result.
              The mapping exists only in memory for the duration of the request.
            </p>
          </motion.div>
        </section>

        {/* ─── Security Commitments ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
                Our Security Commitments
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Each claim has technical backing in our architecture. This is how we built DocAssistAI.
              </p>
            </motion.div>

            <div className="space-y-6">
              {commitments.map((commitment, index) => {
                const Icon = commitment.icon;
                return (
                  <motion.div
                    key={commitment.title}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-teal-400/10 mt-0.5">
                        <Icon className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-slate-50 font-semibold text-lg">
                          {commitment.title}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed mt-2">
                          {commitment.detail}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── What We Don't Do ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
                What We Don&rsquo;t Do
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Sometimes what a company chooses not to do matters more than what it does.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                {
                  icon: XCircle,
                  title: 'We don\u2019t store patient data',
                  detail: 'No patient names, MRNs, dates of birth, or clinical content is written to any database, log file, or cache. Audio recordings are transcribed in memory and immediately discarded.',
                },
                {
                  icon: Eye,
                  title: 'We don\u2019t sell or share data with third parties',
                  detail: 'Your patients\u2019 information is not monetized, aggregated, or shared with advertisers, data brokers, research firms, or anyone else. Period.',
                },
                {
                  icon: Brain,
                  title: 'We don\u2019t train AI models on your notes',
                  detail: 'The AI models we use (Anthropic Claude) have a zero-retention policy for API calls. Your transcripts and notes are not used to train, fine-tune, or improve any AI model.',
                },
                {
                  icon: HardDrive,
                  title: 'We don\u2019t keep audio recordings',
                  detail: 'Audio is streamed to our transcription service, converted to text, and discarded. There is no audio archive. We cannot replay your encounters because the files do not exist.',
                },
                {
                  icon: Server,
                  title: 'We don\u2019t run on shared cloud AI platforms',
                  detail: 'Our de-identification engine (Microsoft Presidio) runs on our own private server, not on a shared cloud service. Patient data never passes through a multi-tenant environment.',
                },
                {
                  icon: Database,
                  title: 'We don\u2019t have a \u201cskip\u201d button for privacy',
                  detail: 'De-identification is not optional. It is not a setting that can be toggled off. Every request goes through the same protection pipeline, every time, with no exceptions.',
                },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    className="flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                  >
                    <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-400/10 mt-0.5">
                      <Icon className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-slate-50 font-semibold">{item.title}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed mt-1">{item.detail}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ─── Compliance Summary (for compliance officers) ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
                Compliance at a Glance
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                A summary you can share with your compliance office or IT security team.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Requirement</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">How DocAssistAI Meets It</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {[
                      ['PHI De-identification', 'Microsoft Presidio strips 20+ entity types (names, DOB, MRN, SSN, phone, address, etc.) before AI processing'],
                      ['Encryption in Transit', 'TLS 1.2+ via Caddy reverse proxy with automatic certificate renewal. All API calls encrypted.'],
                      ['Encryption at Rest', 'No PHI is stored at rest. Transcripts exist only in server memory during processing.'],
                      ['Access Controls', 'JWT-based authentication with secure httpOnly cookies. Session expiry enforced.'],
                      ['Audit Controls', 'Server-side audit logging of all API requests. No PHI in logs.'],
                      ['Fail-Closed Design', 'If Presidio is unreachable, the system returns 503. AI is never called without de-identification.'],
                      ['Business Associate Agreements', 'BAAs available on request. Groq (transcription provider) BAA is in effect by default.'],
                      ['AI Data Retention', 'Anthropic Claude API has a zero-retention policy. No data is used for model training.'],
                      ['Audio Retention', 'Audio is transcribed in memory and immediately discarded. No audio files are stored.'],
                      ['Clinician Oversight', 'All AI output is a draft requiring clinician review before use. No auto-submission to EHRs.'],
                    ].map(([req, detail]) => (
                      <tr key={req}>
                        <td className="px-6 py-4 text-sm font-medium text-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                            {req}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Common questions from program directors, compliance officers, and clinicians.
              </p>
            </div>

            <FaqAccordion />
          </motion.div>
        </section>

        {/* ─── BAA & Contact ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto max-w-xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 sm:p-10">
              <Shield className="w-12 h-12 text-teal-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-50 mb-3">
                Need a BAA?
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Business Associate Agreements are available for organizations that require them.
                Contact us to discuss your compliance needs.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/scribe/register"
                  className="bg-teal-400 text-slate-900 rounded-xl px-8 py-3.5 text-base font-semibold hover:bg-teal-300 transition-colors shadow-lg shadow-teal-400/20"
                >
                  Start Free Trial
                </Link>
                <Link
                  to="/privacy"
                  className="border border-slate-600 text-slate-300 rounded-xl px-8 py-3.5 text-base font-medium hover:border-slate-400 hover:text-slate-100 transition-colors"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>

            <p className="mt-8 text-sm text-slate-500 italic">
              Doc Assist AI &mdash; built by clinicians, for clinicians.
            </p>
          </motion.div>
        </section>
      </main>

      <SegmentFooter />
    </div>
  );
}
