import { createClient } from '@supabase/supabase-js';

// Definicje typów dla bazy danych na podstawie specyfikacji tabel
export interface DatabaseEvent {
  id: number;
  name: string;
  start_date: string;
  is_active: boolean;
}

export interface DatabaseLocation {
  id: number;
  name: string;
  type: 'permanent' | 'event_box';
  event_id: number | null;
  room: string | null;
  responsible_person: string | null;
}

export interface DatabaseCategory {
  id: number;
  name: string;
  code: string;
}

export interface DatabaseItem {
  id: string; // SKU code format (e.g. I-EL-0001)
  name: string;
  location_id: number;
  responsible_person: string;
  shop_link: string;
  status: 'in_workshop' | 'assigned_to_event' | 'packed';
  category_id?: number | null;
  barcode?: string | null;
}

export interface DatabaseConsumable {
  id: string; // SKU code format (e.g. C-NA-0002)
  name: string;
  quantity_stored: number;
  min_quantity: number;
  shop_link: string;
  location_id: number | null;
  responsible_person: string | null;
  category_id?: number | null;
  barcode?: string | null;
}

export interface DatabaseEventConsumable {
  id: number;
  consumable_id: string; // references DatabaseConsumable.id (SKU)
  location_id: number; // ID skrzyni
  quantity_packed: number;
  quantity_required: number;
  responsible_person: string | null;
}

export interface DatabaseShoppingListItem {
  id: number;
  name: string;
  type: 'item' | 'consumable';
  quantity: number;
  shop_link: string | null;
  price_estimate: number | null;
  suggested_by: string | null;
  status: 'pending' | 'ordered' | 'received';
  category_id?: number | null;
}

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: DatabaseCategory;
        Insert: Omit<DatabaseCategory, 'id'>;
        Update: Partial<DatabaseCategory>;
      };
      events: {
        Row: DatabaseEvent;
        Insert: Omit<DatabaseEvent, 'id'>;
        Update: Partial<DatabaseEvent>;
      };
      locations: {
        Row: DatabaseLocation;
        Insert: Omit<DatabaseLocation, 'id'>;
        Update: Partial<DatabaseLocation>;
      };
      items: {
        Row: DatabaseItem;
        Insert: Omit<DatabaseItem, 'id'>;
        Update: Partial<DatabaseItem>;
      };
      consumables: {
        Row: DatabaseConsumable;
        Insert: Omit<DatabaseConsumable, 'id'>;
        Update: Partial<DatabaseConsumable>;
      };
      event_consumables: {
        Row: DatabaseEventConsumable;
        Insert: Omit<DatabaseEventConsumable, 'id'>;
        Update: Partial<DatabaseEventConsumable>;
      };
      shopping_list: {
        Row: DatabaseShoppingListItem;
        Insert: Omit<DatabaseShoppingListItem, 'id'>;
        Update: Partial<DatabaseShoppingListItem>;
      };
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-supabase-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);
