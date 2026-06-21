import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  cleanFileName,
  cleanText,
  makeMomentoriaId,
  saveMomentoriaMetadata,
  type MomentoriaMetadata,
} from "@/lib/momentoria";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = cleanText(formData.get("title"), 80);
    const message = cleanText(formData.get("message"), 220);
    const recipientName = cleanText(formData.get("recipientName"), 60);
    const images = formData.getAll("images").filter((file): file is File => file instanceof File && file.size > 0);

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Missing BLOB_READ_WRITE_TOKEN. Add a Vercel Blob token before creating a Momentoria." },
        { status: 500 },
      );
    }

    if (!title || !message) {
      return NextResponse.json({ error: "Add a title and short message." }, { status: 400 });
    }

    if (images.length !== 5) {
      return NextResponse.json({ error: "Upload exactly 5 images." }, { status: 400 });
    }

    const invalidImage = images.find((image) => !image.type.startsWith("image/"));
    if (invalidImage) {
      return NextResponse.json({ error: `${invalidImage.name} is not an image.` }, { status: 400 });
    }

    const id = makeMomentoriaId();

    /*
      Each image is uploaded directly to Vercel Blob under the new private id.
      Blob returns public file URLs; only people with the generated /m/[id] link
      can discover this Momentoria in the current MVP.
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
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create this Momentoria." }, { status: 500 });
  }
}
