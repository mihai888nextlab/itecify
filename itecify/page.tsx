'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/auth/login');
    }
  }, [router]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#09090C',
      color: '#E8E8F0',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 48,
          fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          marginBottom: 16,
        }}>
          iTEC<span style={{ color: '#00E5CC' }}>ify</span>
        </div>
        <div style={{ color: '#4A4A60' }}>Loading...</div>
      </div>
    </div>
  );
}
