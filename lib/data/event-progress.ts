import type { EventConsumable, Item, Location } from '@/lib/types';

export type EventProgress = {
  boxes: number;
  items: number;
  itemsPacked: number;
  consumableLines: number;
  consumablesDone: number;
  /** 0..1 over items + consumable lines */
  ratio: number;
};

/** Packing progress of one event, computed from cached tables. */
export function eventProgress(eventId: number, locations: Location[], items: Item[], ecs: EventConsumable[]): EventProgress {
  const boxIds = new Set(locations.filter((l) => l.kind === 'event_box' && l.event_id === eventId).map((l) => l.id));
  const eventItems = items.filter((i) => i.location_id != null && boxIds.has(i.location_id) && (i.status === 'assigned_to_event' || i.status === 'packed'));
  const lines = ecs.filter((ec) => boxIds.has(ec.box_id));
  const itemsPacked = eventItems.filter((i) => i.status === 'packed').length;
  const consumablesDone = lines.filter((ec) => ec.quantity_packed >= ec.quantity_required).length;
  const total = eventItems.length + lines.length;
  return {
    boxes: boxIds.size,
    items: eventItems.length,
    itemsPacked,
    consumableLines: lines.length,
    consumablesDone,
    ratio: total === 0 ? 0 : (itemsPacked + consumablesDone) / total,
  };
}
