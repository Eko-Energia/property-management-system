'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase, DatabaseItem, DatabaseConsumable, DatabaseLocation } from '@/utils/supabase/client';
import SearchableSelect from '@/app/components/SearchableSelect';
import { 
  Package, 
  Boxes, 
  Search, 
  ExternalLink, 
  Plus, 
  Minus, 
  AlertCircle, 
  User, 
  QrCode,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Settings,
  ArrowUpDown
} from 'lucide-react';

export default function MagazynPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'consumables'>('items');
  const [items, setItems] = useState<DatabaseItem[]>([]);
  const [consumables, setConsumables] = useState<DatabaseConsumable[]>([]);
  const [locations, setLocations] = useState<DatabaseLocation[]>([]);
  
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Custom states for Web Haptics and Toast Notifications
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };
  
  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Synchronized Ref for thread-safe optimistic updates
  const consumablesRef = useRef<DatabaseConsumable[]>([]);
  useEffect(() => {
    consumablesRef.current = consumables;
  }, [consumables]);

  // Sorting state
  const [itemsSortKey, setItemsSortKey] = useState<'name' | 'room' | 'responsible' | 'status' | 'id'>('id');
  const [itemsSortDir, setItemsSortDir] = useState<'asc' | 'desc'>('asc');
  
  const [consSortKey, setConsSortKey] = useState<'name' | 'room' | 'responsible' | 'qty' | 'min_qty' | 'id'>('id');
  const [consSortDir, setConsSortDir] = useState<'asc' | 'desc'>('asc');

  // Scanner state
  const [scanIdInput, setScanIdInput] = useState<string>('');
  const [scanResult, setScanResult] = useState<
    | { type: 'item'; data: DatabaseItem; message?: string }
    | { type: 'consumable'; data: DatabaseConsumable; message?: string }
    | null
  >(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // --- CRUD States ---
  
  // 1. Locations modal
  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<DatabaseLocation | null>(null);
  const [newLocName, setNewLocName] = useState<string>('');
  const [newLocRoom, setNewLocRoom] = useState<string>('');
  const [newLocResponsible, setNewLocResponsible] = useState<string>('');

  // 2. Item modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DatabaseItem | null>(null); // null = add
  const [itemName, setItemName] = useState<string>('');
  const [itemResponsible, setItemResponsible] = useState<string>('');
  const [itemLink, setItemLink] = useState<string>('');
  const [itemLocId, setItemLocId] = useState<string>('');
  const [itemStatus, setItemStatus] = useState<'in_workshop' | 'assigned_to_event' | 'packed'>('in_workshop');

  // 3. Consumable modal
  const [isConsumableModalOpen, setIsConsumableModalOpen] = useState<boolean>(false);
  const [editingConsumable, setEditingConsumable] = useState<DatabaseConsumable | null>(null); // null = add
  const [consName, setConsName] = useState<string>('');
  const [consQty, setConsQty] = useState<number>(0);
  const [consMinQty, setConsMinQty] = useState<number>(0);
  const [consLink, setConsLink] = useState<string>('');
  const [consLocId, setConsLocId] = useState<string>('');
  const [consResponsible, setConsResponsible] = useState<string>('');

  // Fallback Mock Data
  const mockLocations: DatabaseLocation[] = [
    { id: 1, name: 'Szafa Główna A', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Bernie' },
    { id: 2, name: 'Regał z Elektroniką B', type: 'permanent', event_id: null, room: 'Pokój Projektowy 2', responsible_person: 'Kamil' },
    { id: 3, name: 'Szuflada Narzędziowa C', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Adam Kowalski' },
  ];

  const mockItems: DatabaseItem[] = [
    { id: 101, name: 'Dremel 4000', location_id: 1, responsible_person: 'Bernie', shop_link: 'https://dremel.pl', status: 'in_workshop' },
    { id: 102, name: 'Wkrętarka Makita 18V', location_id: 2, responsible_person: 'Jan Nowak', shop_link: 'https://makita.pl', status: 'assigned_to_event' },
    { id: 103, name: 'Lutownica TS101', location_id: 2, responsible_person: 'Kamil', shop_link: 'https://gotronik.pl', status: 'packed' },
    { id: 104, name: 'Zestaw kluczy płaskich', location_id: 3, responsible_person: 'Adam Kowalski', shop_link: 'https://sklep.pl', status: 'in_workshop' },
  ];

  const mockConsumables: DatabaseConsumable[] = [
    { id: 201, name: 'Frezy węglikowe 2mm', quantity_stored: 3, min_quantity: 10, shop_link: 'https://allegro.pl', location_id: 1, responsible_person: 'Bernie' },
    { id: 202, name: 'Cyna bezołowiowa Sn99', quantity_stored: 8, min_quantity: 5, shop_link: 'https://tme.eu', location_id: 2, responsible_person: 'Kamil' },
    { id: 203, name: 'Śruby M3x10 imbusowe (szt)', quantity_stored: 120, min_quantity: 200, shop_link: 'https://sruby.pl', location_id: 1, responsible_person: 'Bernie' },
    { id: 204, name: 'Opaski zaciskowe czarne (szt)', quantity_stored: 45, min_quantity: 100, shop_link: 'https://tme.eu', location_id: 3, responsible_person: 'Adam Kowalski' },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [locsRes, itemsRes, consRes] = await Promise.all([
        supabase.from('locations').select('*').eq('type', 'permanent'),
        supabase.from('items').select('*'),
        supabase.from('consumables').select('*')
      ]);

      if (locsRes.error || itemsRes.error || consRes.error) {
        throw new Error('Supabase fetch failed');
      }

      setLocations(locsRes.data || []);
      setItems(itemsRes.data || []);
      setConsumables(consRes.data || []);
      setIsDemoMode(false);
    } catch (err) {
      console.warn('Failed to load Supabase data, enabling mock mode:', err);
      setIsDemoMode(true);
      setLocations(mockLocations);
      setItems(mockItems);
      setConsumables(mockConsumables);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Location Picker Event handlers (Default Opiekun resolution) ---
  const handleItemLocChange = (locId: string) => {
    setItemLocId(locId);
    // Auto-fill responsible person if selected container has an owner and we're ADDING
    const loc = locations.find(l => l.id.toString() === locId);
    if (loc && loc.responsible_person && !editingItem) {
      setItemResponsible(loc.responsible_person);
    }
  };

  const handleConsLocChange = (locId: string) => {
    setConsLocId(locId);
    // Auto-fill responsible person if selected container has an owner and we're ADDING
    const loc = locations.find(l => l.id.toString() === locId);
    if (loc && loc.responsible_person && !editingConsumable) {
      setConsResponsible(loc.responsible_person);
    }
  };

  // --- Quantity Adjustment (Warehouse view) ---
  const handleQuantityChange = async (consumableId: number, currentQty: number, delta: number) => {
    const item = consumablesRef.current.find(c => c.id === consumableId);
    if (!item) return;

    const oldQty = Number(item.quantity_stored);
    const targetNewQty = Math.max(0, oldQty + delta);
    if (targetNewQty === oldQty) return;

    // 1. Sync ref immediately
    consumablesRef.current = consumablesRef.current.map(c =>
      c.id === consumableId ? { ...c, quantity_stored: targetNewQty } : c
    );

    // 2. Schedule React state update
    setConsumables(consumablesRef.current);

    // Trigger row flash / microinteraction
    setRecentlyUpdatedId(`cons-${consumableId}`);
    setTimeout(() => {
      setRecentlyUpdatedId(curr => curr === `cons-${consumableId}` ? null : curr);
    }, 1000);

    if (isDemoMode) {
      showToast(`Zaktualizowano stan: ${targetNewQty} szt. (Tryb Demo)`);
      setTimeout(() => {
        window.dispatchEvent(new Event('stock-updated'));
      }, 50);
      return;
    }

    try {
      const { error } = await supabase
        .from('consumables')
        .update({ quantity_stored: targetNewQty })
        .eq('id', consumableId);

      if (error) throw error;
      window.dispatchEvent(new Event('stock-updated'));
    } catch (err: any) {
      console.error(err);
      // Revert ref
      consumablesRef.current = consumablesRef.current.map(c =>
        c.id === consumableId ? { ...c, quantity_stored: oldQty } : c
      );
      // Revert React state
      setConsumables(consumablesRef.current);
      showToast(`Błąd zapisu: ${err.message || 'Brak połączenia'}`, 'error');
    }
  };

  // --- Location CRUD Handlers ---
  const startEditLocation = (loc: DatabaseLocation) => {
    setEditingLocation(loc);
    setNewLocName(loc.name);
    setNewLocRoom(loc.room || '');
    setNewLocResponsible(loc.responsible_person || '');
  };

  const cancelEditLocation = () => {
    setEditingLocation(null);
    setNewLocName('');
    setNewLocRoom('');
    setNewLocResponsible('');
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    setModalLoading(true);

    if (editingLocation) {
      // Edit mode
      const oldResponsible = editingLocation.responsible_person;
      const newResponsible = newLocResponsible.trim() || null;
      const oldRes = oldResponsible ? oldResponsible.trim() : '';
      const newRes = newResponsible ? newResponsible.trim() : '';

      if (isDemoMode) {
        setLocations(prev =>
          prev.map(l => l.id === editingLocation.id ? {
            ...l,
            name: newLocName.trim(),
            room: newLocRoom.trim() || null,
            responsible_person: newLocResponsible.trim() || null
          } : l)
        );

        if (oldRes !== newRes) {
          setItems(prev => prev.map(i =>
            (i.location_id === editingLocation.id && (i.responsible_person || '') === oldRes)
              ? { ...i, responsible_person: newRes }
              : i
          ));
          setConsumables(prev => prev.map(c =>
            (c.location_id === editingLocation.id && (c.responsible_person || '') === oldRes)
              ? { ...c, responsible_person: newRes }
              : c
          ));
        }

        cancelEditLocation();
        setModalLoading(false);
        showToast('Zaktualizowano pojemnik (Tryb Demo)');
        return;
      }

      try {
        const { error } = await supabase
          .from('locations')
          .update({
            name: newLocName.trim(),
            room: newLocRoom.trim() || null,
            responsible_person: newLocResponsible.trim() || null
          })
          .eq('id', editingLocation.id);

        if (error) throw error;

        // Cascade responsible person updates
        if (oldRes !== newRes) {
          // Update items in database
          const { error: itemsError } = await supabase
            .from('items')
            .update({ responsible_person: newRes })
            .eq('location_id', editingLocation.id)
            .eq('responsible_person', oldRes);
          
          if (itemsError) console.error('Błąd kaskady opiekuna dla przedmiotów:', itemsError);
          
          // Update consumables in database
          const { error: consError } = await supabase
            .from('consumables')
            .update({ responsible_person: newRes })
            .eq('location_id', editingLocation.id)
            .eq('responsible_person', oldRes);

          if (consError) console.error('Błąd kaskady opiekuna dla materiałów:', consError);
        }

        cancelEditLocation();
        const [locsRes, itemsRes, consRes] = await Promise.all([
          supabase.from('locations').select('*').eq('type', 'permanent'),
          supabase.from('items').select('*'),
          supabase.from('consumables').select('*')
        ]);
        setLocations(locsRes.data || []);
        setItems(itemsRes.data || []);
        setConsumables(consRes.data || []);
        showToast('Zaktualizowano pojemnik');
      } catch (err: any) {
        alert('Błąd podczas edycji pojemnika: ' + err.message);
      } finally {
        setModalLoading(false);
      }
    } else {
      // Create mode
      if (isDemoMode) {
        const newLoc: DatabaseLocation = {
          id: Date.now(),
          name: newLocName.trim(),
          type: 'permanent',
          event_id: null,
          room: newLocRoom.trim() || null,
          responsible_person: newLocResponsible.trim() || null
        };
        setLocations(prev => [...prev, newLoc]);
        cancelEditLocation();
        setModalLoading(false);
        showToast('Utworzono pojemnik (Tryb Demo)');
        return;
      }

      try {
        const { error } = await supabase
          .from('locations')
          .insert({
            name: newLocName.trim(),
            type: 'permanent',
            room: newLocRoom.trim() || null,
            responsible_person: newLocResponsible.trim() || null
          });

        if (error) throw error;

        cancelEditLocation();
        const locsRes = await supabase.from('locations').select('*').eq('type', 'permanent');
        setLocations(locsRes.data || []);
        showToast('Utworzono nowy pojemnik');
      } catch (err: any) {
        alert('Błąd podczas tworzenia szafy: ' + err.message);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const handleDeleteLocation = async (locId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę szafę? Przypisane do niej narzędzia oraz materiały stracą przypisanie szafy (zostaną wyczyszczone).')) {
      return;
    }

    setModalLoading(true);

    if (isDemoMode) {
      setLocations(prev => prev.filter(l => l.id !== locId));
      setItems(prev => prev.map(i => i.location_id === locId ? { ...i, location_id: null as any } : i));
      setConsumables(prev => prev.map(c => c.location_id === locId ? { ...c, location_id: null as any } : c));
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', locId);

      if (error) throw error;

      fetchData();
    } catch (err: any) {
      alert('Błąd usuwania lokalizacji: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- Item CRUD Handlers ---
  const openAddItemModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemResponsible('');
    setItemLink('');
    setItemLocId(locations.length > 0 ? locations[0].id.toString() : '');
    setItemStatus('in_workshop');
    
    // Auto-fill responsible person from default cabinet manager
    if (locations.length > 0 && locations[0].responsible_person) {
      setItemResponsible(locations[0].responsible_person);
    }
    
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: DatabaseItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemResponsible(item.responsible_person);
    setItemLink(item.shop_link || '');
    setItemLocId(item.location_id ? item.location_id.toString() : '');
    setItemStatus(item.status);
    setIsItemModalOpen(true);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemResponsible.trim()) return;

    setModalLoading(true);
    const parsedLocId = parseInt(itemLocId) || null;

    if (isDemoMode) {
      if (editingItem) {
        setItems(prev => prev.map(i => i.id === editingItem.id ? {
          ...i,
          name: itemName.trim(),
          responsible_person: itemResponsible.trim(),
          shop_link: itemLink.trim(),
          location_id: parsedLocId as any,
          status: itemStatus
        } : i));
      } else {
        const newItem: DatabaseItem = {
          id: Date.now(),
          name: itemName.trim(),
          responsible_person: itemResponsible.trim(),
          shop_link: itemLink.trim(),
          location_id: parsedLocId as any,
          status: itemStatus
        };
        setItems(prev => [...prev, newItem]);
      }
      setIsItemModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('items')
          .update({
            name: itemName.trim(),
            responsible_person: itemResponsible.trim(),
            shop_link: itemLink.trim(),
            location_id: parsedLocId,
            status: itemStatus
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('items')
          .insert({
            name: itemName.trim(),
            responsible_person: itemResponsible.trim(),
            shop_link: itemLink.trim(),
            location_id: parsedLocId,
            status: itemStatus
          });

        if (error) throw error;
      }

      setIsItemModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Błąd zapisu przedmiotu: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten przedmiot z inwentarza?')) return;

    setModalLoading(true);

    if (isDemoMode) {
      setItems(prev => prev.filter(i => i.id !== itemId));
      setIsItemModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
      setIsItemModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Błąd usuwania przedmiotu: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- Consumable CRUD Handlers ---
  const openAddConsumableModal = () => {
    setEditingConsumable(null);
    setConsName('');
    setConsQty(0);
    setConsMinQty(1);
    setConsLink('');
    setConsLocId(locations.length > 0 ? locations[0].id.toString() : '');
    setConsResponsible('');
    
    // Auto-fill responsible person from default cabinet manager
    if (locations.length > 0 && locations[0].responsible_person) {
      setConsResponsible(locations[0].responsible_person);
    }
    
    setIsConsumableModalOpen(true);
  };

  const openEditConsumableModal = (c: DatabaseConsumable) => {
    setEditingConsumable(c);
    setConsName(c.name);
    setConsQty(c.quantity_stored);
    setConsMinQty(c.min_quantity);
    setConsLink(c.shop_link || '');
    setConsLocId(c.location_id ? c.location_id.toString() : '');
    setConsResponsible(c.responsible_person || '');
    setIsConsumableModalOpen(true);
  };

  const handleConsumableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consName.trim() || consQty < 0 || consMinQty < 0) return;

    setModalLoading(true);
    const parsedLocId = parseInt(consLocId) || null;

    if (isDemoMode) {
      if (editingConsumable) {
        setConsumables(prev => prev.map(c => c.id === editingConsumable.id ? {
          ...c,
          name: consName.trim(),
          quantity_stored: consQty,
          min_quantity: consMinQty,
          shop_link: consLink.trim(),
          location_id: parsedLocId as any,
          responsible_person: consResponsible.trim() || null
        } : c));
      } else {
        const newCons: DatabaseConsumable = {
          id: Date.now(),
          name: consName.trim(),
          quantity_stored: consQty,
          min_quantity: consMinQty,
          shop_link: consLink.trim(),
          location_id: parsedLocId as any,
          responsible_person: consResponsible.trim() || null
        };
        setConsumables(prev => [...prev, newCons]);
      }
      setIsConsumableModalOpen(false);
      setModalLoading(false);
      setTimeout(() => {
        window.dispatchEvent(new Event('stock-updated'));
      }, 50);
      return;
    }

    try {
      if (editingConsumable) {
        const { error } = await supabase
          .from('consumables')
          .update({
            name: consName.trim(),
            quantity_stored: consQty,
            min_quantity: consMinQty,
            shop_link: consLink.trim(),
            location_id: parsedLocId,
            responsible_person: consResponsible.trim() || null
          })
          .eq('id', editingConsumable.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('consumables')
          .insert({
            name: consName.trim(),
            quantity_stored: consQty,
            min_quantity: consMinQty,
            shop_link: consLink.trim(),
            location_id: parsedLocId,
            responsible_person: consResponsible.trim() || null
          });

        if (error) throw error;
      }

      setIsConsumableModalOpen(false);
      window.dispatchEvent(new Event('stock-updated'));
      fetchData();
    } catch (err: any) {
      alert('Błąd zapisu materiału: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteConsumable = async (consId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten materiał zużywalny? Z bazy zostaną również usunięte żądania wyjazdowe tego materiału.')) return;

    setModalLoading(true);

    if (isDemoMode) {
      setConsumables(prev => prev.filter(c => c.id !== consId));
      setIsConsumableModalOpen(false);
      setModalLoading(false);
      setTimeout(() => {
        window.dispatchEvent(new Event('stock-updated'));
      }, 50);
      return;
    }

    try {
      const { error } = await supabase.from('consumables').delete().eq('id', consId);
      if (error) throw error;
      setIsConsumableModalOpen(false);
      window.dispatchEvent(new Event('stock-updated'));
      fetchData();
    } catch (err: any) {
      alert('Błąd usuwania materiału: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- Sort Helper Handlers ---
  const handleSortItems = (key: typeof itemsSortKey) => {
    if (itemsSortKey === key) {
      setItemsSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setItemsSortKey(key);
      setItemsSortDir('asc');
    }
  };

  const handleSortCons = (key: typeof consSortKey) => {
    if (consSortKey === key) {
      setConsSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setConsSortKey(key);
      setConsSortDir('asc');
    }
  };

  // --- Scanner Logic (Modified to open modal on scan success) ---
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanError(null);
    setScanResult(null);

    const rawInput = scanIdInput.trim();
    if (!rawInput) return;

    // Check for prefixes: I / C
    const itemMatch = rawInput.match(/^[iI](\d+)$/);
    const consMatch = rawInput.match(/^[cC](\d+)$/);

    let searchType: 'item' | 'consumable' | 'any' = 'any';
    let id: number;

    if (itemMatch) {
      searchType = 'item';
      id = parseInt(itemMatch[1]);
    } else if (consMatch) {
      searchType = 'consumable';
      id = parseInt(consMatch[1]);
    } else {
      id = parseInt(rawInput);
      if (isNaN(id)) {
        setScanError('Wpisz poprawne ID (np. 102) lub użyj prefixu (np. I102 dla sprzętu, C102 dla materiału).');
        return;
      }
    }

    // 1. Search in Items
    const scannedItem = (searchType === 'any' || searchType === 'item') 
      ? items.find(i => i.id === id) 
      : null;

    // 2. Search in Consumables
    const scannedCons = (searchType === 'any' || searchType === 'consumable') 
      ? consumables.find(c => c.id === id) 
      : null;

    // Handle collision when no prefix was supplied
    if (searchType === 'any' && scannedItem && scannedCons) {
      setScanError(`Kolizja ID: znaleziono sprzęt i materiał o ID ${id}. Wpisz I${id} dla sprzętu lub C${id} dla materiału.`);
      return;
    }

    if (scannedItem) {
      setScanResult({
        type: 'item',
        data: scannedItem,
        message: `Znalazłeś sprzęt trwały. Kliknij poniżej, aby otworzyć edycję.`
      });
      setScanIdInput('');
      return;
    }

    if (scannedCons) {
      setScanResult({
        type: 'consumable',
        data: scannedCons,
        message: `Znalazłeś materiał zużywalny. Kliknij poniżej, aby otworzyć edycję.`
      });
      setScanIdInput('');
      return;
    }

    setScanError(`Nie znaleziono kodu: ${rawInput} w magazynie.`);
  };

  const triggerScanEdit = () => {
    if (!scanResult) return;
    if (scanResult.type === 'item') {
      openEditItemModal(scanResult.data);
    } else {
      openEditConsumableModal(scanResult.data);
    }
    setScanResult(null);
  };

  // Helper to resolve location container details
  const getLocationDetails = (locId: number | null) => {
    if (!locId) return { name: 'Brak przypisania', room: null, responsible: null };
    const loc = locations.find(l => l.id === locId);
    return {
      name: loc ? loc.name : `Lokalizacja #${locId}`,
      room: loc ? loc.room : null,
      responsible: loc ? loc.responsible_person : null
    };
  };

  // Filter lists based on selected location & search query
  const filteredItems = items.filter(item => {
    const matchesLoc = selectedLocationId === 'all' || item.location_id === parseInt(selectedLocationId);
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.responsible_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.id.toString() === searchQuery.trim();
    return matchesLoc && matchesSearch;
  });

  const filteredConsumables = consumables.filter(cons => {
    const matchesLoc = selectedLocationId === 'all' || cons.location_id === parseInt(selectedLocationId);
    const matchesSearch = cons.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (cons.responsible_person || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cons.id.toString() === searchQuery.trim();
    return matchesLoc && matchesSearch;
  });

  // Sort lists
  const sortedItems = [...filteredItems].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';
    if (itemsSortKey === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (itemsSortKey === 'responsible') {
      valA = (a.responsible_person || '').toLowerCase();
      valB = (b.responsible_person || '').toLowerCase();
    } else if (itemsSortKey === 'status') {
      valA = a.status;
      valB = b.status;
    } else if (itemsSortKey === 'room') {
      const locA = locations.find(l => l.id === a.location_id);
      const locB = locations.find(l => l.id === b.location_id);
      valA = (locA?.room || '').toLowerCase();
      valB = (locB?.room || '').toLowerCase();
    } else {
      valA = a.id;
      valB = b.id;
    }
    if (valA < valB) return itemsSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return itemsSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const sortedConsumables = [...filteredConsumables].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';
    if (consSortKey === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (consSortKey === 'responsible') {
      valA = (a.responsible_person || '').toLowerCase();
      valB = (b.responsible_person || '').toLowerCase();
    } else if (consSortKey === 'qty') {
      valA = a.quantity_stored;
      valB = b.quantity_stored;
    } else if (consSortKey === 'min_qty') {
      valA = a.min_quantity;
      valB = b.min_quantity;
    } else if (consSortKey === 'room') {
      const locA = locations.find(l => l.id === a.location_id);
      const locB = locations.find(l => l.id === b.location_id);
      valA = (locA?.room || '').toLowerCase();
      valB = (locB?.room || '').toLowerCase();
    } else {
      valA = a.id;
      valB = b.id;
    }
    if (valA < valB) return consSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return consSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      {/* Header & CRUD Menu buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Magazyn Główny</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {isDemoMode ? 'Podgląd w trybie demonstracyjnym' : 'Bieżący wykaz sprzętu i stanów zużywalnych w warsztacie.'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'items' ? (
            <button
              onClick={openAddItemModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-black bg-blue-500 rounded-lg hover:bg-blue-400 active:scale-95 transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
              Dodaj Przedmiot
            </button>
          ) : (
            <button
              onClick={openAddConsumableModal}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-black bg-blue-500 rounded-lg hover:bg-blue-400 active:scale-95 transition-all duration-150"
            >
              <Plus className="h-4 w-4" />
              Dodaj Materiał
            </button>
          )}

          <button
            onClick={() => setIsLocationsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 transition-all duration-150"
          >
            <Settings className="h-4 w-4 text-zinc-400" />
            Zarządzaj Pojemnikami
          </button>
          
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Controls & Filters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Szukaj po nazwie, opiekunie lub ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            
            {/* Location Filter */}
            <div className="relative min-w-[200px]">
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors appearance-none"
              >
                <option value="all">Wszystkie pojemniki</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.room ? `(${loc.room})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-3 pointer-events-none border-l border-t border-zinc-500 h-2 w-2 transform rotate-135" />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-zinc-850 flex space-x-6">
            <button
              onClick={() => { setActiveTab('items'); setScanResult(null); }}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'items'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Package className="h-4.5 w-4.5" />
              Sprzęt Trwały ({filteredItems.length})
            </button>
            <button
              onClick={() => { setActiveTab('consumables'); setScanResult(null); }}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'consumables'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Boxes className="h-4.5 w-4.5" />
              Materiały Zużywalne ({filteredConsumables.length})
            </button>
          </div>

          {/* Dynamic Table Content */}
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden shadow-md">
            {loading ? (
              <div className="p-6 space-y-4">
                <div className="flex gap-4 border-b border-zinc-800 pb-3">
                  <div className="h-4 w-12 bg-zinc-800/80 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-zinc-800/80 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-zinc-800/80 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-zinc-800/80 rounded animate-pulse" />
                </div>
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex gap-4 items-center py-2.5 border-b border-zinc-850/30">
                    <div className="h-4 w-12 bg-zinc-850/60 rounded animate-pulse" />
                    <div className="h-4 w-1/4 bg-zinc-850/60 rounded animate-pulse" />
                    <div className="h-4 w-1/5 bg-zinc-850/60 rounded animate-pulse" />
                    <div className="h-4 w-1/6 bg-zinc-850/60 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : activeTab === 'items' ? (
              /* Items Table */
              sortedItems.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 space-y-2">
                  <Package className="h-10 w-10 mx-auto text-zinc-700 animate-pulse" />
                  <p className="font-semibold text-zinc-400">Brak sprzętu trwałego</p>
                  <p className="text-xs">Zmień filtry lub kryteria wyszukiwania.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 text-xs font-semibold uppercase tracking-wider select-none">
                        <th className="py-3 px-4 w-16 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortItems('id')}>
                          <div className="flex items-center gap-1">ID <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortItems('name')}>
                          <div className="flex items-center gap-1">Nazwa sprzętu <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortItems('room')}>
                          <div className="flex items-center gap-1">Pojemnik / Pokój <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortItems('responsible')}>
                          <div className="flex items-center gap-1">Opiekun <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortItems('status')}>
                          <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850 text-sm text-zinc-300">
                      {sortedItems.map(item => {
                        const statusColors = {
                          in_workshop: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
                          assigned_to_event: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                          packed: 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        };
                        const statusLabels = {
                          in_workshop: 'W warsztacie',
                          assigned_to_event: 'Przypisany',
                          packed: 'Spakowany'
                        };
                        const locDetails = getLocationDetails(item.location_id);

                        return (
                          <tr 
                            key={item.id} 
                            className="hover:bg-zinc-900/30 transition-colors duration-150"
                          >
                            <td className="py-3.5 px-4 font-mono text-xs text-zinc-500">#{item.id}</td>
                            <td className="py-3.5 px-4 font-semibold text-zinc-100">{item.name}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1 text-zinc-350 font-medium">
                                  <MapPin className="h-3.5 w-3.5 text-zinc-550 shrink-0" />
                                  {locDetails.name}
                                </span>
                                {locDetails.room && (
                                  <span className="text-[10px] text-zinc-500 ml-4.5">Pokój: {locDetails.room}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="flex items-center gap-1.5 text-zinc-400">
                                <User className="h-3.5 w-3.5 text-zinc-600" />
                                {item.responsible_person || 'Brak opiekuna'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status]}`}>
                                {statusLabels[item.status]}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditItemModal(item)}
                                  className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                                  title="Edytuj przedmiot"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                {item.shop_link && (
                                  <a
                                    href={item.shop_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-blue-450 hover:text-blue-355 hover:bg-zinc-700 transition-all"
                                    title="Strona sklepu"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* Consumables Table */
              sortedConsumables.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 space-y-2">
                  <Boxes className="h-10 w-10 mx-auto text-zinc-700 animate-pulse" />
                  <p className="font-semibold text-zinc-400">Brak materiałów zużywalnych</p>
                  <p className="text-xs">Zmień filtry lub kryteria wyszukiwania.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 text-xs font-semibold uppercase tracking-wider select-none">
                        <th className="py-3 px-4 w-16 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('id')}>
                          <div className="flex items-center gap-1">ID <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('name')}>
                          <div className="flex items-center gap-1">Nazwa materiału <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('room')}>
                          <div className="flex items-center gap-1">Pojemnik / Pokój <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('responsible')}>
                          <div className="flex items-center gap-1">Opiekun <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 text-center cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('qty')}>
                          <div className="flex items-center justify-center gap-1">Stan <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 text-center cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('min_qty')}>
                          <div className="flex items-center justify-center gap-1">Min. <ArrowUpDown className="h-3 w-3" /></div>
                        </th>
                        <th className="py-3 px-4 text-center">Szybka edycja</th>
                        <th className="py-3 px-4 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850 text-sm text-zinc-300">
                      {sortedConsumables.map(cons => {
                        const isLowStock = Number(cons.quantity_stored) < Number(cons.min_quantity);
                        const locDetails = getLocationDetails(cons.location_id);

                        return (
                          <tr 
                            key={cons.id} 
                            className={`transition-colors duration-500 hover:bg-zinc-900/30 ${
                              recentlyUpdatedId === `cons-${cons.id}` 
                                ? 'bg-blue-500/10' 
                                : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 font-mono text-xs text-zinc-500">#{cons.id}</td>
                            <td className="py-3.5 px-4 font-semibold text-zinc-100 flex items-center gap-2">
                              {cons.name}
                              {isLowStock && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <AlertCircle className="h-3 w-3" /> Kup
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col">
                                <span className="flex items-center gap-1 text-zinc-350 font-medium">
                                  <MapPin className="h-3.5 w-3.5 text-zinc-550 shrink-0" />
                                  {locDetails.name}
                                </span>
                                {locDetails.room && (
                                  <span className="text-[10px] text-zinc-500 ml-4.5">Pokój: {locDetails.room}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="flex items-center gap-1.5 text-zinc-400">
                                <User className="h-3.5 w-3.5 text-zinc-600" />
                                {cons.responsible_person || 'Brak opiekuna'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold">
                              <span className={isLowStock ? 'text-rose-400' : 'text-blue-400'}>
                                {cons.quantity_stored}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-zinc-500">{cons.min_quantity}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleQuantityChange(cons.id, Number(cons.quantity_stored), -1)}
                                  disabled={cons.quantity_stored === 0}
                                  className="p-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 active:scale-90 transition-transform duration-100 disabled:opacity-30"
                                  title="-1 sztuka"
                                >
                                  <Minus className="h-3 w-3 text-zinc-300" />
                                </button>
                                <button
                                  onClick={() => handleQuantityChange(cons.id, Number(cons.quantity_stored), 1)}
                                  className="p-1.5 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 active:scale-90 transition-transform duration-100 disabled:opacity-30"
                                  title="+1 sztuka"
                                >
                                  <Plus className="h-3 w-3 text-zinc-300" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditConsumableModal(cons)}
                                  className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                                  title="Edytuj materiał"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                {cons.shop_link && (
                                  <a
                                    href={cons.shop_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-blue-450 hover:text-blue-355 hover:bg-zinc-700 transition-all"
                                    title="Strona sklepu"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

        {/* Side Panel: QR Mock Scanner */}
        <div className="space-y-6">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-md">Skaner kodów</h3>
                <p className="text-zinc-500 text-xs mt-0.5">Skanuj kody, aby natychmiast edytować pozycje</p>
              </div>
            </div>

            <form onSubmit={handleScan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Wpisz ID przedmiotu
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="np. 101 lub 201"
                    value={scanIdInput}
                    onChange={(e) => setScanIdInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-black hover:bg-blue-400 font-semibold text-sm rounded-lg active:scale-95 transition-all duration-150"
                  >
                    Skanuj
                  </button>
                </div>
              </div>
            </form>

            {/* Scan Error Message */}
            {scanError && (
              <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs flex gap-2 animate-in fade-in duration-200">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Scan Success Indicator with Edit Modal trigger */}
            {scanResult && (
              <div className="p-4 rounded-lg border border-blue-500/25 bg-blue-500/5 space-y-4 animate-in fade-in duration-200">
                <div className="flex gap-2 text-blue-400 text-xs font-bold items-center">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>{scanResult.message}</span>
                </div>
                <div className="bg-zinc-950/60 p-3 rounded border border-zinc-800/80 space-y-1.5 text-xs text-zinc-400">
                  <div className="font-mono text-zinc-500">ID: #{scanResult.data.id}</div>
                  <div className="text-sm font-semibold text-white">{scanResult.data.name}</div>
                  <div>Opiekun: {scanResult.data.responsible_person || 'brak'}</div>
                  <div>Pojemnik: {getLocationDetails(scanResult.data.location_id).name}</div>
                </div>
                <button
                  onClick={triggerScanEdit}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-400 text-black font-bold text-sm rounded-lg shadow active:scale-95 transition-all duration-150"
                >
                  Otwórz Edycję Zasobu
                </button>
              </div>
            )}

            <div className="text-zinc-500 text-xs leading-relaxed border-t border-zinc-800/80 pt-4">
              <span className="font-semibold text-zinc-400">Instrukcja:</span> Wpisz <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 font-mono text-[10px]">101</code> do <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 font-mono text-[10px]">104</code> dla narzędzi trwałych, lub <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 font-mono text-[10px]">201</code> do <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 font-mono text-[10px]">204</code> dla materiałów, aby sprawdzić zachowanie skanera.
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALS SECTION WITH ANIMATIONS --- */}

      {/* 1. Modal: Manage Locations */}
      {isLocationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Zarządzaj Pojemnikami i Szafami
              </h3>
              <button 
                onClick={() => { setIsLocationsModalOpen(false); cancelEditLocation(); }}
                className="text-zinc-450 hover:text-white transition-colors active:scale-95 duration-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Form to Add/Edit Location */}
              <form onSubmit={handleLocationSubmit} className="space-y-3 bg-zinc-950/40 p-4 border border-zinc-850 rounded-xl">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                  {editingLocation ? 'Edytuj Miejsce' : 'Dodaj Nowe Miejsce'}
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nazwa pojemnika / szafy"
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  <input
                    type="text"
                    placeholder="Pokój / Ciężarówka / Miejsce"
                    value={newLocRoom}
                    onChange={(e) => setNewLocRoom(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Domyślny opiekun pojemnika"
                    value={newLocResponsible}
                    onChange={(e) => setNewLocResponsible(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  {editingLocation && (
                    <button
                      type="button"
                      onClick={cancelEditLocation}
                      className="px-3 py-2 bg-zinc-805 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-semibold rounded-lg transition-colors shrink-0 active:scale-95 duration-100"
                    >
                      Anuluj
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-2 bg-blue-500 text-black hover:bg-blue-400 font-semibold text-sm rounded-lg transition-colors shrink-0 disabled:opacity-50 active:scale-95 duration-100"
                  >
                    {editingLocation ? 'Zapisz' : 'Stwórz'}
                  </button>
                </div>
              </form>

              {/* Current Locations List */}
              <div className="space-y-2 max-h-56 overflow-y-auto border border-zinc-800 bg-zinc-950/40 rounded-lg p-2">
                {locations.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Brak zdefiniowanych pojemników stacjonarnych.</p>
                ) : (
                  locations.map(loc => (
                    <div key={loc.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-850 hover:border-zinc-800 transition-all">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                          {loc.name}
                        </span>
                        <div className="text-[10px] text-zinc-500 mt-1 flex gap-3">
                          <span>Pokój: <span className="text-zinc-400 font-medium">{loc.room || 'brak'}</span></span>
                          <span>Opiekun: <span className="text-zinc-400 font-medium">{loc.responsible_person || 'brak'}</span></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEditLocation(loc)}
                          disabled={modalLoading}
                          className="p-2 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-50"
                          title="Edytuj pojemnik"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          disabled={modalLoading}
                          className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all disabled:opacity-50"
                          title="Usuń pojemnik"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Add/Edit Item */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-400" />
                {editingItem ? 'Edytuj Przedmiot Trwały' : 'Dodaj Przedmiot Trwały'}
              </h3>
              <button 
                onClick={() => setIsItemModalOpen(false)}
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleItemSubmit} className="p-6 space-y-4">
              {/* Item Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Nazwa przedmiotu / narzędzia
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Wkrętarka DeWalt 18V"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Location Select (SearchableSelect component) */}
              <div>
                <SearchableSelect
                  options={locations}
                  value={itemLocId}
                  onChange={handleItemLocChange}
                  label="Pojemnik / Szafa"
                  placeholder="Wyszukaj szafę lub pokój..."
                />
              </div>

              {/* Responsible Person */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun / Osoba odpowiedzialna
                </label>
                <input
                  type="text"
                  required
                  placeholder="Imię i nazwisko"
                  value={itemResponsible}
                  onChange={(e) => setItemResponsible(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Shop Link */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Link do sklepu (opcjonalnie)
                </label>
                <input
                  type="url"
                  placeholder="https://allegro.pl/..."
                  value={itemLink}
                  onChange={(e) => setItemLink(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Status sprzętu
                </label>
                <select
                  value={itemStatus}
                  onChange={(e) => setItemStatus(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="in_workshop">W warsztacie</option>
                  <option value="assigned_to_event">Przypisany na wyjazd</option>
                  <option value="packed">Spakowany do skrzyni</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80 mt-4">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(editingItem.id)}
                    disabled={modalLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 active:scale-95 transition-all font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń z bazy
                  </button>
                ) : (
                  <div />
                )}
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsItemModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2 rounded-lg text-sm bg-blue-500 text-black font-bold hover:bg-blue-400 transition-colors disabled:opacity-50"
                  >
                    Zapisz
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Add/Edit Consumable */}
      {isConsumableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-400" />
                {editingConsumable ? 'Edytuj Materiał Zużywalny' : 'Dodaj Materiał Zużywalny'}
              </h3>
              <button 
                onClick={() => setIsConsumableModalOpen(false)}
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConsumableSubmit} className="p-6 space-y-4">
              {/* Consumable Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Nazwa materiału
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Śruby M4x20 łeb stożkowy (szt)"
                  value={consName}
                  onChange={(e) => setConsName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Location Select (SearchableSelect component) */}
              <div>
                <SearchableSelect
                  options={locations}
                  value={consLocId}
                  onChange={handleConsLocChange}
                  label="Pojemnik / Szafa"
                  placeholder="Wyszukaj szafę lub pokój..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity stored */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Stan magazynu
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={consQty}
                    onChange={(e) => setConsQty(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Min Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Minimalny stan
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={consMinQty}
                    onChange={(e) => setConsMinQty(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Responsible Person */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun materiału
                </label>
                <input
                  type="text"
                  required
                  placeholder="Imię i nazwisko"
                  value={consResponsible}
                  onChange={(e) => setConsResponsible(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Shop Link */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Link do sklepu (opcjonalnie)
                </label>
                <input
                  type="url"
                  placeholder="https://allegro.pl/..."
                  value={consLink}
                  onChange={(e) => setConsLink(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80 mt-4">
                {editingConsumable ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteConsumable(editingConsumable.id)}
                    disabled={modalLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 active:scale-95 transition-all font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń z bazy
                  </button>
                ) : (
                  <div />
                )}
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsConsumableModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-5 py-2 rounded-lg text-sm bg-blue-500 text-black font-bold hover:bg-blue-400 transition-colors disabled:opacity-50"
                  >
                    Zapisz
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification for Web Haptics */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 ${
          toast.type === 'success' 
            ? 'bg-zinc-950 border-blue-500/35 text-blue-400' 
            : 'bg-zinc-950 border-rose-500/35 text-rose-400'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
