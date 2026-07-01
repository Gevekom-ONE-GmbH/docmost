import { ActionIcon, Tooltip } from "@mantine/core";
import { IconShieldCheck } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { useVerificationInfoQuery } from "@/features/page-verification/queries/page-verification-query";
import PageVerificationModal from "@/features/page-verification/components/page-verification-modal";

const STATUS_COLOR: Record<string, string> = {
  verified: "green",
  expiring: "yellow",
  expired: "red",
  in_approval: "blue",
  draft: "gray",
  obsolete: "gray",
  none: "gray",
};

/**
 * Clean-room (non-EE) verification badge shown next to the page byline. Opens
 * the verification modal; colour reflects the current status.
 */
export default function PageVerificationBadge({
  readOnly,
}: {
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const pageId = page?.id;
  const [opened, { open, close }] = useDisclosure(false);
  const { data: info } = useVerificationInfoQuery(pageId ?? "", !!pageId);

  if (!pageId) return null;

  const status = info?.status ?? "none";
  // Readers only see the badge when the page actually has a verification.
  if (readOnly && status === "none") return null;

  const label =
    status === "none"
      ? t("Add verification")
      : t("Verification: {{status}}", { status: t(status) });

  return (
    <>
      <Tooltip label={label} openDelay={250} withArrow>
        <ActionIcon
          variant="subtle"
          color={STATUS_COLOR[status] ?? "gray"}
          onClick={open}
          aria-label={t("Page verification")}
        >
          <IconShieldCheck size={18} />
        </ActionIcon>
      </Tooltip>
      <PageVerificationModal
        pageId={pageId}
        opened={opened}
        onClose={close}
      />
    </>
  );
}
