import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function WorkspaceIndex() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/dashboard');
  }, [router]);
  
  return (
    <div className="h-screen flex items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">Redirecting...</p>
      </div>
    </div>
  );
}
