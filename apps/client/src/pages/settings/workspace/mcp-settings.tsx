import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Code,
  Group,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { CopyButton } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { getAppName, getAppUrl } from "@/lib/config.ts";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";

export default function McpSettings() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [enabled, setEnabled] = useState<boolean>(
    !!workspace?.settings?.ai?.mcp,
  );
  const [saving, setSaving] = useState(false);
  const mcpUrl = `${getAppUrl()}/mcp`;

  const handleToggle = async (value: boolean) => {
    setEnabled(value);
    setSaving(true);
    try {
      const updated = await updateWorkspace({ mcpEnabled: value } as any);
      setWorkspace(updated as any);
    } catch (err) {
      setEnabled(!value);
      notifications.show({
        message:
          (err as any)?.response?.data?.message ??
          t("Failed to update setting"),
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {t("MCP")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("MCP server")} />

      <Stack>
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text fw={500}>{t("Enable MCP server")}</Text>
            <Text size="sm" c="dimmed">
              {t(
                "Let external AI assistants and tools access this workspace over the Model Context Protocol.",
              )}
            </Text>
          </div>
          <Switch
            checked={enabled}
            disabled={saving}
            onChange={(e) => handleToggle(e.currentTarget.checked)}
          />
        </Group>

        <div>
          <Text fw={500} size="sm" mb={4}>
            {t("Server URL")}
          </Text>
          <Group wrap="nowrap">
            <Code style={{ flex: 1 }}>{mcpUrl}</Code>
            <CopyButton value={mcpUrl}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t("Copied") : t("Copy")} withArrow>
                  <ActionIcon variant="subtle" onClick={copy} aria-label={t("Copy")}>
                    {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </div>

        <Alert color="blue" variant="light">
          <Text size="sm">
            {t(
              "Authenticate with an API key (Bearer token). Create one under",
            )}{" "}
            <Anchor component={Link} to="/settings/account/api-keys">
              {t("Account → API keys")}
            </Anchor>
            .
          </Text>
          <Text size="sm" mt="xs">
            {t(
              "Tools: search_pages, get_page, list_spaces (read) and create_page, update_page (write). Write tools can be disabled server-side via the MCP_ALLOW_WRITE=false environment variable.",
            )}
          </Text>
        </Alert>
      </Stack>
    </>
  );
}
