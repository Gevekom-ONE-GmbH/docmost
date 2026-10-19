import { Menu } from "@mantine/core";
import { IconShieldCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface PageVerificationMenuItemProps {
  pageId?: string;
  onClick: () => void;
}

/**
 * Clean-room (non-EE) "Verification" entry for the page header action menu.
 * Opens the page verification modal.
 */
export default function PageVerificationMenuItem({
  pageId,
  onClick,
}: PageVerificationMenuItemProps) {
  const { t } = useTranslation();
  if (!pageId) return null;

  return (
    <Menu.Item leftSection={<IconShieldCheck size={16} />} onClick={onClick}>
      {t("Verification")}
    </Menu.Item>
  );
}
