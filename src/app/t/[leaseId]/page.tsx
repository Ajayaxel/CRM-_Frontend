import { TenantPortal } from '@/features/experiences/agentportal';
export default async function Page({ params }: { params: Promise<{ leaseId: string }> }) {
  const { leaseId } = await params;
  return <TenantPortal leaseId={leaseId} />;
}
