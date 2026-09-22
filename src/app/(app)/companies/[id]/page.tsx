import { WorkspaceFeature } from '@/features/verticals/consulting/workspace';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkspaceFeature companyId={id} />;
}
