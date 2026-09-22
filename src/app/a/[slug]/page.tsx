import { PublicListings } from '@/features/experiences/agentportal';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicListings slug={slug} />;
}
