import { Badge, Table, Text } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import { useAuditLogsQuery } from "@/features/audit/queries/audit-query";
import { formattedDate } from "@/lib/time.ts";

function humanize(value: string): string {
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogs() {
  const { t } = useTranslation();
  const { data, isLoading } = useAuditLogsQuery({ limit: 100 });

  return (
    <>
      <Helmet>
        <title>
          {t("Audit log")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Audit log")} />

      {isLoading ? (
        <Text c="dimmed" size="sm">
          {t("Loading...")}
        </Text>
      ) : !data || data.items.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("No audit events yet.")}
        </Text>
      ) : (
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
              {data.items.map((log) => (
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
                  <Table.Td>{formattedDate(new Date(log.createdAt))}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
