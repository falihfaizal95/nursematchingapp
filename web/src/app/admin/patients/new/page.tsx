import { createPatient } from "@/lib/actions/admin-patients";
import { redirect } from "next/navigation";

export default function NewPatientPage() {
  async function action(formData: FormData) {
    "use server";
    const id = await createPatient(formData);
    redirect(`/admin/patients/${id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-stone-900">Add patient</h1>
      <form action={action} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
        <Field label="Full name" name="full_name" required />
        <Field label="Date of birth" name="date_of_birth" type="date" />
        <Field label="Address" name="address" required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Latitude" name="lat" type="number" step="any" required hint="Used to verify GPS check-in" />
          <Field label="Longitude" name="lng" type="number" step="any" required />
        </div>
        <Field label="Primary condition" name="primary_condition" />
        <Field label="Allergies" name="allergies" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Emergency contact name" name="emergency_contact_name" />
          <Field label="Emergency contact phone" name="emergency_contact_phone" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-stone-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Create patient
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  step,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  step?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  );
}
