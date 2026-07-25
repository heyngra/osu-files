/** UUIDs of the six built-in osu!lazer skins. */
export const BUILT_IN_SKINS = {
  TRIANGLES: '2991cfd8-2140-469a-bcb9-2ec23fbce4ad',
  ARGON: 'cffa69de-b3e3-4dee-8563-3c4f425c05d0',
  ARGON_PRO: '9fc9cf5d-0f16-4c71-8256-98868321ac43',
  CLASSIC: '81f02cd3-eec6-4865-ac23-fae26a386187',
  RETRO: '0555c76a-cc6b-4bb4-9548-df76ba72ef25',
  RANDOM: 'd39dfefb-477c-4372-b1ea-2bcea5fb8908',
} as const

export const BUILT_IN_SKIN_IDS: readonly string[] = Object.values(BUILT_IN_SKINS)

/** Ordered list of built-in skin UUIDs for display. */
export const BUILT_IN_SKIN_ORDER: readonly string[] = [
  BUILT_IN_SKINS.ARGON,
  BUILT_IN_SKINS.ARGON_PRO,
  BUILT_IN_SKINS.TRIANGLES,
  BUILT_IN_SKINS.CLASSIC,
  BUILT_IN_SKINS.RETRO,
  BUILT_IN_SKINS.RANDOM,
]
