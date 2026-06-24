import Link from "next/link";
import { HomeRevealPreview } from "@/components/HomeRevealPreview";

export default function HomePage() {
  return (
    <main className="min-h-svh px-5 py-5 sm:px-8">
      <section className="mx-auto grid min-h-[calc(100svh-2.5rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-sage">Momentoria</p>
          <h1 className="font-serif text-5xl font-semibold leading-[0.95] text-ink sm:text-7xl">
            Some memories deserve more than a swipe.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink/70 sm:text-lg">
            Upload five images that tell your story, add a note, and receive a private link to a bespoke layered reveal
            experience. This is your Momenta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/create"
              className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-sm font-semibold text-cream shadow-soft transition hover:-translate-y-0.5 hover:bg-dusk"
            >
              Create a Momenta
            </Link>
          </div>
        </div>

        <HomeRevealPreview />
      </section>
    </main>
  );
}
