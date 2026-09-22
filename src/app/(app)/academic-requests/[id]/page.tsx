import { RequestDetailFeature } from '@/features/verticals/education/academic-requests';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetailFeature id={id} />;
}
