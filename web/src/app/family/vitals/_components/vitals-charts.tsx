"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Vitals } from "@/lib/types";

function formatData(vitals: Vitals[]) {
  return vitals.map((v) => ({
    date: new Date(v.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    systolic: v.bp_systolic,
    diastolic: v.bp_diastolic,
    heartRate: v.heart_rate,
    glucose: v.glucose,
    pain: v.pain_level,
  }));
}

export function VitalsCharts({ vitals }: { vitals: Vitals[] }) {
  if (vitals.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-400">
        No vitals recorded yet.
      </div>
    );
  }

  const data = formatData(vitals);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartCard title="Blood pressure">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" fontSize={11} stroke="#a8a29e" />
          <YAxis fontSize={11} stroke="#a8a29e" />
          <Tooltip />
          <Line type="monotone" dataKey="systolic" stroke="#0d9488" strokeWidth={2} dot={false} name="Systolic" />
          <Line type="monotone" dataKey="diastolic" stroke="#f59e0b" strokeWidth={2} dot={false} name="Diastolic" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Heart rate">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" fontSize={11} stroke="#a8a29e" />
          <YAxis fontSize={11} stroke="#a8a29e" />
          <Tooltip />
          <Line type="monotone" dataKey="heartRate" stroke="#dc2626" strokeWidth={2} dot={false} name="BPM" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Glucose">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" fontSize={11} stroke="#a8a29e" />
          <YAxis fontSize={11} stroke="#a8a29e" />
          <Tooltip />
          <Line type="monotone" dataKey="glucose" stroke="#7c3aed" strokeWidth={2} dot={false} name="mg/dL" />
        </LineChart>
      </ChartCard>

      <ChartCard title="Pain level">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="date" fontSize={11} stroke="#a8a29e" />
          <YAxis fontSize={11} domain={[0, 10]} stroke="#a8a29e" />
          <Tooltip />
          <Line type="monotone" dataKey="pain" stroke="#0891b2" strokeWidth={2} dot={false} name="0-10" />
        </LineChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-sm font-medium text-stone-700">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
