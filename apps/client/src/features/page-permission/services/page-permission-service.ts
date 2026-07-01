import api from "@/lib/api-client";
import {
  IAddPagePermission,
  IPagePermissionInfo,
  IPagePermissionMember,
  IRemovePagePermission,
  IUpdatePagePermissionRole,
} from "@/features/page-permission/types/page-permission.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getPagePermissionInfo(
  pageId: string,
): Promise<IPagePermissionInfo> {
  const req = await api.post("/pages/permission-info", { pageId });
  return req.data;
}

export async function getPagePermissions(
  pageId: string,
  params?: QueryParams,
): Promise<IPagination<IPagePermissionMember>> {
  const req = await api.post("/pages/permissions", { pageId, ...params });
  return req.data;
}

export async function restrictPage(
  pageId: string,
): Promise<IPagePermissionInfo> {
  const req = await api.post("/pages/restrict", { pageId });
  return req.data;
}

export async function removePageRestriction(
  pageId: string,
): Promise<IPagePermissionInfo> {
  const req = await api.post("/pages/remove-restriction", { pageId });
  return req.data;
}

export async function addPagePermission(
  data: IAddPagePermission,
): Promise<IPagePermissionInfo> {
  const req = await api.post("/pages/add-permission", data);
  return req.data;
}

export async function updatePagePermissionRole(
  data: IUpdatePagePermissionRole,
): Promise<IPagePermissionInfo> {
  const req = await api.post("/pages/update-permission", data);
  return req.data;
}

export async function removePagePermission(
  data: IRemovePagePermission,
): Promise<IPagePermissionInfo> {
  const req = await api.post("/pages/remove-permission", data);
  return req.data;
}
