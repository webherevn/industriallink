'use client';

import { AdminDocs } from '@/components/admin-docs';
import { AdminShell } from '@/components/admin-shell';

export default function AdminDocsPage() {
  return (
    <AdminShell>
      <AdminDocs />
    </AdminShell>
  );
}
