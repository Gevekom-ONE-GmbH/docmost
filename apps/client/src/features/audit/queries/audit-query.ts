import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getAuditLogs,
  IAuditFilters,
} from "@/features/audit/services/audit-service";

export function useAuditLogsInfiniteQuery(filters: IAuditFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["audit-logs", filters],
    queryFn: ({ pageParam }) =>
      getAuditLogs({ limit: 50, cursor: pageParam as string, ...filters }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage
        ? (lastPage.meta.nextCursor ?? undefined)
        : undefined,
  });
}
