export interface IWebhook {
  id: string;
  name: string | null;
  url: string;
  secret: string | null;
  events: string[];
  isActive: boolean;
  workspaceId: string;
  creatorId: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateWebhook {
  name?: string;
  url: string;
  secret?: string;
  events: string[];
  isActive?: boolean;
}

export interface IUpdateWebhook {
  webhookId: string;
  name?: string;
  url?: string;
  secret?: string;
  events?: string[];
  isActive?: boolean;
}
