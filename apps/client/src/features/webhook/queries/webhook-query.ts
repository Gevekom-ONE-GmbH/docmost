import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  createWebhook,
  deleteWebhook,
  getWebhookEvents,
  getWebhooks,
  updateWebhook,
} from "@/features/webhook/services/webhook-service";
import {
  IWebhook,
  ICreateWebhook,
  IUpdateWebhook,
} from "@/features/webhook/types/webhook.types";
import { IPagination } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const WEBHOOKS_KEY = "webhooks";

export function useWebhooksQuery(): UseQueryResult<
  IPagination<IWebhook>,
  Error
> {
  return useQuery({
    queryKey: [WEBHOOKS_KEY],
    queryFn: () => getWebhooks({ limit: 100 }),
  });
}

export function useWebhookEventsQuery() {
  return useQuery({
    queryKey: [WEBHOOKS_KEY, "events"],
    queryFn: () => getWebhookEvents(),
    staleTime: 5 * 60_000,
  });
}

function showError(err: unknown, fallback: string) {
  notifications.show({
    message: (err as any)?.response?.data?.message ?? fallback,
    color: "red",
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IWebhook, Error, ICreateWebhook>({
    mutationFn: (data) => createWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      notifications.show({ message: t("Webhook created") });
    },
    onError: (e) => showError(e, t("Failed to create webhook")),
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IWebhook, Error, IUpdateWebhook>({
    mutationFn: (data) => updateWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
    },
    onError: (e) => showError(e, t("Failed to update webhook")),
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [WEBHOOKS_KEY] });
      notifications.show({ message: t("Webhook deleted") });
    },
    onError: (e) => showError(e, t("Failed to delete webhook")),
  });
}
