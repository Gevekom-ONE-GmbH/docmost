import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  deleteVerification,
  getVerificationInfo,
  getVerifications,
  markObsolete,
  rejectApproval,
  setupVerification,
  submitForApproval,
  updateVerification,
  verifyPage,
} from "@/features/page-verification/services/page-verification-service";
import {
  IPageVerificationInfo,
  ISetupVerification,
  IVerificationListItem,
} from "@/features/page-verification/types/page-verification.types";
import { IPagination } from "@/lib/types.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const INFO_KEY = "page-verification-info";
const LIST_KEY = "page-verifications";

export function useVerificationInfoQuery(
  pageId: string,
  enabled = true,
): UseQueryResult<IPageVerificationInfo, Error> {
  return useQuery({
    queryKey: [INFO_KEY, pageId],
    queryFn: () => getVerificationInfo(pageId),
    enabled: !!pageId && enabled,
  });
}

export function useVerificationListQuery(
  params?: { spaceIds?: string[]; type?: string },
): UseQueryResult<IPagination<IVerificationListItem>, Error> {
  return useQuery({
    queryKey: [LIST_KEY, params],
    queryFn: () => getVerifications({ limit: 100, ...params }),
  });
}

function showError(err: unknown, fallback: string) {
  notifications.show({
    message: (err as any)?.response?.data?.message ?? fallback,
    color: "red",
  });
}

function useVerificationMutation<TVars>(
  fn: (vars: TVars) => Promise<IPageVerificationInfo>,
  fallbackError: string,
  successMsg?: string,
) {
  const queryClient = useQueryClient();
  return useMutation<IPageVerificationInfo, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [INFO_KEY, data.pageId] });
      queryClient.invalidateQueries({ queryKey: [LIST_KEY] });
      if (successMsg) notifications.show({ message: successMsg });
    },
    onError: (e) => showError(e, fallbackError),
  });
}

export function useSetupVerificationMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<ISetupVerification>(
    setupVerification,
    t("Failed to set up verification"),
    t("Verification saved"),
  );
}

export function useUpdateVerificationMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<ISetupVerification>(
    updateVerification,
    t("Failed to update verification"),
    t("Verification updated"),
  );
}

export function useRemoveVerificationMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<string>(
    deleteVerification,
    t("Failed to remove verification"),
    t("Verification removed"),
  );
}

export function useVerifyPageMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<string>(
    verifyPage,
    t("Failed to verify page"),
    t("Page verified"),
  );
}

export function useSubmitForApprovalMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<string>(
    submitForApproval,
    t("Failed to submit for approval"),
    t("Submitted for approval"),
  );
}

export function useRejectApprovalMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<{ pageId: string; comment?: string }>(
    ({ pageId, comment }) => rejectApproval(pageId, comment),
    t("Failed to reject"),
    t("Approval rejected"),
  );
}

export function useMarkObsoleteMutation() {
  const { t } = useTranslation();
  return useVerificationMutation<string>(
    markObsolete,
    t("Failed to mark obsolete"),
    t("Marked as obsolete"),
  );
}
