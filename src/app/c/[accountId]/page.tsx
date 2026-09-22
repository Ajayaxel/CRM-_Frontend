import { ClientPortal } from '@/features/verticals/agency/agency';

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return <ClientPortal accountId={accountId} />;
}
