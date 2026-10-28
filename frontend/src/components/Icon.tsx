import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Feather>['name'];

/** Feather line icons: thin, friendly, and consistent across the app. */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export function isIconName(name: string | null | undefined): name is IconName {
  return !!name && name in Feather.glyphMap;
}
