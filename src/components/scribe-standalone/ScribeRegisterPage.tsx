import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Sparkles } from 'lucide-react';
import { DISCIPLINE_OPTIONS } from '../../lib/disciplines';
import { SocialMediaLinks } from './SocialMediaLinks';

type PaymentMethod = 'square_card' | 'square_ach' | 'square_apple_pay' | 'square_google_pay';

export const ScribeRegisterPage: React.FC = () => {
  const { register, loading, error, user } = useScribeAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    specialty: '',
    paymentMethod: 'square_card' as PaymentMethod,
    cardholderName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    phone: '',
    agreedToAutoRenewal: false,
  });
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => { if (user) navigate('/scribe/dashboard'); }, [user, navigate]);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = field === 'agreedToAutoRenewal' && e.target instanceof HTMLInputElement
      ? e.target.checked
      : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatCardExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }));
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, cardExpiry: formatCardExpiry(e.target.value) }));
  };

  const handleCardCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, cardCvc: e.target.value.replace(/\D/g, '').slice(0, 4) }));
  };

  const isBillingFormValid = () => {
    if (form.paymentMethod !== 'square_card' && !form.phone.trim()) {
      return 'Phone number is required for this payment method.';
    }

    if (form.paymentMethod === 'square_card') {
      const cardNumberDigits = form.cardNumber.replace(/\s/g, '');
      const [month = '', year = ''] = form.cardExpiry.split('/');
      const monthNumber = Number(month);

      if (!form.cardholderName.trim()) return 'Cardholder name is required for the trial.';
      if (cardNumberDigits.length !== 16) return 'Enter a valid 16-digit card number.';
      if (!/^\d{2}\/\d{2}$/.test(form.cardExpiry)) return 'Enter expiry in MM/YY format.';
      if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return 'Enter a valid expiry month.';
      if (year.length !== 2) return 'Enter a valid expiry year.';
      if (form.cardCvc.length < 3) return 'Enter a valid CVC.';
    }

    if (!form.agreedToAutoRenewal) return 'You must agree to auto-renewal terms to start the trial.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const billingValidationError = isBillingFormValid();
    if (billingValidationError) {
      setBillingError(billingValidationError);
      return;
    }
    setBillingError(null);
    const ok = await register(form.email, form.password, form.name, form.specialty);
    if (ok) navigate('/scribe/account');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400 rounded-2xl mb-4">
            <Sparkles size={28} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">DocAssist Scribe</h1>
          <p className="text-sm text-slate-400 mt-1">Clinical documentation, simplified</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          <div className="mb-5 rounded-xl border border-teal-400/30 bg-teal-400/10 p-4">
            <div className="mb-3 inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <img src="/square-wordmark.svg" alt="Square" className="h-6 w-auto" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Limited-time offer</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Start your free 7-day trial</h2>
            <p className="mt-1 text-sm text-slate-300">
              Enter your email and payment details to begin. Cancel anytime within 7 days and you will not be charged.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Name (optional)</label>
              <input
                id="name" type="text" value={form.name} onChange={setField('name')}
                placeholder="Dr. Jane Smith"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <input
                id="reg-email" type="email" required value={form.email} onChange={setField('email')}
                placeholder="you@hospital.org"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input
                id="reg-password" type="password" required minLength={8} value={form.password} onChange={setField('password')}
                placeholder="At least 8 characters"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="specialty" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Specialty (optional)</label>
              <select
                id="specialty" value={form.specialty} onChange={setField('specialty')}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              >
                <option value="">Select specialty...</option>
                {DISCIPLINE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-100">Billing details for trial activation</h3>
              <div>
                <label htmlFor="payment-method" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Payment method</label>
                <select
                  id="payment-method"
                  value={form.paymentMethod}
                  onChange={setField('paymentMethod')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                >
                  <option value="square_card">Credit Card (Square)</option>
                  <option value="square_ach">Bank account (ACH via Square)</option>
                  <option value="square_apple_pay">Apple Pay (Square)</option>
                  <option value="square_google_pay">Google Pay (Square)</option>
                </select>
              </div>

              {form.paymentMethod === 'square_card' ? (
                <>
                  <div>
                    <label htmlFor="cardholder-name" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Cardholder name</label>
                    <input
                      id="cardholder-name" type="text" required value={form.cardholderName} onChange={setField('cardholderName')}
                      placeholder="Jane Smith"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-number" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Card number</label>
                    <input
                      id="card-number" type="text" inputMode="numeric" required value={form.cardNumber} onChange={handleCardNumberChange}
                      placeholder="1234 5678 9012 3456"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="card-expiry" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Expiry (MM/YY)</label>
                      <input
                        id="card-expiry" type="text" inputMode="numeric" required value={form.cardExpiry} onChange={handleCardExpiryChange}
                        placeholder="08/29"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="card-cvc" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">CVC</label>
                      <input
                        id="card-cvc" type="text" inputMode="numeric" required value={form.cardCvc} onChange={handleCardCvcChange}
                        placeholder="123"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="billing-phone" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">SMS phone number</label>
                    <input
                      id="billing-phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={setField('phone')}
                      placeholder="+14155551234"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <input
                type="checkbox"
                checked={form.agreedToAutoRenewal}
                onChange={setField('agreedToAutoRenewal')}
                className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-teal-400 focus:ring-teal-400"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I agree that my subscription starts with a free 7-day trial and will automatically renew unless I cancel before trial end.
              </span>
            </label>
            <p className="text-xs text-slate-500 -mt-1">
              Demo onboarding only: payment details are used to validate this form and are not stored by DocAssist Scribe in this environment.
            </p>
            {billingError && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{billingError}</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
            )}
            <button
              type="submit" disabled={loading} aria-busy={loading}
              className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account...' : 'Start free trial'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/scribe/login" className="text-teal-400 hover:text-teal-300 transition-colors">
            Sign in
          </Link>
        </p>

        <SocialMediaLinks />
      </div>
    </div>
  );
};
