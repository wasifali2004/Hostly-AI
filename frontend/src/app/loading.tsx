import { Logo } from "@/components/brand/logo";

export default function Loading() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="page-shell flex h-18 items-center">
        <Logo />
      </div>
      <div className="page-shell py-16">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton mt-7 h-24 max-w-4xl rounded-2xl" />
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="overflow-hidden rounded-2xl border border-ink/10">
              <div className="skeleton aspect-[4/3]" />
              <div className="space-y-3 p-5">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-9 w-4/5 rounded" />
                <div className="skeleton h-3 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
