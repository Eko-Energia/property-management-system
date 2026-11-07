// Shape follows `supabase gen types typescript`. Regenerate after schema changes:
//   Supabase MCP generate_typescript_types, or: npx supabase gen types typescript --project-id <id>
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ItemRow = {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  location_id: number | null;
  home_location_id: number | null;
  responsible_id: string | null;
  shop_link: string | null;
  status: Database['public']['Enums']['item_status'];
  barcode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ConsumableRow = {
  id: number;
  sku: string;
  name: string;
  quantity_stored: number;
  min_quantity: number;
  unit: string;
  category_id: number | null;
  location_id: number | null;
  responsible_id: string | null;
  shop_link: string | null;
  barcode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type EventConsumableRow = {
  id: number;
  box_id: number;
  consumable_id: number;
  quantity_required: number;
  quantity_packed: number;
  quantity_returned: number | null;
  created_at: string;
};

type EventRow = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  place: string | null;
  notes: string | null;
  status: Database['public']['Enums']['event_status'];
  created_at: string;
  closed_at: string | null;
};

type ShoppingRow = {
  id: number;
  name: string;
  kind: Database['public']['Enums']['shopping_kind'];
  quantity: number;
  shop_link: string | null;
  price_estimate: number | null;
  status: Database['public']['Enums']['shopping_status'];
  category_id: number | null;
  consumable_id: number | null;
  requested_by: string | null;
  is_auto: boolean;
  notes: string | null;
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; role: Database['public']['Enums']['user_role']; created_at: string };
        Insert: { id: string; display_name: string; role?: Database['public']['Enums']['user_role']; created_at?: string };
        Update: { display_name?: string; role?: Database['public']['Enums']['user_role'] };
        Relationships: [];
      };
      app_settings: {
        Row: { id: boolean; join_code: string };
        Insert: { id?: boolean; join_code: string };
        Update: { join_code?: string };
        Relationships: [];
      };
      categories: {
        Row: { id: number; name: string; code: string };
        Insert: { id?: number; name: string; code: string };
        Update: { name?: string; code?: string };
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: Optional<EventRow, 'id' | 'start_date' | 'end_date' | 'place' | 'notes' | 'status' | 'created_at' | 'closed_at'>;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      locations: {
        Row: {
          id: number;
          name: string;
          kind: Database['public']['Enums']['location_kind'];
          event_id: number | null;
          room: string | null;
          responsible_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          kind: Database['public']['Enums']['location_kind'];
          event_id?: number | null;
          room?: string | null;
          responsible_id?: string | null;
        };
        Update: {
          name?: string;
          kind?: Database['public']['Enums']['location_kind'];
          event_id?: number | null;
          room?: string | null;
          responsible_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: 'locations_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
          { foreignKeyName: 'locations_responsible_id_fkey'; columns: ['responsible_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      items: {
        Row: ItemRow;
        Insert: Optional<ItemRow, 'id' | 'sku' | 'category_id' | 'location_id' | 'home_location_id' | 'responsible_id' | 'shop_link' | 'status' | 'barcode' | 'notes' | 'created_at' | 'updated_at'>;
        Update: Partial<ItemRow>;
        Relationships: [
          { foreignKeyName: 'items_location_id_fkey1'; columns: ['location_id']; isOneToOne: false; referencedRelation: 'locations'; referencedColumns: ['id'] },
          { foreignKeyName: 'items_home_location_id_fkey'; columns: ['home_location_id']; isOneToOne: false; referencedRelation: 'locations'; referencedColumns: ['id'] },
          { foreignKeyName: 'items_category_id_fkey1'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'items_responsible_id_fkey'; columns: ['responsible_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      consumables: {
        Row: ConsumableRow;
        Insert: Optional<ConsumableRow, 'id' | 'sku' | 'quantity_stored' | 'min_quantity' | 'unit' | 'category_id' | 'location_id' | 'responsible_id' | 'shop_link' | 'barcode' | 'notes' | 'created_at' | 'updated_at'>;
        Update: Partial<ConsumableRow>;
        Relationships: [
          { foreignKeyName: 'consumables_location_id_fkey1'; columns: ['location_id']; isOneToOne: false; referencedRelation: 'locations'; referencedColumns: ['id'] },
          { foreignKeyName: 'consumables_category_id_fkey1'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'consumables_responsible_id_fkey'; columns: ['responsible_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      event_consumables: {
        Row: EventConsumableRow;
        Insert: Optional<EventConsumableRow, 'id' | 'quantity_required' | 'quantity_packed' | 'quantity_returned' | 'created_at'>;
        Update: Partial<EventConsumableRow>;
        Relationships: [
          { foreignKeyName: 'event_consumables_box_fk'; columns: ['box_id']; isOneToOne: false; referencedRelation: 'locations'; referencedColumns: ['id'] },
          { foreignKeyName: 'event_consumables_consumable_fk'; columns: ['consumable_id']; isOneToOne: false; referencedRelation: 'consumables'; referencedColumns: ['id'] },
        ];
      };
      shopping_list: {
        Row: ShoppingRow;
        Insert: Optional<ShoppingRow, 'id' | 'quantity' | 'shop_link' | 'price_estimate' | 'status' | 'category_id' | 'consumable_id' | 'requested_by' | 'is_auto' | 'notes' | 'created_at' | 'ordered_at' | 'received_at'>;
        Update: Partial<ShoppingRow>;
        Relationships: [
          { foreignKeyName: 'shopping_list_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'shopping_list_consumable_id_fkey'; columns: ['consumable_id']; isOneToOne: false; referencedRelation: 'consumables'; referencedColumns: ['id'] },
          { foreignKeyName: 'shopping_list_requested_by_fkey'; columns: ['requested_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
      activity_log: {
        Row: {
          id: number;
          at: string;
          actor_id: string | null;
          table_name: string;
          row_id: string;
          action: 'INSERT' | 'UPDATE' | 'DELETE';
          context: string | null;
          old_data: Json | null;
          new_data: Json | null;
        };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: 'activity_log_actor_id_fkey'; columns: ['actor_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      my_role: { Args: Record<string, never>; Returns: Database['public']['Enums']['user_role'] };
      is_member: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      join_club: { Args: { p_code: string }; Returns: Database['public']['Enums']['user_role'] };
      ensure_profile: { Args: Record<string, never>; Returns: Database['public']['Tables']['profiles']['Row'] };
      next_sku: { Args: { p_kind: string; p_category_id: number | null }; Returns: string };
      lookup_code: {
        Args: { p_code: string };
        Returns: {
          kind: 'item' | 'consumable';
          id: number;
          sku: string;
          name: string;
          barcode: string | null;
          item_status: Database['public']['Enums']['item_status'] | null;
          location_id: number | null;
          event_id: number | null;
        }[];
      };
      assign_label: { Args: { p_code: string; p_kind: string; p_id: number }; Returns: undefined };
      adjust_stock: { Args: { p_consumable_id: number; p_delta: number }; Returns: ConsumableRow };
      move_item_to_box: {
        Args: { p_item_id: number; p_box_id: number; p_status: Database['public']['Enums']['item_status']; p_force?: boolean };
        Returns: ItemRow;
      };
      unpack_item: { Args: { p_item_id: number }; Returns: ItemRow };
      return_item: { Args: { p_item_id: number; p_location_id?: number | null }; Returns: ItemRow };
      mark_item: { Args: { p_item_id: number; p_status: Database['public']['Enums']['item_status'] }; Returns: ItemRow };
      pack_consumable_into_box: {
        Args: { p_box_id: number; p_consumable_id: number; p_qty: number; p_required?: number | null };
        Returns: EventConsumableRow;
      };
      pack_consumable: { Args: { p_ec_id: number; p_delta: number }; Returns: EventConsumableRow };
      return_event_consumable: { Args: { p_ec_id: number; p_returned: number }; Returns: EventConsumableRow };
      delete_box: { Args: { p_box_id: number }; Returns: undefined };
      delete_event: { Args: { p_event_id: number }; Returns: undefined };
      close_event: { Args: { p_event_id: number; p_auto_return?: boolean }; Returns: EventRow };
      receive_purchase: {
        Args: { p_id: number; p_consumable_id?: number | null; p_location_id?: number | null; p_category_id?: number | null };
        Returns: ShoppingRow;
      };
      dashboard_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: {
      user_role: 'guest' | 'member' | 'admin';
      item_status: 'in_workshop' | 'assigned_to_event' | 'packed' | 'missing' | 'broken';
      location_kind: 'permanent' | 'event_box';
      event_status: 'planning' | 'active' | 'closed';
      shopping_kind: 'item' | 'consumable';
      shopping_status: 'pending' | 'ordered' | 'received' | 'cancelled';
    };
    CompositeTypes: { [_ in never]: never };
  };
};
