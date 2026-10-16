import type { ReactNode } from 'react';
import { CrmShell } from '@/components/crm-shell';

export default function CrmLayout({ children }: { children: ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
