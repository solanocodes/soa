'use client';

import AuthLayout from '@/components/layout/AuthLayout';

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
