"use client";

import { useCallback, useEffect, useState } from "react";
import type { MomentoriaMetadata } from "@/lib/momentoria";
import { TearableStory } from "@/components/TearableStory";

type ShareMomentoriaProps = {
  momentoria: MomentoriaMetadata;
};

export function ShareMomentoria({ momentoria }: ShareMomentoriaProps) {
  const storageKey = `momentoria:${momentoria.id}:complete-reveals`;
  const [completeReveals, setCompleteReveals] = useState(0);
  const faded = completeReveals >= 3;

  useEffect(() => {
    setCompleteReveals(Number(window.localStorage.getItem(storageKey) || "0"));
  }, [storageKey]);

  const handleCompleteReveal = useCallback(() => {
    setCompleteReveals((current) => {
      const next = Math.min(current + 1, 3);
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);

  return (
    <main className="relative h-svh overflow-hidden bg-dusk text-cream">
      <TearableStory
        imageUrls={momentoria.imageUrls}
        title={momentoria.title}
        disabled={faded}
        onCompleteReveal={handleCompleteReveal}
      />

      <section className="pointer-events-none absolute left-0 top-0 z-10 w-full p-5 sm:p-8">
        <div className="max-w-xl">
          {momentoria.recipientName ? (
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cream/68">For {momentoria.recipientName}</p>
          ) : null}
          <h1 className="mt-2 font-serif text-4xl font-semibold leading-none text-cream drop-shadow sm:text-6xl">{momentoria.title}</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-cream/78 drop-shadow sm:text-base">{momentoria.message}</p>
        </div>
      </section>

      <div className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-full border border-cream/20 bg-dusk/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cream/78 backdrop-blur sm:left-8">
        {Math.min(completeReveals, 3)} / 3 reveals
      </div>

      {faded ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-dusk/86 px-5 text-center backdrop-blur-md">
          <div>
            <p className="font-serif text-4xl font-semibold text-cream sm:text-6xl">This Momentoria has faded.</p>
            <p className="mt-4 text-sm text-cream/64">This browser has completed the story three times.</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
