# Momentoria

Momentoria is a simple full-stack Next.js app for creating a private, tearable image story.

> A memory shared through an unfolding image story.

Users upload exactly 5 images, add a title and short message, and receive a private share link. The share page preserves the original layered tear interaction and fades locally after 3 complete reveals in the same browser.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Three.js for the tearable reveal
- Vercel Blob for uploaded images and MVP metadata JSON

## How Uploads Work

The create form compresses images in the browser before sending them to the API.

1. The route validates the title, message, optional recipient name, and exactly 5 image files.
2. The browser resizes and compresses each image so full-resolution phone photos do not hit Vercel Function payload limits.
3. The API uploads those compressed images to Vercel Blob under `momentoria/{id}/`.
4. The API saves `metadata.json` to Vercel Blob with the title, message, recipient name, image URLs, and creation time.
5. It returns `/m/{id}` as the private share URL.

This keeps the MVP deployable without a separate database. For a larger product, replace the metadata helpers in `lib/momentoria.ts` with Vercel Postgres, Neon, Supabase, or another database.

## Environment Variables

Create a Vercel Blob store and add this variable locally and in Vercel:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

On Vercel, this is usually added automatically when you connect a Blob store to the project. Locally, put it in `.env.local`.

## Local Development

```bash
npm install
npm run dev
```

Visit:

- `http://localhost:3000` for the landing page
- `http://localhost:3000/create` for the upload form
- `http://localhost:3000/m/demo` for a local tearable share preview using the bundled sample images

Creating a real Momentoria locally requires `BLOB_READ_WRITE_TOKEN`.

The create page shows a Blob storage status message. If it says `Blob storage connected`, the app can see `BLOB_READ_WRITE_TOKEN`. A successful submit is the final proof: it creates five files and `metadata.json` in Vercel Blob, then displays the private link.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Deployment

Deploy to Vercel as a standard Next.js project.

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Use the `Next.js` framework preset. This app is not a static HTML site anymore, and the homepage is `app/page.tsx`.
4. Leave the output directory empty so Vercel uses Next.js' `.next` build output.
5. Connect a Vercel Blob store.
6. Confirm `BLOB_READ_WRITE_TOKEN` is present.
7. Deploy.

No accounts, payments, or email sending are included in this MVP.
