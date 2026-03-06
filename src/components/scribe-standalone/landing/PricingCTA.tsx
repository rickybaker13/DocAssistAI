import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const checklist = [
  "Full access to all features",
  "Cancel anytime within 7 days",
  "No credit card required to start",
  "Payments secured by Square",
];

const paymentMethods = ["Credit Card", "ACH Bank", "Apple Pay", "Google Pay"];

export default function PricingCTA() {
  return (
    <section id="pricing" className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-xl"
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 sm:p-10 text-center">
          {/* Headline */}
          <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Start Your Free 7-Day Trial
          </h2>

          {/* Subtext */}
          <p className="mt-3 text-slate-400">
            $20/month after trial &middot; Cancel anytime
          </p>

          {/* Checklist */}
          <ul className="mt-8 space-y-3 text-left">
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-50">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-teal-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* CTA Button */}
          <div className="mt-8 flex justify-center">
            <Link
              to="/scribe/register"
              className="block w-full max-w-sm rounded-xl bg-teal-400 px-6 py-3.5 text-center text-lg font-semibold text-slate-900 shadow-lg shadow-teal-400/20 transition-colors hover:bg-teal-300"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Payment Method Badges */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
            {paymentMethods.map((method) => (
              <span
                key={method}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1"
              >
                {method}
              </span>
            ))}
          </div>

          {/* Sign-in Link */}
          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/scribe/login"
              className="text-teal-400 hover:text-teal-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </section>
  );
}
