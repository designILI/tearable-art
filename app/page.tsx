import Image from "next/image";
import Link from "next/link";

const previewImages = [
  "/assets/layers/layer-01.jpeg",
  "/assets/layers/layer-02.jpeg",
  "/assets/layers/layer-03.jpeg",
];

export default function HomePage() {
  return (
    <main className="min-h-svh px-5 py-5 sm:px-8">
      <section className="mx-auto grid min-h-[calc(100svh-2.5rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-sage">Momentoria</p>
          <h1 className="font-serif text-5xl font-semibold leading-[0.95] text-ink sm:text-7xl">
            A memory shared through an unfolding image story.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-ink/70 sm:text-lg">
            Upload five images, add a note, and receive a private link to a layered reveal made for one quiet moment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/create"
              className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-sm font-semibold text-cream shadow-soft transition hover:-translate-y-0.5 hover:bg-dusk"
            >
              Create a Moment
            </Link>
          </div>
        </div>

        <div className="relative min-h-[420px] lg:min-h-[620px]" aria-hidden="true">
          {previewImages.map((src, index) => (
            <div
              key={src}
              className="absolute overflow-hidden rounded-[6px] border border-white/50 bg-cream shadow-soft"
              style={{
                inset: `${index * 9}% ${18 - index * 7}% ${18 - index * 5}% ${index * 8}%`,
                transform: `rotate(${index === 1 ? 2 : -3 + index * 4}deg)`,
                zIndex: previewImages.length - index,
              }}
            >
              <Image src={src} alt="" fill sizes="(min-width: 1024px) 48vw, 90vw" className="object-cover" priority={index === 0} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
