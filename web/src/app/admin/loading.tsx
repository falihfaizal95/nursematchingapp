// Instant skeleton while any /admin page fetches its data — this is what
// makes tab switches feel immediate: the click paints this right away and
// the real content streams in underneath it.
export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200/80" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-slate-200/60" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-7 w-10 animate-pulse rounded-md bg-slate-200/80" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200/60" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200/80" />
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200/60" />
            </div>
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
