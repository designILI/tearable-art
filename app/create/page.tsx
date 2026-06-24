import Link from "next/link";
import { CreateMomentoriaForm } from "@/components/CreateMomentoriaForm";

export default function CreatePage() {
  return (
    <main className="min-h-svh px-5 py-6 sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-8 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-14">
        <aside>
          <Link href="/" className="text-sm font-semibold text-ink/60 transition hover:text-ink">
            Momentoria
          </Link>
          <h1 className="mt-8 font-serif text-5xl font-semibold leading-none text-ink sm:text-6xl">Create a Momenta.</h1>
          <p className="mt-5 max-w-sm leading-7 text-ink/68">
            Choose five images in the order they should unfold. The first image becomes the top layer.
          </p>
        </aside>
        <CreateMomentoriaForm />
      </div>
    </main>
  );
}
