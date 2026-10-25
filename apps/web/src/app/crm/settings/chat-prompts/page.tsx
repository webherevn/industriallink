import type { Metadata } from 'next';
import { ChatPromptsPanel } from '@/components/crm/chat-prompts-panel';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Câu chào chat · CRM' };

export default function CrmChatPromptsPage() {
  return <ChatPromptsPanel />;
}
