'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import styles from './page.module.css';

export default function WelcomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/community/welcome');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const displayName = user?.display_name || user?.username || '';

  return (
    <div className={styles.container}>
      <div className={styles.logo}>SOA</div>
      <div className={styles.subtitle}>Welcome to Simply Options Academy</div>
      {displayName && (
        <div className={styles.greeting}>Welcome, {displayName}!</div>
      )}
      <div className={styles.line} />
      <div className={styles.pulse} />
    </div>
  );
}
