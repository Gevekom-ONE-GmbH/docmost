import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { MultiMemberSelect } from "@/features/space/components/multi-member-select.tsx";
import {
  useAddPagePermissionMutation,
  usePagePermissionInfoQuery,
  usePagePermissionsQuery,
  useRemovePageRestrictionMutation,
  useRemovePagePermissionMutation,
  useRestrictPageMutation,
  useUpdatePagePermissionRoleMutation,
} from "@/features/page-permission/queries/page-permission-query";
import { PagePermissionRole } from "@/features/page-permission/types/page-permission.types";

interface PagePermissionModalProps {
  pageId: string;
  opened: boolean;
  onClose: () => void;
}

export default function PagePermissionModal({
  pageId,
  opened,
  onClose,
}: PagePermissionModalProps) {
  const { t } = useTranslation();
  const { data: info, isLoading } = usePagePermissionInfoQuery(pageId);
  const restricted = !!info?.hasDirectRestriction;
  const { data: members } = usePagePermissionsQuery(pageId, restricted);

  const restrict = useRestrictPageMutation();
  const removeRestriction = useRemovePageRestrictionMutation();
  const addPerm = useAddPagePermissionMutation();
  const updateRole = useUpdatePagePermissionRoleMutation();
  const removePerm = useRemovePagePermissionMutation();

  const [selected, setSelected] = useState<string[]>([]);
  const [addRole, setAddRole] = useState<PagePermissionRole>(
    PagePermissionRole.READER,
  );

  const canManage = !!info?.userAccess?.canManage;
  const roleData = [
    { value: PagePermissionRole.READER, label: t("Can view") },
    { value: PagePermissionRole.WRITER, label: t("Can edit") },
  ];

  const handleGeneralAccessChange = (val: string) => {
    if (val === "restricted" && !restricted) restrict.mutate(pageId);
    else if (val === "open" && restricted) removeRestriction.mutate(pageId);
  };

  const handleAdd = () => {
    const userIds = selected
      .filter((v) => v.startsWith("user-"))
      .map((v) => v.slice("user-".length));
    const groupIds = selected
      .filter((v) => v.startsWith("group-"))
      .map((v) => v.slice("group-".length));
    if (userIds.length === 0 && groupIds.length === 0) return;
    addPerm.mutate(
      { pageId, userIds, groupIds, role: addRole },
      { onSuccess: () => setSelected([]) },
    );
  };

  const memberIds = (m: { type: string; id: string }) => ({
    userId: m.type === "user" ? m.id : undefined,
    groupId: m.type === "group" ? m.id : undefined,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Page permissions")}
      size="lg"
    >
      {isLoading ? (
        <Group justify="center" p="lg">
          <Loader size="sm" />
        </Group>
      ) : (
        <Stack>
          {!canManage && (
            <Alert color="gray">
              {t("You don't have permission to manage this page's access.")}
            </Alert>
          )}

          <div>
            <Text fw={500} size="sm" mb={4}>
              {t("General access")}
            </Text>
            <SegmentedControl
              fullWidth
              disabled={
                !canManage ||
                restrict.isPending ||
                removeRestriction.isPending
              }
              value={restricted ? "restricted" : "open"}
              onChange={handleGeneralAccessChange}
              data={[
                { label: t("Anyone with space access"), value: "open" },
                { label: t("Only specific people"), value: "restricted" },
              ]}
            />
            {info?.hasInheritedRestriction && !restricted && (
              <Text size="xs" c="dimmed" mt={6}>
                {t("This page inherits restrictions from a parent page.")}
              </Text>
            )}
          </div>

          {restricted && (
            <>
              {canManage && (
                <Group align="flex-end" wrap="nowrap">
                  <div style={{ flex: 1 }}>
                    <MultiMemberSelect
                      value={selected}
                      onChange={setSelected}
                    />
                  </div>
                  <Select
                    data={roleData}
                    value={addRole}
                    onChange={(v) =>
                      setAddRole((v as PagePermissionRole) ?? addRole)
                    }
                    allowDeselect={false}
                    w={130}
                    comboboxProps={{ withinPortal: true }}
                  />
                  <Button
                    onClick={handleAdd}
                    loading={addPerm.isPending}
                    disabled={selected.length === 0}
                  >
                    {t("Add")}
                  </Button>
                </Group>
              )}

              <Stack gap="xs">
                {members?.items?.map((m) => (
                  <Group key={m.type + m.id} justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      {m.type === "user" ? (
                        <CustomAvatar
                          avatarUrl={m.avatarUrl}
                          name={m.name}
                          size={28}
                        />
                      ) : (
                        <IconGroupCircle />
                      )}
                      <div>
                        <Text size="sm" lineClamp={1}>
                          {m.name}
                        </Text>
                        {m.type === "user" && m.email && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {m.email}
                          </Text>
                        )}
                        {m.type === "group" && (
                          <Text size="xs" c="dimmed">
                            {t("Group")}
                          </Text>
                        )}
                      </div>
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                      <Select
                        data={roleData}
                        value={m.role}
                        disabled={!canManage}
                        onChange={(v) =>
                          v &&
                          updateRole.mutate({
                            pageId,
                            ...memberIds(m),
                            role: v as PagePermissionRole,
                          })
                        }
                        allowDeselect={false}
                        w={120}
                        comboboxProps={{ withinPortal: true }}
                      />
                      {canManage && (
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={t("Remove")}
                          onClick={() =>
                            removePerm.mutate({ pageId, ...memberIds(m) })
                          }
                        >
                          <IconX size={18} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Group>
                ))}
                {members && members.items.length === 0 && (
                  <Text size="sm" c="dimmed">
                    {t("No one added yet.")}
                  </Text>
                )}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Modal>
  );
}
