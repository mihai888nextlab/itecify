import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { ToastProvider, useToast } from '@/components/ui/Toast';

function CallbackContent() {
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    const { token, name, error } = router.query;

    if (error) {
      addToast('error', 'OAuth failed: ' + error);
      router.replace('/auth/login');
      return;
    }

    if (token && typeof token === 'string') {
      localStorage.setItem('accessToken', token);
      
      if (name) {
        localStorage.setItem('user', JSON.stringify({ 
          name: decodeURIComponent(name as string) 
        }));
      }
      
      addToast('success', 'Welcome!');
      router.replace('/dashboard');
    } else {
      addToast('error', 'No token received');
      router.replace('/auth/login');
    }
  }, [router.query]);

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <ToastProvider>
      <CallbackContent />
    </ToastProvider>
  );
}
