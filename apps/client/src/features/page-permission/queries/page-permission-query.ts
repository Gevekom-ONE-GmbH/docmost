import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  addPagePermission,
  getPagePermissionInfo,
  getPagePermissions,
  removePagePermission,
  removePageRestriction,
  restrictPage,
  updatePagePermissionRole,
} from "@/features/page-permission/services/page-permission-service";
import {
  IAddPagePermission,
  IPagePermissionInfo,
  IPagePermissionMember,
  IRemovePagePermission,
  IUpdatePagePermissionRole,
} from "@/features/page-permission/types/page-permission.types";
import { IPagination } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const INFO_KEY = "page-permission-info";
const LIST_KEY = "page-permissions";

export function usePagePermissionInfoQuery(
  pageId: string,
): UseQueryResult<IPagePermissionInfo, Error> {
  return useQuery({
    queryKey: [INFO_KEY, pageId],
    queryFn: () => getPagePermissionInfo(pageId),
    enabled: !!pageId,
  });
}

export function usePagePermissionsQuery(
  pageId: string,
  enabled: boolean,
): UseQueryResult<IPagination<IPagePermissionMember>, Error> {
  return useQuery({
    queryKey: [LIST_KEY, pageId],
    queryFn: () => getPagePermissions(pageId, { limit: 100 }),
    enabled: !!pageId && enabled,
  });
}

function useInvalidate(pageId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [INFO_KEY, pageId] });
    queryClient.invalidateQueries({ queryKey: [LIST_KEY, pageId] });
  };
}

function showError(err: unknown, fallback: string) {
  notifications.show({
    message: (err as any)?.response?.data?.message ?? fallback,
    color: "red",
  });
}

export function useRestrictPageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IPagePermissionInfo, Error, string>({
    mutationFn: (pageId) => restrictPage(pageId),
    onSuccess: (_d, pageId) => {
      queryClient.invalidateQueries({ queryKey: [INFO_KEY, pageId] });
      queryClient.invalidateQueries({ queryKey: [LIST_KEY, pageId] });
    },
    onError: (e) => showError(e, t("Failed to restrict page")),
  });
}

export function useRemovePageRestrictionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IPagePermissionInfo, Error, string>({
    mutationFn: (pageId) => removePageRestriction(pageId),
    onSuccess: (_d, pageId) => {
      queryClient.invalidateQueries({ queryKey: [INFO_KEY, pageId] });
      queryClient.invalidateQueries({ queryKey: [LIST_KEY, pageId] });
    },
    onError: (e) => showError(e, t("Failed to remove restriction")),
  });
}

export function useAddPagePermissionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IPagePermissionInfo, Error, IAddPagePermission>({
    mutationFn: (data) => addPagePermission(data),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: [INFO_KEY, v.pageId] });
      queryClient.invalidateQueries({ queryKey: [LIST_KEY, v.pageId] });
    },
    onError: (e) => showError(e, t("Failed to add permission")),
  });
}

export function useUpdatePagePermissionRoleMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IPagePermissionInfo, Error, IUpdatePagePermissionRole>({
    mutationFn: (data) => updatePagePermissionRole(data),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: [LIST_KEY, v.pageId] });
    },
    onError: (e) => showError(e, t("Failed to update role")),
  });
}

export function useRemovePagePermissionMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation<IPagePermissionInfo, Error, IRemovePagePermission>({
    mutationFn: (data) => removePagePermission(data),
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: [INFO_KEY, v.pageId] });
      queryClient.invalidateQueries({ queryKey: [LIST_KEY, v.pageId] });
    },
    onError: (e) => showError(e, t("Failed to remove permission")),
  });
}
