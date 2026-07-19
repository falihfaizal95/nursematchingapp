import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import type { Patient } from "@/lib/types";

type FamilyPatientContextValue = {
  patients: Patient[];
  selected: Patient | null;
  setSelectedId: (id: string) => void;
  loading: boolean;
};

const FamilyPatientContext = createContext<FamilyPatientContextValue>({
  patients: [],
  selected: null,
  setSelectedId: () => {},
  loading: true,
});

export function FamilyPatientProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("family_links")
      .select("patients(*)")
      .eq("family_user_id", profile.id);

    const list = (data ?? [])
      .map((l) => (l as unknown as { patients: Patient }).patients)
      .filter(Boolean);
    setPatients(list);
    setSelectedId((current) => current ?? list[0]?.id ?? null);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = patients.find((p) => p.id === selectedId) ?? patients[0] ?? null;

  return (
    <FamilyPatientContext.Provider value={{ patients, selected, setSelectedId, loading }}>
      {children}
    </FamilyPatientContext.Provider>
  );
}

export function useFamilyPatient() {
  return useContext(FamilyPatientContext);
}
