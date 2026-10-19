import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  updateApiKey,
} from "@/features/api-key/services/api-key-service";
import {
  IApiKey,
  ICreateApiKeyRequest,
  IUpdateApiKeyRequest,
} from "@/features/api-key/types/api-key.types";
import { IPagination, QueryParams } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export const API_KEYS_KEY = "api-keys";

export function useApiKeysQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<IApiKey>, Error> {
  return useQuery({
    queryKey: [API_KEYS_KEY, params],
    queryFn: () => getApiKeys(params),
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IApiKey, Error, ICreateApiKeyRequest>({
    mutationFn: (data) => createApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_KEYS_KEY] });
    },
    onError: (err) => {
      notifications.show({
        message:
          (err as any)?.response?.data?.message ??
          t("Failed to create API key"),
        color: "red",
      });
    },
  });
}

export function useUpdateApiKeyMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IApiKey, Error, IUpdateApiKeyRequest>({
    mutationFn: (data) => updateApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_KEYS_KEY] });
      notifications.show({ message: t("API key updated") });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<void, Error, { apiKeyId: string }>({
    mutationFn: (data) => revokeApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_KEYS_KEY] });
      notifications.show({ message: t("API key revoked") });
    },
  });
}
