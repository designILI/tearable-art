"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MomentoriaMetadata } from "@/lib/momentoria";
import { TearableStory } from "@/components/TearableStory";

type ShareMomentoriaProps = {
  momentoria: MomentoriaMetadata;
};

export function ShareMomentoria({ momentoria }: ShareMomentoriaProps) {
  const storageKey = `momentoria:${momentoria.id}:complete-reveals`;
  const endCardTimerRef = useRef<number | null>(null);
  const [completeReveals, setCompleteReveals] = useState(0);
  const [showEndCard, setShowEndCard] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [momentoriaLink, setMomentoriaLink] = useState("https://tearable-art.vercel.app");
  const [storyResetKey, setStoryResetKey] = useState(0);

  useEffect(() => {
    const storedReveals = Number(window.localStorage.getItem(storageKey) || "0");
    setCompleteReveals(storedReveals);
    setShowEndCard(storedReveals >= 3);
    setMomentoriaLink(window.location.origin);
  }, [storageKey]);

  const handleCompleteReveal = useCallback(() => {
    setCompleteReveals((current) => {
      const next = Math.min(current + 1, 3);
      if (next > current) {
        trackMomentoriaEvent(momentoria.id, "completed_reveal", `cycle ${next} of 3`);
      }
      window.localStorage.setItem(storageKey, String(next));
      if (next >= 3) {
        if (endCardTimerRef.current) window.clearTimeout(endCardTimerRef.current);
        endCardTimerRef.current = window.setTimeout(() => setShowEndCard(true), 4000);
      }
      return next;
    });
  }, [momentoria.id, storageKey]);

  const handleReset = useCallback(() => {
    setShowEndCard(false);
    setShowComingSoon(false);
    if (endCardTimerRef.current) {
      window.clearTimeout(endCardTimerRef.current);
      endCardTimerRef.current = null;
    }
  }, []);

  const handleResetCycles = useCallback(() => {
    trackMomentoriaEvent(momentoria.id, "clicked_cycle_again");
    window.localStorage.setItem(storageKey, "0");
    setCompleteReveals(0);
    setShowEndCard(false);
    setShowComingSoon(false);
    setStoryResetKey((current) => current + 1);
    if (endCardTimerRef.current) {
      window.clearTimeout(endCardTimerRef.current);
      endCardTimerRef.current = null;
    }
  }, [momentoria.id, storageKey]);

  const handleSavePermanently = useCallback(() => {
    trackMomentoriaEvent(momentoria.id, "clicked_save_permanently");
    setShowComingSoon(true);
  }, [momentoria.id]);

  const handleMakeOwn = useCallback(() => {
    trackMomentoriaEvent(momentoria.id, "clicked_make_own");
  }, [momentoria.id]);

  useEffect(() => {
    return () => {
      if (endCardTimerRef.current) window.clearTimeout(endCardTimerRef.current);
    };
  }, []);

  return (
    <main className="relative h-svh overflow-hidden bg-dusk text-cream">
      <TearableStory
        key={storyResetKey}
        imageUrls={momentoria.imageUrls}
        title={momentoria.title}
        disabled={showEndCard}
        hideReset={completeReveals >= 3}
        onCompleteReveal={handleCompleteReveal}
        onReset={handleReset}
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

      {showEndCard ? (
        <div className="momentoria-end-card absolute inset-0 z-20 grid place-items-center bg-dusk/88 px-5 text-center backdrop-blur-md">
          <div className="max-w-2xl">
            {showComingSoon ? (
              <>
                <p className="font-serif text-4xl font-semibold leading-tight text-cream sm:text-6xl">Feature coming soon</p>
                <p className="mx-auto mt-5 max-w-md text-base leading-7 text-cream/70">
                  Permanent saving will arrive in a future Momentoria update.
                </p>
                <button
                  type="button"
                  onClick={() => setShowComingSoon(false)}
                  className="mt-8 min-h-12 rounded-full border border-cream/30 px-5 text-sm font-semibold text-cream transition hover:border-cream/70 hover:bg-cream/10"
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <p className="font-serif text-4xl font-semibold leading-tight text-cream sm:text-6xl">
                  Hope you enjoyed the Momenta!
                </p>
                <p className="mt-6 text-xl font-semibold text-cream/82 sm:text-2xl">Let the sender know!</p>
                <p className="mt-8 text-sm uppercase tracking-[0.18em] text-cream/54">Make your own</p>
                <a
                  href={momentoriaLink}
                  onClick={handleMakeOwn}
                  className="mt-3 inline-flex min-h-12 items-center justify-center rounded-full border border-cream/32 px-6 text-sm font-semibold text-cream transition hover:border-cream/70 hover:bg-cream/10"
                >
                  Visit Momentoria
                </a>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleResetCycles}
                    className="min-h-12 rounded-full border border-cream/30 px-5 text-sm font-semibold text-cream transition hover:border-cream/70 hover:bg-cream/10"
                  >
                    Reset moment cycles
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePermanently}
                    className="min-h-12 rounded-full border border-cream/30 px-5 text-sm font-semibold text-cream transition hover:border-cream/70 hover:bg-cream/10"
                  >
                    Save permanently
                  </button>
                </div>
                <p className="mt-6 text-xs uppercase tracking-[0.16em] text-cream/42">This Momenta has faded.</p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function trackMomentoriaEvent(
  id: string,
  event: "completed_reveal" | "clicked_cycle_again" | "clicked_make_own" | "clicked_save_permanently",
  details = "",
) {
  fetch("/api/momentoria/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ id, event, details }),
    keepalive: true,
  }).catch(() => {
    // Tracking should never interrupt the Momentoria experience.
  });
}
