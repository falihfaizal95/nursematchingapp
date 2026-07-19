"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { checkIn } from "@/lib/actions/nurse-visit";

export function CheckInButton({ shiftId }: { shiftId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleCheckIn() {
    setError(null);
    if (!navigator.geolocation) {
      setError("GPS isn't available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          try {
            const visitId = await checkIn(
              shiftId,
              position.coords.latitude,
              position.coords.longitude,
            );
            router.push(`/nurse/visits/${visitId}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Check-in failed.");
          }
        });
      },
      () => setError("Location permission is required to check in."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckIn}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white active:bg-teal-700 disabled:opacity-60"
      >
        <LocateFixed size={16} />
        {pending ? "Checking in..." : "Check in"}
      </button>
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
