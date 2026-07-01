import { ActionIcon, Button, Tooltip } from "@mantine/core";
import {
  IconAlertTriangle,
  IconArchive,
  IconClock,
  IconPencil,
  IconRosetteDiscountCheck,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { useVerificationInfoQuery } from "@/features/page-verification/queries/page-verification-query";
import PageVerificationModal from "@/features/page-verification/components/page-verification-modal";

const STATUS_META: Record<
  string,
  { color: string; label: string; Icon: typeof IconShieldCheck }
> = {
  verified: { color: "blue", label: "Verified", Icon: IconRosetteDiscountCheck },
  expiring: { color: "yellow", label: "Expiring soon", Icon: IconClock },
  expired: { color: "red", label: "Expired", Icon: IconAlertTriangle },
  in_approval: { color: "blue", label: "In approval", Icon: IconClock },
  draft: { color: "gray", label: "Draft", Icon: IconPencil },
  obsolete: { color: "gray", label: "Obsolete", Icon: IconArchive },
};

/**
 * Clean-room (non-EE) verification status pill shown next to the page byline.
 * Renders a coloured status pill when a verification exists, or a subtle
 * "add verification" shield otherwise. Opens the verification modal on click.
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

  const modal = (
    <PageVerificationModal pageId={pageId} opened={opened} onClose={close} />
  );

  if (status === "none") {
    // no verification yet — readers see nothing, editors see an "add" affordance
    if (readOnly) return null;
    return (
      <>
        <Tooltip label={t("Add verification")} openDelay={250} withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={open}
            aria-label={t("Page verification")}
          >
            <IconShieldCheck size={18} />
          </ActionIcon>
        </Tooltip>
        {modal}
      </>
    );
  }

  const meta = STATUS_META[status] ?? {
    color: "gray",
    label: status,
    Icon: IconShieldCheck,
  };
  const Icon = meta.Icon;

  return (
    <>
      <Button
        variant="light"
        color={meta.color}
        size="compact-sm"
        radius="xl"
        leftSection={<Icon size={16} />}
        onClick={open}
        aria-label={t("Page verification")}
      >
        {t(meta.label)}
      </Button>
      {modal}
    </>
  );
}
