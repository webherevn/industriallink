'use client';

import { use } from 'react';
import { AdminPostEditorPage } from '@/components/admin-cms-content';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminPostEditorPage editId={id} />;
}
