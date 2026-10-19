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
import { getAuditLogs } from "@/ee/audit/services/audit-service";
import { getVerificationList } from "@/ee/page-verification/services/page-verification-service";
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
  const params = { limit: 50 };
  queryClient.prefetchQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => getAuditLogs(params),
  });
};

export const prefetchVerifiedPages = () => {
  const params = { limit: 50 };
  queryClient.prefetchQuery({
    queryKey: ["verification-list", params],
    queryFn: () => getVerificationList(params),
  });
};

export const prefetchScimTokens = () => {
  queryClient.prefetchQuery({
    queryKey: ["scim-token-list", { cursor: undefined }],
    queryFn: () => getScimTokens({}),
  });
};
