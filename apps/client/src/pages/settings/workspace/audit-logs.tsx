import { useState } from "react";
import { Badge, Button, Group, Table, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconDownload, IconSearch } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import { useAuditLogsInfiniteQuery } from "@/features/audit/queries/audit-query";
import { exportAuditCsv } from "@/features/audit/services/audit-service";
import { formattedDate } from "@/lib/time.ts";

function humanize(value: string): string {
  return value.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 400);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAuditLogsInfiniteQuery(debounced || undefined);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportAuditCsv(debounced || undefined);
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

      <Group justify="space-between" mb="md">
        <TextInput
          placeholder={t("Search event, resource, actor or IP")}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={320}
        />
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          loading={exporting}
        >
          {t("Export CSV")}
        </Button>
      </Group>

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
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("Event")}</Table.Th>
                  <Table.Th>{t("Resource")}</Table.Th>
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
                    <Table.Td>{humanize(log.resourceType)}</Table.Td>
                    <Table.Td>
                      {log.actor?.name ?? (
                        <Text span c="dimmed">
                          {t("System")}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>{log.ipAddress ?? "—"}</Table.Td>
                    <Table.Td>
                      {formattedDate(new Date(log.createdAt))}
                    </Table.Td>
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
