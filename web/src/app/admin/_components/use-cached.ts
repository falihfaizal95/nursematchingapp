import { useCallback, useEffect, useState } from "react";

// Renders the module-cached value immediately (instant tab switch), then
// revalidates in the background. `loading` is only true when there's no
// cached value to show yet. `reload` re-fetches on demand (e.g. after an
// invite adds a row).
export function useCached<T>(cached: T | null, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState(cached === null);

  const load = useCallback(() => {
    let alive = true;
    fetcher()
      .then((fresh) => {
        if (alive) setData(fresh);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => load(), [load]);

  return { data, loading, reload: load };
}
