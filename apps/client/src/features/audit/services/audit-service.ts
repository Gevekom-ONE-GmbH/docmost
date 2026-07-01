import api from "@/lib/api-client";
import { IAuditLog } from "@/features/audit/types/audit.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export async function getAuditLogs(
  params?: QueryParams,
): Promise<IPagination<IAuditLog>> {
  const req = await api.post("/audit", { ...params });
  return req.data;
}
