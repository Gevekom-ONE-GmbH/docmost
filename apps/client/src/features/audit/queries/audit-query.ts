import { useInfiniteQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/features/audit/services/audit-service";

export function useAuditLogsInfiniteQuery(query?: string) {
  return useInfiniteQuery({
    queryKey: ["audit-logs", query ?? ""],
    queryFn: ({ pageParam }) =>
      getAuditLogs({ limit: 50, query, cursor: pageParam as string }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasNextPage
        ? (lastPage.meta.nextCursor ?? undefined)
        : undefined,
  });
}
