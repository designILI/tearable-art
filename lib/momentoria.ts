import { list, put } from "@vercel/blob";

export type MomentoriaMetadata = {
  id: string;
  title: string;
  message: string;
  recipientName?: string;
  imageUrls: string[];
  createdAt: string;
};

const ROOT_PREFIX = "momentoria";

export function makeMomentoriaId() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 18);
}

export function metadataPath(id: string) {
  return `${ROOT_PREFIX}/${id}/metadata.json`;
}

export async function saveMomentoriaMetadata(metadata: MomentoriaMetadata) {
  /*
    Metadata is stored as a JSON file in Vercel Blob beside the uploaded images.
    This keeps the MVP deployable on Vercel without a separate database. The
    private share URL uses a high-entropy id; later, this function is the natural
    place to swap in Vercel Postgres, Neon, Supabase, or another database.
  */
  await put(metadataPath(metadata.id), JSON.stringify(metadata, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

export async function getMomentoriaMetadata(id: string) {
  if (process.env.NODE_ENV !== "production" && id === "demo") {
    return {
      id: "demo",
      title: "A Quiet Afternoon",
      message: "A local preview Momentoria using the original layered artwork.",
      recipientName: "You",
      imageUrls: [
        "/assets/layers/layer-01.jpg",
        "/assets/layers/layer-02.jpg",
        "/assets/layers/layer-03.jpg",
        "/assets/layers/layer-04.jpg",
        "/assets/layers/layer-05.jpg",
      ],
      createdAt: new Date().toISOString(),
    };
  }

  /*
    Share pages only know the private id from /m/[id]. We locate that id's
    metadata JSON in Blob, fetch it, and then pass the saved image URLs into the
    tearable reveal component.
  */
  const result = await list({
    prefix: metadataPath(id),
    limit: 1,
  });

  const blob = result.blobs[0];
  if (!blob) return null;

  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) return null;

  return (await response.json()) as MomentoriaMetadata;
}

export function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function cleanFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
}
