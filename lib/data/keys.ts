export const qk = {
  me: ['me'] as const,
  profiles: ['profiles'] as const,
  items: ['items'] as const,
  consumables: ['consumables'] as const,
  locations: ['locations'] as const,
  categories: ['categories'] as const,
  events: ['events'] as const,
  eventConsumables: ['event_consumables'] as const,
  shopping: ['shopping'] as const,
  stats: ['stats'] as const,
  activity: ['activity'] as const,
  settings: ['settings'] as const,
};

/** Which cached queries a change in a given table makes stale. */
export const TABLE_KEYS: Record<string, readonly (readonly string[])[]> = {
  items: [qk.items, qk.stats],
  consumables: [qk.consumables, qk.stats],
  locations: [qk.locations],
  categories: [qk.categories],
  events: [qk.events, qk.stats],
  event_consumables: [qk.eventConsumables],
  shopping_list: [qk.shopping, qk.stats],
  activity_log: [qk.activity],
  profiles: [qk.profiles, qk.me],
};
