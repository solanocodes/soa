import type { Metadata } from 'next';
import '@/styles/globals.css';
import styles from './layout.module.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'SOA — Simply Options Academy',
  description: 'Trading education platform by Simply Options Academy',
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <main className={styles.main}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
