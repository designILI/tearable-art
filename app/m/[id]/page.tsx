import { notFound } from "next/navigation";
import { getMomentoriaMetadata } from "@/lib/momentoria";
import { ShareMomentoria } from "@/components/ShareMomentoria";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MomentoriaPage({ params }: PageProps) {
  const { id } = await params;
  const metadata = await getMomentoriaMetadata(id);

  if (!metadata) {
    notFound();
  }

  return <ShareMomentoria momentoria={metadata} />;
}
