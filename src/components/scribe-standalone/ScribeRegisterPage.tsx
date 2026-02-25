import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Sparkles } from 'lucide-react';

const SPECIALTIES = [
  'Critical Care / Intensivist', 'Hospital Medicine', 'Internal Medicine',
  'Emergency Medicine', 'Neurology', 'Surgery', 'Cardiology',
  'Physical Therapy', 'Occupational Therapy', 'Other',
];

export const ScribeRegisterPage: React.FC = () => {
  const { register, loading, error, user } = useScribeAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', specialty: '' });

  useEffect(() => { if (user) navigate("/scribe/dashboard"); }, [user, navigate]);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await register(form.email, form.password, form.name, form.specialty);
    if (ok) navigate('/scribe/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400 rounded-2xl mb-4">
            <Sparkles size={28} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">DocAssist Scribe</h1>
          <p className="text-sm text-slate-400 mt-1">Clinical documentation, simplified</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
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
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
            )}
            <button
              type="submit" disabled={loading} aria-busy={loading}
              className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/scribe/login" className="text-teal-400 hover:text-teal-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
