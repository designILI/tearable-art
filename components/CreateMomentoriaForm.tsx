"use client";

import { FormEvent, useMemo, useState } from "react";

export function CreateMomentoriaForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileNames = useMemo(() => files.map((file) => file.name).join(", "), [files]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setShareUrl("");

    if (files.length !== 5) {
      setError("Choose exactly 5 images.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    formData.delete("images");
    files.forEach((file) => formData.append("images", file));

    const response = await fetch("/api/momentoria", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as { url?: string; error?: string };
    setSubmitting(false);

    if (!response.ok || !result.url) {
      setError(result.error || "Could not create this Momentoria.");
      return;
    }

    setShareUrl(`${window.location.origin}${result.url}`);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[8px] border border-ink/10 bg-white/54 p-5 shadow-soft backdrop-blur sm:p-7">
      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Title</span>
          <input
            name="title"
            required
            maxLength={80}
            className="min-h-12 rounded-[6px] border border-ink/14 bg-white px-4 outline-none transition focus:border-ink/60"
            placeholder="Summer in Lisbon"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Short message</span>
          <textarea
            name="message"
            required
            maxLength={220}
            rows={4}
            className="resize-none rounded-[6px] border border-ink/14 bg-white px-4 py-3 outline-none transition focus:border-ink/60"
            placeholder="A small story for a day I keep returning to."
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Recipient name</span>
          <input
            name="recipientName"
            maxLength={60}
            className="min-h-12 rounded-[6px] border border-ink/14 bg-white px-4 outline-none transition focus:border-ink/60"
            placeholder="Optional"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-ink">Five images</span>
          <input
            name="images"
            type="file"
            accept="image/*"
            multiple
            required
            onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))}
            className="rounded-[6px] border border-dashed border-ink/24 bg-white px-4 py-5 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream"
          />
          <span className="text-sm text-ink/58">{files.length ? `${files.length} selected: ${fileNames}` : "Select exactly 5 image files."}</span>
        </label>
      </div>

      {error ? <p className="mt-5 rounded-[6px] bg-rose/15 px-4 py-3 text-sm font-semibold text-ink">{error}</p> : null}

      {shareUrl ? (
        <div className="mt-5 rounded-[6px] border border-sage/30 bg-sage/12 p-4">
          <p className="text-sm font-semibold text-ink">Private share link</p>
          <a href={shareUrl} className="mt-2 block break-all text-sm text-ink/72 underline underline-offset-4">
            {shareUrl}
          </a>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-cream transition hover:bg-dusk disabled:cursor-wait disabled:opacity-60"
      >
        {submitting ? "Creating..." : "Create private link"}
      </button>
    </form>
  );
}
