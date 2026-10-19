import api from "@/lib/api-client";
import { IAuditLog } from "@/features/audit/types/audit.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export interface IAuditFilters {
  query?: string;
  event?: string;
  resourceType?: string;
  resourceId?: string;
}

export async function getAuditLogs(
  params?: QueryParams & IAuditFilters,
): Promise<IPagination<IAuditLog>> {
  const req = await api.post("/audit", { ...params });
  return req.data;
}

export async function exportAuditCsv(filters?: IAuditFilters): Promise<Blob> {
  const res = await api.post(
    "/audit/export",
    { ...filters },
    { responseType: "blob" },
  );
  // api interceptor returns response.data (the Blob) for non-exempt endpoints
  return res as unknown as Blob;
}
