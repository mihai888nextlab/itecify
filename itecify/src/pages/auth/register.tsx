import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { theme as C } from '@/styles/theme';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function RegisterContent() {
  const router = useRouter();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      addToast('error', 'Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      addToast('error', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      addToast('success', 'Account created successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: C.bg }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-black tracking-tighter" style={{ color: C.text }}>
            iTEC<span style={{ color: C.blue }}>ify</span>
          </Link>
          <p className="mt-2" style={{ color: C.muted }}>Create your account</p>
        </div>

        <div className="p-8 rounded-xl" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: C.text }}>Name</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="Your name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: C.text }}>Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: C.text }}>Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>
              <p className="mt-1 text-xs" style={{ color: C.muted }}>Minimum 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: C.text }}>Confirm Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                  style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: C.muted }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: C.blue }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <ToastProvider>
      <RegisterContent />
    </ToastProvider>
  );
}
