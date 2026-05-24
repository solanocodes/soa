'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getRelativeTime } from '@/lib/utils';
import styles from './page.module.css';

interface StrategyAlert {
  id: string;
  content: string;
  ticker: string | null;
  direction: string | null;
  setup_type: string | null;
  created_at: string;
}

const SETUP_TYPES = [
  'All',
  'VWAP reclaim',
  'Orderblock',
  'Trend continuation',
  'ATH caution',
  'Reversal',
  'Morning range',
  'Key level test',
];

export default function StrategyPage() {
  const [searchTicker, setSearchTicker] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [setupFilter, setSetupFilter] = useState('All');
  const [results, setResults] = useState<StrategyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(
    async (ticker: string, setup: string, cursorVal?: string | null) => {
      let url = '/alerts?is_historical=true&limit=20';
      if (ticker) url += `&ticker=${encodeURIComponent(ticker.toUpperCase())}`;
      if (setup && setup !== 'All') url += `&setup_type=${encodeURIComponent(setup)}`;
      if (cursorVal) url += `&cursor=${cursorVal}`;
      const { data } = await api.get(url);
      const items: StrategyAlert[] = data.alerts ?? data;
      return {
        items,
        nextCursor:
          data.next_cursor ??
          (items.length >= 20 ? items[items.length - 1]?.id : null),
        hasMore: !!data.next_cursor || items.length >= 20,
      };
    },
    []
  );

  // Fetch on filter change
  useEffect(() => {
    setLoading(true);
    setError(null);
    setResults([]);
    setCursor(null);
    setHasMore(true);

    fetchResults(activeSearch, setupFilter)
      .then(({ items, nextCursor, hasMore: more }) => {
        setResults(items);
        setCursor(nextCursor);
        setHasMore(more);
      })
      .catch(() => setError('Failed to load strategies'))
      .finally(() => setLoading(false));
  }, [activeSearch, setupFilter, fetchResults]);

  const handleSearch = () => {
    setActiveSearch(searchTicker.trim());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const { items, nextCursor, hasMore: more } = await fetchResults(
        activeSearch,
        setupFilter,
        cursor
      );
      setResults((prev) => [...prev, ...items]);
      setCursor(nextCursor);
      setHasMore(more);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Strategy Vault</h1>

      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by ticker (e.g. SPY, AAPL, TSLA)..."
          value={searchTicker}
          onChange={(e) => setSearchTicker(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <button className={styles.searchBtn} onClick={handleSearch}>
          Search
        </button>
      </div>

      <div className={styles.filters}>
        {SETUP_TYPES.map((type) => (
          <button
            key={type}
            className={`${styles.filterPill} ${
              setupFilter === type ? styles.filterActive : styles.filterInactive
            }`}
            onClick={() => setSetupFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Searching strategies...</span>
        </div>
      ) : error ? (
        <div className={styles.centerState}>
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      ) : results.length === 0 ? (
        <div className={styles.centerState}>
          <div className={styles.emptyIcon}>📈</div>
          <span>
            {activeSearch
              ? `No strategies found for "${activeSearch.toUpperCase()}"`
              : 'No strategies found. Try a different filter.'}
          </span>
        </div>
      ) : (
        <>
          <div className={styles.results}>
            {results.map((alert) => (
              <div key={alert.id} className={styles.resultCard}>
                <div className={styles.resultHeader}>
                  {alert.ticker && (
                    <span className={styles.tickerBadge}>{alert.ticker}</span>
                  )}
                  {alert.direction && (
                    <span
                      className={`${styles.directionBadge} ${
                        alert.direction.toLowerCase() === 'long'
                          ? styles.directionLong
                          : styles.directionShort
                      }`}
                    >
                      {alert.direction}
                    </span>
                  )}
                  {alert.setup_type && (
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {alert.setup_type}
                    </span>
                  )}
                  <span className={styles.resultDate}>
                    {getRelativeTime(alert.created_at)}
                  </span>
                </div>
                <div className={styles.resultContent}>{alert.content}</div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className={styles.loadMoreWrapper}>
              <button
                className={styles.loadMoreBtn}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
