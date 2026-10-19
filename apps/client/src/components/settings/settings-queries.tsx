import { queryClient } from "@/main.tsx";
import {
  getBilling,
  getBillingPlans,
} from "@/ee/billing/services/billing-service.ts";
import { getSpaces } from "@/features/space/services/space-service.ts";
import { getGroups } from "@/features/group/services/group-service.ts";
import { QueryParams } from "@/lib/types.ts";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service.ts";
import { getLicenseInfo } from "@/ee/licence/services/license-service.ts";
import { getSsoProviders } from "@/ee/security/services/security-service.ts";
import { getShares } from "@/features/share/services/share-service.ts";
import { getApiKeys } from "@/features/api-key/services/api-key-service";
import { API_KEYS_KEY } from "@/features/api-key/queries/api-key-query";
import { getAuditLogs } from "@/features/audit/services/audit-service";
import { getVerifications } from "@/features/page-verification/services/page-verification-service";
import { getScimTokens } from "@/ee/scim/services/scim-token-service";

export const prefetchWorkspaceMembers = () => {
  const params: QueryParams = { limit: 100, query: "" };
  queryClient.prefetchQuery({
    queryKey: ["workspaceMembers", params],
    queryFn: () => getWorkspaceMembers(params),
  });
};

export const prefetchSpaces = () => {
  queryClient.prefetchQuery({
    queryKey: ["spaces", {}],
    queryFn: () => getSpaces({}),
  });
};

export const prefetchGroups = () => {
  queryClient.prefetchQuery({
    queryKey: ["groups", {}],
    queryFn: () => getGroups({}),
  });
};

export const prefetchBilling = () => {
  queryClient.prefetchQuery({
    queryKey: ["billing"],
    queryFn: () => getBilling(),
  });

  queryClient.prefetchQuery({
    queryKey: ["billing-plans"],
    queryFn: () => getBillingPlans(),
  });
};

export const prefetchLicense = () => {
  queryClient.prefetchQuery({
    queryKey: ["license"],
    queryFn: () => getLicenseInfo(),
  });
};

export const prefetchSsoProviders = () => {
  queryClient.prefetchQuery({
    queryKey: ["sso-providers"],
    queryFn: () => getSsoProviders(),
  });
};

export const prefetchShares = () => {
  queryClient.prefetchQuery({
    queryKey: ["share-list", {}],
    queryFn: () => getShares({}),
  });
};

export const prefetchApiKeys = () => {
  const params = { limit: 100 };
  queryClient.prefetchQuery({
    queryKey: [API_KEYS_KEY, params],
    queryFn: () => getApiKeys(params),
  });
};

export const prefetchApiKeyManagement = () => {
  const params = { limit: 100, adminView: true };
  queryClient.prefetchQuery({
    queryKey: [API_KEYS_KEY, params],
    queryFn: () => getApiKeys(params),
  });
};

export const prefetchAuditLogs = () => {
  // Matches useAuditLogsInfiniteQuery() with no filters.
  queryClient.prefetchInfiniteQuery({
    queryKey: ["audit-logs", {}],
    queryFn: ({ pageParam }) =>
      getAuditLogs({ limit: 50, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
  });
};

export const prefetchVerifiedPages = () => {
  // Same key/fn as useVerificationListQuery() on the verified-pages page.
  queryClient.prefetchQuery({
    queryKey: ["page-verifications", undefined],
    queryFn: () => getVerifications({ limit: 100 }),
  });
};

export const prefetchScimTokens = () => {
  queryClient.prefetchQuery({
    queryKey: ["scim-token-list", { cursor: undefined }],
    queryFn: () => getScimTokens({}),
  });
};
