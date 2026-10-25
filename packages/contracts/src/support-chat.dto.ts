export interface SupportChatMessageView {
  id: string;
  body: string;
  mine: boolean;
  fromStaff: boolean;
  senderName: string;
  createdAt: string;
}

export interface SupportChatView {
  messages: SupportChatMessageView[];
  unread: number;
}

export interface SupportChatThreadView {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface SendSupportChatRequest {
  body: string;
}
