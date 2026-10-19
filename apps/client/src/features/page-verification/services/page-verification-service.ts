import api from "@/lib/api-client";
import {
  IPageVerificationInfo,
  ISetupVerification,
  IVerificationListItem,
} from "@/features/page-verification/types/page-verification.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getVerificationInfo(
  pageId: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/verification-info", { pageId });
  return req.data;
}

export async function setupVerification(
  data: ISetupVerification,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/create-verification", data);
  return req.data;
}

export async function updateVerification(
  data: ISetupVerification,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/update-verification", data);
  return req.data;
}

export async function deleteVerification(
  pageId: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/delete-verification", { pageId });
  return req.data;
}

export async function verifyPage(
  pageId: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/verify", { pageId });
  return req.data;
}

export async function submitForApproval(
  pageId: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/submit-for-approval", { pageId });
  return req.data;
}

export async function rejectApproval(
  pageId: string,
  comment?: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/reject-approval", { pageId, comment });
  return req.data;
}

export async function markObsolete(
  pageId: string,
): Promise<IPageVerificationInfo> {
  const req = await api.post("/pages/mark-obsolete", { pageId });
  return req.data;
}

export async function getVerifications(
  params?: QueryParams & { spaceIds?: string[]; type?: string },
): Promise<IPagination<IVerificationListItem>> {
  const req = await api.post("/pages/verifications", { ...params });
  return req.data;
}
