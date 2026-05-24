'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { hasAccess, TIER_COLORS, TIER_LABELS } from '@/lib/utils';
import styles from './page.module.css';

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  required_tier: string;
  lessons_count: number;
  created_at: string;
}

export default function LearnPage() {
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/courses')
      .then(({ data }) => {
        setCourses(data.courses ?? data ?? []);
      })
      .catch(() => setError('Failed to load courses'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Loading courses...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Courses</h1>
        </div>
        <div className={styles.centerState}>
          <div className={styles.emptyIcon}>🎓</div>
          <span>Courses coming soon</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Courses</h1>
      </div>

      <div className={styles.grid}>
        {courses.map((course) => {
          const locked = !hasAccess(user?.tier || 'FREE', course.required_tier);
          const tierColor = TIER_COLORS[course.required_tier] || TIER_COLORS.FREE;
          const tierLabel = TIER_LABELS[course.required_tier] || course.required_tier;

          return (
            <div key={course.id} className={styles.card}>
              {locked && (
                <div className={styles.lockedOverlay}>
                  <span className={styles.lockIcon}>🔒</span>
                  <span className={styles.lockText}>Upgrade to unlock</span>
                </div>
              )}

              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className={styles.thumbnailImg}
                />
              ) : (
                <div className={styles.thumbnail}>🎓</div>
              )}

              <div className={styles.cardBody}>
                <div className={styles.cardTitle}>{course.title}</div>
                {course.description && (
                  <p className={styles.cardDesc}>{course.description}</p>
                )}
                <span
                  className={styles.tierBadge}
                  style={{
                    color: tierColor,
                    background: `${tierColor}1a`,
                  }}
                >
                  {tierLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
