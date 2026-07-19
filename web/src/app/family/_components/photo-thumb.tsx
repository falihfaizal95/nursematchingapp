"use client";

import { useEffect, useState } from "react";
import { getSignedPhotoUrl } from "@/lib/family-updates";

export function PhotoThumb({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSignedPhotoUrl(storagePath).then((u) => {
      if (mounted) setUrl(u);
    });
    return () => {
      mounted = false;
    };
  }, [storagePath]);

  if (!url) return <div className="h-40 w-full animate-pulse rounded-xl bg-slate-100" />;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Update photo" className="max-h-72 w-full rounded-xl object-cover" />;
}
