'use client';

import styles from './page.module.css';

export default function JournalPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>📓</div>
        <h1 className={styles.heading}>Trading Journal</h1>
        <p className={styles.description}>
          Track and analyze your trades in the SOA Trading Journal. Review your
          entries, monitor your performance, and improve your trading strategy.
        </p>
        <a
          href="https://app.simplyoptionsacademy.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.openBtn}
        >
          Open Journal
          <span className={styles.openBtnIcon}>&#8599;</span>
        </a>
        <div className={styles.brandFooter}>
          Simply Options Academy
        </div>
      </div>
    </div>
  );
}
