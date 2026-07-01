import { Badge, Table, Text } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName } from "@/lib/config.ts";
import { formattedDate } from "@/lib/time.ts";
import { useVerificationListQuery } from "@/features/page-verification/queries/page-verification-query";

const STATUS_COLOR: Record<string, string> = {
  verified: "green",
  expiring: "yellow",
  expired: "red",
  in_approval: "blue",
  draft: "gray",
  obsolete: "gray",
  none: "gray",
};

export default function VerifiedPages() {
  const { t } = useTranslation();
  const { data, isLoading } = useVerificationListQuery();

  return (
    <>
      <Helmet>
        <title>
          {t("Verified pages")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Verified pages")} />

      {isLoading ? (
        <Text c="dimmed" size="sm">
          {t("Loading...")}
        </Text>
      ) : !data || data.items.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("No verified pages yet.")}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={700}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Page")}</Table.Th>
                <Table.Th>{t("Space")}</Table.Th>
                <Table.Th>{t("Type")}</Table.Th>
                <Table.Th>{t("Status")}</Table.Th>
                <Table.Th>{t("Expires")}</Table.Th>
                <Table.Th>{t("Verifiers")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((v) => (
                <Table.Tr key={v.id}>
                  <Table.Td>{v.page?.title ?? "—"}</Table.Td>
                  <Table.Td>{v.space?.name ?? "—"}</Table.Td>
                  <Table.Td>
                    {v.type === "qms" ? t("QMS") : t("Expiring")}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLOR[v.status] ?? "gray"} variant="light">
                      {t(v.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {v.expiresAt ? formattedDate(new Date(v.expiresAt)) : "—"}
                  </Table.Td>
                  <Table.Td>
                    {v.verifiers?.length
                      ? v.verifiers.map((u) => u.name).join(", ")
                      : "—"}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
