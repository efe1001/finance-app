export type AvatarPreset = { id: string; emoji: string; bg: string };

// A built-in gallery so users get a distinctive profile picture without
// needing to upload one - rendered locally (no image assets, no network
// round trip), so picking one is instant.
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'fox', emoji: '🦊', bg: '#E2A33B' },
  { id: 'lion', emoji: '🦁', bg: '#D97706' },
  { id: 'wolf', emoji: '🐺', bg: '#64748B' },
  { id: 'panda', emoji: '🐼', bg: '#1F2937' },
  { id: 'owl', emoji: '🦉', bg: '#7C3AED' },
  { id: 'tiger', emoji: '🐯', bg: '#EA580C' },
  { id: 'dragon', emoji: '🐉', bg: '#059669' },
  { id: 'unicorn', emoji: '🦄', bg: '#DB2777' },
  { id: 'astronaut', emoji: '🧑‍🚀', bg: '#1D4ED8' },
  { id: 'robot', emoji: '🤖', bg: '#334155' },
  { id: 'alien', emoji: '👽', bg: '#16A34A' },
  { id: 'ghost', emoji: '👻', bg: '#475569' },
  { id: 'shark', emoji: '🦈', bg: '#0369A1' },
  { id: 'octopus', emoji: '🐙', bg: '#9333EA' },
  { id: 'phoenix', emoji: '🔥', bg: '#DC2626' },
  { id: 'crystal', emoji: '💎', bg: '#0891B2' },
];

export function avatarPresetById(id?: string | null): AvatarPreset {
  return AVATAR_PRESETS.find(p => p.id === id) ?? AVATAR_PRESETS[0];
}
