"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

const layerLabels = ["Top layer", "Layer 2", "Layer 3", "Layer 4", "Final layer"];

type BlobStatus = "checking" | "connected" | "missing";

const UPLOAD_TIMEOUT_MS = 180_000;

export function CreateMomentoriaForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blobStatus, setBlobStatus] = useState<BlobStatus>("checking");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");

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

  useEffect(() => {
    let ignore = false;

    async function checkBlobStatus() {
      try {
        const response = await fetch("/api/blob/status");
        const result = (await response.json()) as { configured?: boolean };
        if (!ignore) setBlobStatus(result.configured ? "connected" : "missing");
      } catch {
        if (!ignore) setBlobStatus("missing");
      }
    }

    void checkBlobStatus();

    return () => {
      ignore = true;
    };
  }, []);

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
    setUploadProgress(0);
    setUploadStatus("");

    if (files.length !== 5) {
      setError("Choose exactly 5 images.");
      return;
    }

    if (blobStatus !== "connected") {
      setError("Blob storage is not connected yet. Add BLOB_READ_WRITE_TOKEN in Vercel, redeploy, and try again.");
      return;
    }

    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const id = makeMomentoriaId();

    try {
      /*
        Images are compressed in the browser before they are sent to the API.
        That keeps the request small enough for Vercel Functions while avoiding
        the Vercel Blob client-upload callback issue on localhost.
      */
      const compressedFormData = new FormData();
      compressedFormData.append("id", id);
      compressedFormData.append("title", String(formData.get("title") ?? ""));
      compressedFormData.append("message", String(formData.get("message") ?? ""));
      compressedFormData.append("recipientName", String(formData.get("recipientName") ?? ""));

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadStatus(`Preparing image ${index + 1} of ${files.length}...`);
        setUploadProgress(Math.round((index / files.length) * 50));

        const uploadFile = await prepareImageForUpload(file);
        compressedFormData.append("images", uploadFile);
        setUploadProgress(Math.round(((index + 1) / files.length) * 50));
      }

      setUploadStatus(`Uploading compressed images (${formatFileSize(totalFileSize(compressedFormData.getAll("images")))} total)...`);
      setUploadProgress(60);

      const abortController = new AbortController();
      const timeout = window.setTimeout(() => abortController.abort(), UPLOAD_TIMEOUT_MS);

      const response = await fetch("/api/momentoria", {
        method: "POST",
        body: compressedFormData,
        signal: abortController.signal,
      }).finally(() => window.clearTimeout(timeout));
      const result = await readJsonResponse(response);

      if (!response.ok || !result.url) {
        setError(result.error || "Could not create this Momentoria.");
        return;
      }

      setUploadProgress(100);
      setUploadStatus("Momentoria created.");
      setShareUrl(`${window.location.origin}${result.url}`);
    } catch (uploadError) {
      const message =
        uploadError instanceof DOMException && uploadError.name === "AbortError"
          ? "The upload took too long. Try again, or choose a stronger connection."
          : uploadError instanceof Error
            ? uploadError.message
            : "Could not upload these images.";
      setError(message);
    } finally {
      setSubmitting(false);
      setUploadStatus("");
    }
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

        <div
          className={`rounded-[6px] border px-4 py-3 text-sm font-semibold ${
            blobStatus === "connected"
              ? "border-sage/30 bg-sage/12 text-ink"
              : blobStatus === "missing"
                ? "border-rose/25 bg-rose/12 text-ink"
                : "border-ink/10 bg-white/60 text-ink/60"
          }`}
        >
          {blobStatus === "checking" ? "Checking Blob storage..." : null}
          {blobStatus === "connected" ? "Blob storage connected" : null}
          {blobStatus === "missing" ? "Blob storage is not connected" : null}
        </div>

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

      {submitting ? (
        <div className="mt-5 rounded-[6px] border border-ink/10 bg-white/60 p-4">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-ink">
            <span>{uploadStatus || (uploadProgress < 100 ? "Uploading images..." : "Saving Momentoria...")}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : null}

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

function makeMomentoriaId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 18);
}

function cleanFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
}

async function prepareImageForUpload(file: File) {
  const maxDimension = 1200;
  const jpegQuality = 0.68;

  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality));

    if (!blob) return file;

    return new File([blob], `${cleanFileName(file.name).replace(/\.[a-z0-9]+$/i, "") || "image"}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = document.createElement("img");
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not prepare this image."));
    };
    image.src = url;
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function totalFileSize(values: FormDataEntryValue[]) {
  return values.reduce((total, value) => total + (value instanceof File ? value.size : 0), 0);
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {
      error: response.ok ? "The server returned an empty response." : `The server returned ${response.status} without details.`,
    } as { url?: string; error?: string };
  }

  try {
    return JSON.parse(text) as { url?: string; error?: string };
  } catch {
    return {
      error: response.ok ? "The server returned an unreadable response." : `The server returned ${response.status}: ${text.slice(0, 160)}`,
    };
  }
}
