import { HeartHandshake, MapPin, MessageSquareText, ShieldCheck } from "lucide-react";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 py-10 text-white lg:w-[46%] lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <HeartHandshake size={24} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">Evoura</p>
            <p className="text-xs font-medium text-blue-100">Home Care</p>
          </div>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <h1 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
            Know your loved one is in good hands — in real time.
          </h1>
          <ul className="mt-8 hidden space-y-4 lg:block">
            <Feature icon={<MapPin size={17} />} text="See your caregiver's live location during every visit" />
            <Feature icon={<MessageSquareText size={17} />} text="A daily report after every shift, plus a shared photo timeline" />
            <Feature icon={<ShieldCheck size={17} />} text="Private by design — location sharing ends the moment a shift does" />
          </ul>
        </div>

        <p className="relative mt-10 text-xs font-medium text-blue-200 lg:mt-0">
          Care you can see. Peace of mind you can feel.
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>

          <form action={signIn} className="mt-8 space-y-5">
            {error && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
            >
              Sign in
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Need an account? Your agency sends invites by email.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
        {icon}
      </span>
      <span className="pt-1 text-sm font-medium text-blue-50">{text}</span>
    </li>
  );
}
