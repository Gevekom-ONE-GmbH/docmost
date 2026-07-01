import { Group, Text, Switch } from "@mantine/core";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";

/**
 * Clean-room (non-EE) toggle to allow viewers (readers) to comment on pages in
 * a space. Backend + enforcement live in the AGPL core (space.service writes
 * settings.comments.allowViewerComments; page-access.service enforces it).
 */
export default function SpaceViewerCommentsToggle({ space }: { space: ISpace }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(
    space.settings?.comments?.allowViewerComments === true,
  );
  const updateSpaceMutation = useUpdateSpaceMutation();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      await updateSpaceMutation.mutateAsync({
        spaceId: space.id,
        allowViewerComments: value,
      });
      setChecked(value);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Allow viewers to comment")}</Text>
        <Text size="sm" c="dimmed">
          {t("Allow viewers to add comments on pages in this space.")}
        </Text>
      </div>
      <Switch
        checked={checked}
        onChange={handleChange}
        aria-label={t("Toggle viewer comments")}
      />
    </Group>
  );
}
