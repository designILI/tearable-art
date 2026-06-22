import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  cleanFileName,
  cleanText,
  saveMomentoriaMetadata,
  type MomentoriaMetadata,
} from "@/lib/momentoria";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN. Add a Vercel Blob token before creating a Momentoria." },
        { status: 500 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      return createFromCompressedFormData(request);
    }

    const body = (await request.json()) as {
      id?: string;
      title?: string;
      message?: string;
      recipientName?: string;
      imageUrls?: string[];
    };

    const id = String(body.id ?? "");
    const title = cleanText(body.title ?? "", 80);
    const message = cleanText(body.message ?? "", 220);
    const recipientName = cleanText(body.recipientName ?? "", 60);
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.filter((url) => typeof url === "string") : [];

    if (!title || !message) {
      return NextResponse.json({ error: "Add a title and short message." }, { status: 400 });
    }

    if (!/^[a-f0-9]{18}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid Momentoria id." }, { status: 400 });
    }

    if (imageUrls.length !== 5) {
      return NextResponse.json({ error: "Upload exactly 5 images." }, { status: 400 });
    }

    const invalidUrl = imageUrls.find((url) => !url.includes(".public.blob.vercel-storage.com/momentoria/"));
    if (invalidUrl) {
      return NextResponse.json({ error: "One uploaded image URL is not from Vercel Blob." }, { status: 400 });
    }

    const metadata: MomentoriaMetadata = {
      id,
      title,
      message,
      recipientName: recipientName || undefined,
      imageUrls,
      createdAt: new Date().toISOString(),
    };

    await saveMomentoriaMetadata(metadata);

    return NextResponse.json({ id, url: `/m/${id}` });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create this Momentoria." }, { status: 500 });
  }
}

async function createFromCompressedFormData(request: Request) {
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const title = cleanText(formData.get("title"), 80);
  const message = cleanText(formData.get("message"), 220);
  const recipientName = cleanText(formData.get("recipientName"), 60);
  const images = formData.getAll("images").filter((file): file is File => file instanceof File && file.size > 0);

  if (!title || !message) {
    return NextResponse.json({ error: "Add a title and short message." }, { status: 400 });
  }

  if (!/^[a-f0-9]{18}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid Momentoria id." }, { status: 400 });
  }

  if (images.length !== 5) {
    return NextResponse.json({ error: "Upload exactly 5 images." }, { status: 400 });
  }

  const invalidImage = images.find((image) => !image.type.startsWith("image/"));
  if (invalidImage) {
    return NextResponse.json({ error: `${invalidImage.name} is not an image.` }, { status: 400 });
  }

  /*
    The browser compresses images before submitting this form, so the server
    receives small files and can safely write them to Blob without hitting the
    Vercel Function payload limit that full-resolution phone photos caused.
  */
  const imageUrls = await Promise.all(
    images.map(async (image, index) => {
      const extension = cleanFileName(image.name).split(".").pop() || "jpg";
      const blob = await put(`momentoria/${id}/layer-${index + 1}.${extension}`, image, {
        access: "public",
        addRandomSuffix: false,
        contentType: image.type,
      });
      return blob.url;
    }),
  );

  const metadata: MomentoriaMetadata = {
    id,
    title,
    message,
    recipientName: recipientName || undefined,
    imageUrls,
    createdAt: new Date().toISOString(),
  };

  await saveMomentoriaMetadata(metadata);

  return NextResponse.json({ id, url: `/m/${id}` });
}
