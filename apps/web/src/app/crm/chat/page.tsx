import type { Metadata } from 'next';
import { SupportChatPanel } from '@/components/crm/support-chat-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Chat · CRM' };

export default function CrmChatPage() {
  return <SupportChatPanel />;
}
