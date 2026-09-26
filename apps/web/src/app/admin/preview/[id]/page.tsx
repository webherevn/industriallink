'use client';

import { use } from 'react';
import { AdminCmsPreviewPage } from '@/components/cms-preview';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminCmsPreviewPage id={id} />;
}
