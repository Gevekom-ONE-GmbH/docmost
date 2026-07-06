import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconDownload, IconFilter, IconSearch, IconX } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import { useAuditLogsInfiniteQuery } from "@/features/audit/queries/audit-query";
import { exportAuditCsv } from "@/features/audit/services/audit-service";
import { IAuditLog } from "@/features/audit/types/audit.types";
import { formattedDate } from "@/lib/time.ts";

function humanize(value: string): string {
  return value.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const RESOURCE_TYPES = [
  "page",
  "space",
  "user",
  "comment",
  "group",
  "workspace",
  "attachment",
  "share",
  "api_key",
];

/** Short human hint about which resource an entry concerns. */
function details(log: IAuditLog): string {
  const m = log.metadata ?? {};
  const parts: string[] = [];
  if (m.path) parts.push(m.path);
  else if (m.title) parts.push(m.title);
  if (typeof m.descendantCount === "number" && m.descendantCount > 0)
    parts.push(`(+${m.descendantCount} subpages)`);
  if (m.reason) parts.push(`· ${m.reason}`);
  if (m.pageCount != null) parts.push(`${m.pageCount} pages`);
  return parts.join(" ");
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 400);
  const [resourceType, setResourceType] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = {
    query: debounced || undefined,
    resourceType: resourceType || undefined,
    resourceId: resourceId || undefined,
  };

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAuditLogsInfiniteQuery(filters);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportAuditCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-log.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notifications.show({ message: t("Export failed"), color: "red" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {t("Audit log")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Audit log")} />

      <Group justify="space-between" mb="xs" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          <TextInput
            placeholder={t("Search event, resource, actor or IP")}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={280}
          />
          <Select
            placeholder={t("All resource types")}
            data={RESOURCE_TYPES.map((r) => ({ value: r, label: humanize(r) }))}
            value={resourceType}
            onChange={setResourceType}
            clearable
            w={190}
            comboboxProps={{ withinPortal: true }}
          />
        </Group>
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          loading={exporting}
        >
          {t("Export CSV")}
        </Button>
      </Group>

      {resourceId && (
        <Group gap="xs" mb="md">
          <Badge
            variant="light"
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                onClick={() => setResourceId(null)}
                aria-label={t("Clear filter")}
              >
                <IconX size={12} />
              </ActionIcon>
            }
          >
            {t("Resource id")}: {resourceId}
          </Badge>
        </Group>
      )}

      {isLoading ? (
        <Text c="dimmed" size="sm">
          {t("Loading...")}
        </Text>
      ) : items.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("No audit events found.")}
        </Text>
      ) : (
        <>
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("Event")}</Table.Th>
                  <Table.Th>{t("Resource")}</Table.Th>
                  <Table.Th>{t("Details")}</Table.Th>
                  <Table.Th>{t("Actor")}</Table.Th>
                  <Table.Th>{t("IP address")}</Table.Th>
                  <Table.Th>{t("Date")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>
                      <Badge variant="light" color="blue">
                        {humanize(log.event)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        {humanize(log.resourceType)}
                        {log.resourceId && (
                          <Tooltip
                            label={t("Show all events for this resource")}
                            withArrow
                          >
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              onClick={() => {
                                setResourceId(log.resourceId);
                                setResourceType(log.resourceType);
                              }}
                              aria-label={t("Filter by resource")}
                            >
                              <IconFilter size={13} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={1} maw={320}>
                        {details(log)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {log.actor?.name ?? (
                        <Text span c="dimmed">
                          {t("System")}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{log.ipAddress ?? "—"}</Table.Td>
                    <Table.Td>{formattedDate(new Date(log.createdAt))}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          {hasNextPage && (
            <Group justify="center" mt="md">
              <Button
                variant="subtle"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
              >
                {t("Load more")}
              </Button>
            </Group>
          )}
        </>
      )}
    </>
  );
}
