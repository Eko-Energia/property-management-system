import type { Database } from '@/lib/database.types';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type Item = Tables['items']['Row'];
export type Consumable = Tables['consumables']['Row'];
export type Location = Tables['locations']['Row'];
export type Category = Tables['categories']['Row'];
export type InventoryEvent = Tables['events']['Row'];
export type EventConsumable = Tables['event_consumables']['Row'];
export type ShoppingItem = Tables['shopping_list']['Row'];
export type Profile = Tables['profiles']['Row'];
export type ActivityEntry = Tables['activity_log']['Row'];

export type ItemStatus = Enums['item_status'];
export type EventStatus = Enums['event_status'];
export type ShoppingStatus = Enums['shopping_status'];
export type UserRole = Enums['user_role'];

export type LookupResult = Database['public']['Functions']['lookup_code']['Returns'][number];

export type DashboardStats = {
  items: number;
  items_out: number;
  items_problem: number;
  consumables: number;
  low_stock: number;
  active_events: number;
  open_purchases: number;
  purchases_cost: number;
};
