import api from "@/lib/api-client";
import {
  IWebhook,
  ICreateWebhook,
  IUpdateWebhook,
} from "@/features/webhook/types/webhook.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getWebhooks(
  params?: QueryParams,
): Promise<IPagination<IWebhook>> {
  const req = await api.post("/webhooks", { ...params });
  return req.data;
}

export async function getWebhookEvents(): Promise<{ events: string[] }> {
  const req = await api.get("/webhooks/events");
  return req.data;
}

export async function createWebhook(data: ICreateWebhook): Promise<IWebhook> {
  const req = await api.post("/webhooks/create", data);
  return req.data;
}

export async function updateWebhook(data: IUpdateWebhook): Promise<IWebhook> {
  const req = await api.post("/webhooks/update", data);
  return req.data;
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  await api.post("/webhooks/delete", { webhookId });
}
