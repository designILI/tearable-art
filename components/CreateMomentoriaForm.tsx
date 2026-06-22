"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

const layerLabels = ["Top layer", "Layer 2", "Layer 3", "Layer 4", "Final layer"];

export function CreateMomentoriaForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fileNames = useMemo(() => files.map((file) => file.name).join(", "), [files]);
  const orderedFiles = useMemo(
    () =>
      files.map((file, index) => ({
        file,
        label: layerLabels[index] ?? `Layer ${index + 1}`,
        previewUrl: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      orderedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [orderedFiles]);

  function moveFile(fromIndex: number, direction: -1 | 1) {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= files.length) return;

    setFiles((currentFiles) => {
      const nextFiles = [...currentFiles];
      const [movedFile] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, movedFile);
      return nextFiles;
    });
    setShareUrl("");
  }

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
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []).slice(0, 5));
              setShareUrl("");
            }}
            className="rounded-[6px] border border-dashed border-ink/24 bg-white px-4 py-5 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cream"
          />
          <span className="text-sm text-ink/58">{files.length ? `${files.length} selected: ${fileNames}` : "Select exactly 5 image files."}</span>
        </label>

        {orderedFiles.length ? (
          <section className="grid gap-3" aria-label="Image layer order">
            <div>
              <h2 className="text-sm font-semibold text-ink">Layer order</h2>
              <p className="mt-1 text-sm text-ink/58">The first image is revealed first. Move images until the final layer stack feels right.</p>
            </div>

            <ol className="grid gap-3">
              {orderedFiles.map((item, index) => (
                <li key={`${item.file.name}-${item.file.lastModified}-${index}`} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-[6px] border border-ink/10 bg-white/72 p-2">
                  <div className="relative h-[72px] w-[72px] overflow-hidden rounded-[5px] bg-ink/8">
                    <Image src={item.previewUrl} alt="" fill sizes="72px" className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{item.label}</p>
                    <p className="mt-1 truncate text-sm text-ink/58">{item.file.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveFile(index, -1)}
                      aria-label={`Move ${item.file.name} up`}
                      className="grid h-9 w-9 place-items-center rounded-full border border-ink/14 bg-white text-base font-semibold leading-none text-ink transition hover:border-ink/42 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === orderedFiles.length - 1}
                      onClick={() => moveFile(index, 1)}
                      aria-label={`Move ${item.file.name} down`}
                      className="grid h-9 w-9 place-items-center rounded-full border border-ink/14 bg-white text-base font-semibold leading-none text-ink transition hover:border-ink/42 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
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
