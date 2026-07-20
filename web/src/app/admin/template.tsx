// template.tsx remounts on every navigation within /admin, unlike layout.tsx —
// that's what lets the entrance animation re-trigger on each tab switch.
export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
