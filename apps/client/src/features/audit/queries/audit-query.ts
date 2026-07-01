import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getAuditLogs } from "@/features/audit/services/audit-service";
import { IAuditLog } from "@/features/audit/types/audit.types";
import { IPagination, QueryParams } from "@/lib/types.ts";

export function useAuditLogsQuery(
  params?: QueryParams,
): UseQueryResult<IPagination<IAuditLog>, Error> {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => getAuditLogs(params),
  });
}
