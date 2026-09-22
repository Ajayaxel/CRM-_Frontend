import { VendorPortal } from '@/features/experiences/vendorportal';
export default async function Page({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  return <VendorPortal vendorId={vendorId} />;
}
