'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, DatabaseItem, DatabaseConsumable, DatabaseLocation, DatabaseCategory } from '@/utils/supabase/client';
import SearchableSelect from '@/app/components/SearchableSelect';
import ScannerButton from '@/app/components/ScannerButton';
import ItemEditModal from '@/app/components/ItemEditModal';

interface ItemWithLocation extends DatabaseItem {
  locations?: {
    type: 'permanent' | 'event_box';
    event_id: number | null;
  } | null;
}

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
  Barcode,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Edit2,
  Trash2,
  X,
  Settings,
  ArrowUpDown,
  Tag
} from 'lucide-react';

function MagazynPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<'items' | 'consumables'>('items');
  const [items, setItems] = useState<ItemWithLocation[]>([]);
  const [consumables, setConsumables] = useState<DatabaseConsumable[]>([]);
  const [locations, setLocations] = useState<DatabaseLocation[]>([]);
  const [categories, setCategories] = useState<DatabaseCategory[]>([]);
  
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
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

  // --- CRUD States ---
  const modalHistoryActiveRef = useRef<boolean>(false);
  
  // 1. Locations modal
  const [isLocationsModalOpen, setIsLocationsModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<DatabaseLocation | null>(null);
  const [newLocName, setNewLocName] = useState<string>('');
  const [newLocRoom, setNewLocRoom] = useState<string>('');
  const [newLocResponsible, setNewLocResponsible] = useState<string>('');
  const [locSearchQuery, setLocSearchQuery] = useState<string>('');

  // 1.5. Categories modal
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<DatabaseCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryCode, setNewCategoryCode] = useState<string>('');
  const [catSearchQuery, setCatSearchQuery] = useState<string>('');

  // 2. Item modal
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ItemWithLocation | null>(null); // null = add

  // 3. Consumable modal
  const [isConsumableModalOpen, setIsConsumableModalOpen] = useState<boolean>(false);
  const [editingConsumable, setEditingConsumable] = useState<DatabaseConsumable | null>(null); // null = add
  const [consIdInput, setConsIdInput] = useState<string>('');
  const [consName, setConsName] = useState<string>('');
  const [consQty, setConsQty] = useState<number>(0);
  const [consMinQty, setConsMinQty] = useState<number>(0);
  const [consLink, setConsLink] = useState<string>('');
  const [consLocId, setConsLocId] = useState<string>('');
  const [consResponsible, setConsResponsible] = useState<string>('');
  const [consCategoryId, setConsCategoryId] = useState<string>('');
  const [consBarcode, setConsBarcode] = useState<string>('');

  // Fallback Mock Data
  const mockLocations: DatabaseLocation[] = [
    { id: 1, name: 'Szafa Główna A', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Bernie' },
    { id: 2, name: 'Regał z Elektroniką B', type: 'permanent', event_id: null, room: 'Pokój Projektowy 2', responsible_person: 'Kamil' },
    { id: 3, name: 'Szuflada Narzędziowa C', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Adam Kowalski' },
    { id: 4, name: 'Skrzynia Wyjazdowa #1', type: 'event_box', event_id: 10, room: null, responsible_person: 'Jan Nowak' },
    { id: 5, name: 'Skrzynia Wyjazdowa #2', type: 'event_box', event_id: 10, room: null, responsible_person: 'Kamil' },
  ];

  const mockCategories: DatabaseCategory[] = [
    { id: 1, name: 'Elektronika', code: 'EL' },
    { id: 2, name: 'Narzędzia ręczne', code: 'NR' },
    { id: 3, name: 'Materiały montażowe', code: 'MM' },
    { id: 4, name: 'Pneumatyka', code: 'PN' }
  ];

  const mockItems: ItemWithLocation[] = [
    { id: 'I-NR-0001', name: 'Dremel 4000', location_id: 1, responsible_person: 'Bernie', shop_link: 'https://dremel.pl', status: 'in_workshop', category_id: 2, locations: { type: 'permanent', event_id: null } },
    { id: 'I-NR-0002', name: 'Wkrętarka Makita 18V', location_id: 4, responsible_person: 'Jan Nowak', shop_link: 'https://makita.pl', status: 'assigned_to_event', category_id: 2, locations: { type: 'event_box', event_id: 10 } },
    { id: 'I-EL-0001', name: 'Lutownica TS101', location_id: 5, responsible_person: 'Kamil', shop_link: 'https://gotronik.pl', status: 'packed', category_id: 1, locations: { type: 'event_box', event_id: 10 } },
    { id: 'I-NR-0003', name: 'Zestaw kluczy płaskich', location_id: 3, responsible_person: 'Adam Kowalski', shop_link: 'https://sklep.pl', status: 'in_workshop', category_id: 2, locations: { type: 'permanent', event_id: null } },
  ];

  const mockConsumables: DatabaseConsumable[] = [
    { id: 'C-MM-0001', name: 'Frezy węglikowe 2mm', quantity_stored: 3, min_quantity: 10, shop_link: 'https://allegro.pl', location_id: 1, responsible_person: 'Bernie', category_id: 3 },
    { id: 'C-EL-0001', name: 'Cyna bezołowiowa Sn99', quantity_stored: 8, min_quantity: 5, shop_link: 'https://tme.eu', location_id: 2, responsible_person: 'Kamil', category_id: 1 },
    { id: 'C-MM-0002', name: 'Śruby M3x10 imbusowe (szt)', quantity_stored: 120, min_quantity: 200, shop_link: 'https://sruby.pl', location_id: 1, responsible_person: 'Bernie', category_id: 3 },
    { id: 'C-MM-0003', name: 'Opaski zaciskowe czarne (szt)', quantity_stored: 45, min_quantity: 100, shop_link: 'https://tme.eu', location_id: 3, responsible_person: 'Adam Kowalski', category_id: 3 },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [locsRes, itemsRes, consRes, catsRes] = await Promise.all([
        supabase.from('locations').select('*'),
        supabase.from('items').select('*, locations(type, event_id)'),
        supabase.from('consumables').select('*'),
        supabase.from('categories').select('*').order('name')
      ]);

      if (locsRes.error || itemsRes.error || consRes.error || catsRes.error) {
        throw new Error('Supabase fetch failed');
      }

      setLocations(locsRes.data || []);
      setItems(itemsRes.data || []);
      setConsumables(consRes.data || []);
      setCategories(catsRes.data || []);
      setIsDemoMode(false);
    } catch (err) {
      console.warn('Failed to load Supabase data, enabling mock mode:', err);
      setIsDemoMode(true);
      setLocations(mockLocations);
      setItems(mockItems);
      setConsumables(mockConsumables);
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll Lock & Back Button Interceptor for Modals
  useEffect(() => {
    const isAnyModalOpen = isLocationsModalOpen || isCategoriesModalOpen || isConsumableModalOpen || isItemModalOpen;
    if (!isAnyModalOpen) return;

    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Intercept back button
    window.history.pushState({ modalOpen: true }, '', window.location.href);
    modalHistoryActiveRef.current = true;

    const handlePopState = () => {
      modalHistoryActiveRef.current = false; // Already popped by the browser back navigation
      
      setIsLocationsModalOpen(false);
      setLocSearchQuery('');
      cancelEditLocation();

      setIsCategoriesModalOpen(false);
      setCatSearchQuery('');
      cancelEditCategory();

      setIsConsumableModalOpen(false);
      setIsItemModalOpen(false);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('popstate', handlePopState);
      if (modalHistoryActiveRef.current) {
        modalHistoryActiveRef.current = false;
        window.history.back();
      }
    };
  }, [isLocationsModalOpen, isCategoriesModalOpen, isConsumableModalOpen, isItemModalOpen]);

  // Support open parameter deep-linking from QR / Barcode scans
  useEffect(() => {
    if (loading) return;

    const openSku = searchParams.get('open');
    if (!openSku) return;

    const searchCode = String(openSku).trim();
    const upperCode = searchCode.toUpperCase();

    // Check in items list by barcode or id (SKU)
    const matchedItem = items.find(i => (i.barcode && String(i.barcode).trim() === searchCode) || i.id.toUpperCase() === upperCode);
    if (matchedItem) {
      setActiveTab('items');
      openEditItemModal(matchedItem);
      router.replace('/magazyn');
      return;
    }

    // Check in consumables list by barcode or id (SKU)
    const matchedConsumable = consumables.find(c => (c.barcode && String(c.barcode).trim() === searchCode) || c.id.toUpperCase() === upperCode);
    if (matchedConsumable) {
      setActiveTab('consumables');
      openEditConsumableModal(matchedConsumable);
      router.replace('/magazyn');
      return;
    }
  }, [loading, items, consumables, searchParams, router]);

  // Handler for scans made using ScannerButton inside app
  const handleBarcodeScan = (scannedCode: string) => {
    const searchCode = String(scannedCode).trim();
    if (!searchCode) return;
    const upperCode = searchCode.toUpperCase();

    // Check in items by barcode or id (SKU)
    const item = items.find(i => (i.barcode && String(i.barcode).trim() === searchCode) || i.id.toUpperCase() === upperCode);

    if (item) {
      setActiveTab('items');
      openEditItemModal(item);
      showToast(`Otwarto przedmiot: ${item.name}`);
      return;
    }

    // Check in consumables by barcode or id (SKU)
    const cons = consumables.find(c => (c.barcode && String(c.barcode).trim() === searchCode) || c.id.toUpperCase() === upperCode);

    if (cons) {
      setActiveTab('consumables');
      openEditConsumableModal(cons);
      showToast(`Otwarto materiał: ${cons.name}`);
      return;
    }

    showToast(`Nie znaleziono kodu "${searchCode}" w magazynie.`, 'error');
  };

  // --- Location Picker Event handlers (Default Opiekun resolution) ---

  const handleConsLocChange = (locId: string) => {
    setConsLocId(locId);
    // Auto-fill responsible person if selected container has an owner and we're ADDING
    const loc = locations.find(l => l.id.toString() === locId);
    if (loc && loc.responsible_person && !editingConsumable) {
      setConsResponsible(loc.responsible_person);
    }
  };

  // --- Quantity Adjustment (Warehouse view) ---
  const handleQuantityChange = async (consumableId: string, currentQty: number, delta: number) => {
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

  // --- Category CRUD Handlers ---
  const startEditCategory = (cat: DatabaseCategory) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryCode(cat.code || '');
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryCode('');
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !newCategoryCode.trim()) return;

    setModalLoading(true);

    const categoryCode = newCategoryCode.trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(categoryCode)) {
      showToast('Kod kategorii musi składać się z 2-3 liter (np. EL, NA)', 'error');
      setModalLoading(false);
      return;
    }

    if (editingCategory) {
      // Edit mode
      if (isDemoMode) {
        setCategories(prev =>
          prev.map(c => c.id === editingCategory.id ? { ...c, name: newCategoryName.trim(), code: categoryCode } : c)
        );
        cancelEditCategory();
        setModalLoading(false);
        showToast('Zaktualizowano kategorię (Tryb Demo)');
        return;
      }

      try {
        const { error } = await supabase
          .from('categories')
          .update({ name: newCategoryName.trim(), code: categoryCode })
          .eq('id', editingCategory.id);

        if (error) throw error;

        cancelEditCategory();
        const catsRes = await supabase.from('categories').select('*').order('name');
        setCategories(catsRes.data || []);
        showToast('Zaktualizowano kategorię');
      } catch (err: any) {
        alert('Błąd podczas edycji kategorii: ' + err.message);
      } finally {
        setModalLoading(false);
      }
    } else {
      // Create mode
      if (isDemoMode) {
        const newCat: DatabaseCategory = {
          id: Date.now(),
          name: newCategoryName.trim(),
          code: categoryCode
        };
        setCategories(prev => [...prev, newCat]);
        setNewCategoryName('');
        setNewCategoryCode('');
        setModalLoading(false);
        showToast('Utworzono kategorię (Tryb Demo)');
        return;
      }

      try {
        const { error } = await supabase
          .from('categories')
          .insert({ 
            name: newCategoryName.trim(),
            code: categoryCode
          });

        if (error) throw error;

        setNewCategoryName('');
        setNewCategoryCode('');
        const catsRes = await supabase.from('categories').select('*').order('name');
        setCategories(catsRes.data || []);
        showToast('Utworzono nową kategorię');
      } catch (err: any) {
        alert('Błąd podczas tworzenia kategorii: ' + err.message);
      } finally {
        setModalLoading(false);
      }
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę kategorię? Przypisane do niej narzędzia oraz materiały stracą to przypisanie (kategoria zostanie wyczyszczona).')) {
      return;
    }

    setModalLoading(true);

    if (isDemoMode) {
      setCategories(prev => prev.filter(c => c.id !== catId));
      setItems(prev => prev.map(i => i.category_id === catId ? { ...i, category_id: null } : i));
      setConsumables(prev => prev.map(c => c.category_id === catId ? { ...c, category_id: null } : c));
      setModalLoading(false);
      showToast('Usunięto kategorię (Tryb Demo)');
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', catId);

      if (error) throw error;

      fetchData();
      showToast('Usunięto kategorię');
    } catch (err: any) {
      alert('Błąd usuwania kategorii: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- SKU Suggestion Logic ---
  const suggestNextSku = async (type: 'I' | 'C', categoryId: number | null): Promise<string> => {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || !cat.code) return '';
    const code = cat.code.toUpperCase();
    const prefix = `${type}-${code}-`;

    if (isDemoMode) {
      let highestNum = 0;
      if (type === 'I') {
        items.forEach(item => {
          if (item.id && item.id.toUpperCase().startsWith(prefix)) {
            const parts = item.id.split('-');
            const lastPart = parts[parts.length - 1];
            const num = parseInt(lastPart, 10);
            if (!isNaN(num) && num > highestNum) {
              highestNum = num;
            }
          }
        });
      } else {
        consumables.forEach(c => {
          if (c.id && c.id.toUpperCase().startsWith(prefix)) {
            const parts = c.id.split('-');
            const lastPart = parts[parts.length - 1];
            const num = parseInt(lastPart, 10);
            if (!isNaN(num) && num > highestNum) {
              highestNum = num;
            }
          }
        });
      }
      const nextNum = highestNum + 1;
      const paddedNum = nextNum.toString().padStart(4, '0');
      return `${prefix}${paddedNum}`;
    } else {
      const table = type === 'I' ? 'items' : 'consumables';
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .like('id', `${prefix}%`)
        .order('id', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching highest ID:', error);
        return `${prefix}0001`;
      }

      if (data && data.length > 0) {
        const lastId = data[0].id;
        const parts = lastId.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num)) {
          const nextNum = num + 1;
          const paddedNum = nextNum.toString().padStart(4, '0');
          return `${prefix}${paddedNum}`;
        }
      }
      return `${prefix}0001`;
    }
  };

  const handleConsCategoryChange = async (catIdStr: string) => {
    setConsCategoryId(catIdStr);
    if (!editingConsumable && catIdStr) {
      const catId = parseInt(catIdStr, 10);
      if (!isNaN(catId)) {
        const suggested = await suggestNextSku('C', catId);
        setConsIdInput(suggested);
      }
    }
  };

  const openAddItemModal = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: ItemWithLocation) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleDeleteItem = async (itemId: string) => {
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
    setConsIdInput('');
    setConsName('');
    setConsQty(0);
    setConsMinQty(1);
    setConsLink('');
    setConsLocId('');
    setConsResponsible('');
    setConsCategoryId('');
    setConsBarcode('');
    
    setIsConsumableModalOpen(true);
  };

  const openEditConsumableModal = (c: DatabaseConsumable) => {
    setEditingConsumable(c);
    setConsIdInput(c.id);
    setConsName(c.name);
    setConsQty(c.quantity_stored);
    setConsMinQty(c.min_quantity);
    setConsLink(c.shop_link || '');
    setConsLocId(c.location_id ? c.location_id.toString() : '');
    setConsResponsible(c.responsible_person || '');
    setConsCategoryId(c.category_id ? c.category_id.toString() : '');
    setConsBarcode(c.barcode || '');
    setIsConsumableModalOpen(true);
  };

  const handleConsumableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consName.trim() || consQty < 0 || consMinQty < 0 || !consIdInput.trim()) return;

    setModalLoading(true);

    // Walidacja formatu ID (SKU)
    const skuRegex = /^(I|C)-[A-Z]{2,3}-\d{4}$/;
    if (!skuRegex.test(consIdInput.trim())) {
      showToast('Błędny format ID! Wymagany format: C-KOD-XXXX, np. C-NA-0002', 'error');
      setModalLoading(false);
      return;
    }

    const parsedLocId = parseInt(consLocId) || null;
    const parsedCategoryId = parseInt(consCategoryId) || null;

    if (isDemoMode) {
      if (editingConsumable) {
        setConsumables(prev => prev.map(c => c.id === editingConsumable.id ? {
          ...c,
          name: consName.trim(),
          quantity_stored: consQty,
          min_quantity: consMinQty,
          shop_link: consLink.trim(),
          location_id: parsedLocId as any,
          responsible_person: consResponsible.trim() || null,
          category_id: parsedCategoryId,
          barcode: consBarcode.trim() || null
        } : c));
      } else {
        if (consumables.some(c => c.id.toUpperCase() === consIdInput.trim().toUpperCase())) {
          showToast('Materiał o tym ID już istnieje!', 'error');
          setModalLoading(false);
          return;
        }
        const newCons: DatabaseConsumable = {
          id: consIdInput.trim(),
          name: consName.trim(),
          quantity_stored: consQty,
          min_quantity: consMinQty,
          shop_link: consLink.trim(),
          location_id: parsedLocId as any,
          responsible_person: consResponsible.trim() || null,
          category_id: parsedCategoryId,
          barcode: consBarcode.trim() || null
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
            responsible_person: consResponsible.trim() || null,
            category_id: parsedCategoryId,
            barcode: consBarcode.trim() || null
          })
          .eq('id', editingConsumable.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('consumables')
          .insert({
            id: consIdInput.trim(),
            name: consName.trim(),
            quantity_stored: consQty,
            min_quantity: consMinQty,
            shop_link: consLink.trim(),
            location_id: parsedLocId,
            responsible_person: consResponsible.trim() || null,
            category_id: parsedCategoryId,
            barcode: consBarcode.trim() || null
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

  const handleDeleteConsumable = async (consId: string) => {
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

  // Filter lists based on selected location, category & search query
  const filteredItems = items.filter(item => {
    const matchesLoc = selectedLocationId === 'all' || item.location_id === parseInt(selectedLocationId);
    const matchesCat = selectedCategoryId === 'all'
      ? true
      : selectedCategoryId === 'none'
      ? item.category_id === null
      : item.category_id === parseInt(selectedCategoryId);
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.responsible_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.id.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesLoc && matchesCat && matchesSearch;
  });

  const filteredConsumables = consumables.filter(cons => {
    const matchesLoc = selectedLocationId === 'all' || cons.location_id === parseInt(selectedLocationId);
    const matchesCat = selectedCategoryId === 'all'
      ? true
      : selectedCategoryId === 'none'
      ? cons.category_id === null
      : cons.category_id === parseInt(selectedCategoryId);
    const matchesSearch = cons.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (cons.responsible_person || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cons.id.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesLoc && matchesCat && matchesSearch;
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

  const renderCategoryBadge = (categoryId: number | null | undefined) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    if (!cat) return null;

    const colorClasses = [
      'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
      'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
      'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
      'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20',
      'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20',
      'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20',
      'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20',
    ];
    const colorClass = colorClasses[cat.id % colorClasses.length];

    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all duration-200 cursor-default select-none ${colorClass}`}>
        {cat.name}
      </span>
    );
  };

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
          <button
            onClick={() => setIsLocationsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 transition-all duration-150"
          >
            <Settings className="h-4 w-4 text-zinc-400" />
            Zarządzaj Pojemnikami
          </button>

          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 active:scale-95 transition-all duration-150"
          >
            <Tag className="h-4 w-4 text-zinc-400" />
            Zarządzaj Kategoriami
          </button>
        </div>
      </div>

      <div className="w-full space-y-6">
        {/* Main Controls & Filters */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4">
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
            <div className="relative min-w-[180px]">
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors appearance-none bg-none"
              >
                <option value="all">Wszystkie pojemniki</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id} className="bg-zinc-950 text-zinc-200">
                    {loc.name} {loc.room ? `(${loc.room})` : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-t border-zinc-500 h-2 w-2 transform rotate-135" />
            </div>

            {/* Category Filter */}
            <div className="relative min-w-[180px]">
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-colors appearance-none bg-none"
              >
                <option value="all">Wszystkie kategorie</option>
                <option value="none">Brak kategorii</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-zinc-950 text-zinc-200">
                    {cat.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-t border-zinc-500 h-2 w-2 transform rotate-135" />
            </div>
          </div>

          {/* Navigation Tabs & Actions Row */}
          <div className="border-b border-zinc-850 flex flex-col md:flex-row md:items-end justify-between mt-6 gap-4 pb-2 md:pb-0">
            <div className="flex space-x-6 overflow-x-auto w-full md:w-auto -mb-[2px] md:-mb-[1px] scrollbar-none pb-1 md:pb-0">
              <button
                onClick={() => { setActiveTab('items'); }}
                className={`pb-3.5 text-sm font-semibold border-b-2 transition-all duration-300 flex items-center gap-2 -mb-[1px] shrink-0 ${
                  activeTab === 'items'
                    ? 'border-blue-500 text-blue-400 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Package className="h-4.5 w-4.5" />
                Sprzęt Trwały ({filteredItems.length})
              </button>
              <button
                onClick={() => { setActiveTab('consumables'); }}
                className={`pb-3.5 text-sm font-semibold border-b-2 transition-all duration-300 flex items-center gap-2 -mb-[1px] shrink-0 ${
                  activeTab === 'consumables'
                    ? 'border-blue-500 text-blue-400 font-bold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Boxes className="h-4.5 w-4.5" />
                Materiały Zużywalne ({filteredConsumables.length})
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 pb-3 w-full md:w-auto">
              {activeTab === 'items' ? (
                <button
                  onClick={openAddItemModal}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-black bg-blue-500 rounded-lg hover:bg-blue-400 active:scale-95 transition-all duration-150 shadow-md shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Dodaj Przedmiot
                </button>
              ) : (
                <button
                  onClick={openAddConsumableModal}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-black bg-blue-500 rounded-lg hover:bg-blue-400 active:scale-95 transition-all duration-150 shadow-md shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Dodaj Materiał
                </button>
              )}

              <ScannerButton onScan={handleBarcodeScan} className="flex-1 sm:flex-initial w-full sm:w-auto justify-center" />

              {/* Square Refresh Button */}
              <button 
                onClick={fetchData} 
                disabled={loading}
                title="Odśwież dane"
                className="flex items-center justify-center h-9 w-9 text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
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
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 text-xs font-semibold uppercase tracking-wider select-none">
                          <th className="py-3 px-4 min-w-[145px] whitespace-nowrap cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortItems('id')}>
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
                              <td className="py-3.5 px-4 font-mono text-xs text-zinc-400 whitespace-nowrap min-w-[145px]">
                                <div className="flex flex-col gap-1 items-start whitespace-nowrap">
                                  <span className="font-semibold text-zinc-300">#{item.id}</span>
                                  {item.barcode && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-sans font-semibold whitespace-nowrap">
                                      <Barcode className="w-3 h-3 text-emerald-400 shrink-0" />
                                      Kod: {item.barcode}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-zinc-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{item.name}</span>
                                  {renderCategoryBadge(item.category_id)}
                                </div>
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

                  {/* Mobile Card-List View */}
                  <div className="block md:hidden space-y-3 p-3">
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
                        <div key={`item-card-${item.id}`} className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] text-zinc-550">#{item.id}</span>
                                {item.barcode && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-emerald-400 border border-emerald-500/30 font-sans font-semibold">
                                    <Barcode className="w-3 h-3 text-emerald-400" />
                                    Kod: {item.barcode}
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-zinc-100 text-sm leading-tight">{item.name}</div>
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {renderCategoryBadge(item.category_id)}
                              </div>
                            </div>
                            <div className="shrink-0">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[item.status]}`}>
                                {statusLabels[item.status]}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-zinc-850/50 text-xs text-zinc-400">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-zinc-550 block font-semibold uppercase tracking-wide">Lokalizacja</span>
                              <span className="flex items-center gap-1 text-zinc-300 font-medium">
                                <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                <span className="truncate max-w-[125px]">{locDetails.name}</span>
                              </span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-zinc-550 block font-semibold uppercase tracking-wide">Opiekun</span>
                              <span className="flex items-center gap-1 text-zinc-300 font-medium">
                                <User className="h-3.5 w-3.5 text-zinc-650 shrink-0" />
                                <span className="truncate max-w-[125px]">{item.responsible_person || 'Brak'}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-850/30">
                            <button
                              onClick={() => openEditItemModal(item)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs font-semibold active:scale-[0.98]"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> Edytuj
                            </button>
                            {item.shop_link && (
                              <a
                                href={item.shop_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-blue-400 hover:text-blue-300 transition-colors text-xs font-semibold active:scale-[0.98]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Sklep
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 text-xs font-semibold uppercase tracking-wider select-none">
                          <th className="py-3 px-4 min-w-[145px] whitespace-nowrap cursor-pointer hover:bg-zinc-900/50 hover:text-white transition-colors" onClick={() => handleSortCons('id')}>
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
                              <td className="py-3.5 px-4 font-mono text-xs text-zinc-400 whitespace-nowrap min-w-[145px]">
                                <div className="flex flex-col gap-1 items-start whitespace-nowrap">
                                  <span className="font-semibold text-zinc-300">#{cons.id}</span>
                                  {cons.barcode && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-sans font-semibold whitespace-nowrap">
                                      <Barcode className="w-3 h-3 text-emerald-400 shrink-0" />
                                      Kod: {cons.barcode}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-zinc-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{cons.name}</span>
                                  {renderCategoryBadge(cons.category_id)}
                                  {isLowStock && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      <AlertCircle className="h-3 w-3" /> Kup
                                    </span>
                                  )}
                                </div>
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

                  {/* Mobile Card-List View */}
                  <div className="block md:hidden space-y-3 p-3">
                    {sortedConsumables.map(cons => {
                      const isLowStock = Number(cons.quantity_stored) < Number(cons.min_quantity);
                      const locDetails = getLocationDetails(cons.location_id);

                      return (
                        <div 
                          key={`cons-card-${cons.id}`} 
                          className={`bg-zinc-900/40 border rounded-xl p-4 space-y-3 transition-all duration-300 ${
                            recentlyUpdatedId === `cons-${cons.id}` 
                              ? 'bg-blue-500/10 border-blue-500/30' 
                              : 'border-zinc-850'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] text-zinc-550">#{cons.id}</span>
                                {cons.barcode && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-emerald-400 border border-emerald-500/30 font-sans font-semibold">
                                    <Barcode className="w-3 h-3 text-emerald-400" />
                                    Kod: {cons.barcode}
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-zinc-100 text-sm leading-tight">{cons.name}</div>
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {renderCategoryBadge(cons.category_id)}
                                {isLowStock && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <AlertCircle className="h-3 w-3" /> Kup
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 bg-zinc-950/45 p-1 rounded-lg border border-zinc-800/80">
                              <button
                                onClick={() => handleQuantityChange(cons.id, Number(cons.quantity_stored), -1)}
                                disabled={cons.quantity_stored === 0}
                                className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className={`px-2 font-mono font-bold text-sm min-w-[28px] text-center ${isLowStock ? 'text-rose-400' : 'text-blue-400'}`}>
                                {cons.quantity_stored}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(cons.id, Number(cons.quantity_stored), 1)}
                                className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              >
                                <Plus className="h-3 w-3 text-zinc-300" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-2.5 border-t border-b border-zinc-850/50 text-xs font-mono text-center">
                            <div>
                              <div className="text-zinc-550 text-[10px] uppercase font-semibold mb-0.5">Min. Stan</div>
                              <div className="text-zinc-450">{cons.min_quantity}</div>
                            </div>
                            <div className="col-span-2 text-left pl-3 border-l border-zinc-850/50">
                              <div className="text-zinc-550 text-[10px] uppercase font-semibold mb-0.5">Lokalizacja</div>
                              <span className="flex items-center gap-1 text-zinc-350 font-medium truncate max-w-[155px]">
                                <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                                {locDetails.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              onClick={() => openEditConsumableModal(cons)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs font-semibold active:scale-[0.98]"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> Edytuj
                            </button>
                            {cons.shop_link && (
                              <a
                                href={cons.shop_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-blue-400 hover:text-blue-300 transition-colors text-xs font-semibold active:scale-[0.98]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Sklep
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )
            )}
          </div>
        </div>

      {/* --- MODALS SECTION WITH ANIMATIONS --- */}
      {isLocationsModalOpen && (() => {
        const filteredLocsForModal = locations.filter(loc => {
          const q = locSearchQuery.toLowerCase();
          return loc.name.toLowerCase().includes(q) || 
                 (loc.room || '').toLowerCase().includes(q) ||
                 (loc.responsible_person || '').toLowerCase().includes(q);
        });
        return (
          <div 
            onClick={(e) => { if (e.target === e.currentTarget) { setIsLocationsModalOpen(false); setLocSearchQuery(''); cancelEditLocation(); } }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          >
            <div className="w-[96%] max-w-xl md:w-full mx-auto my-auto bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 md:p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-400" />
                  Zarządzaj Pojemnikami i Szafami
                </h3>
                <button 
                  onClick={() => { setIsLocationsModalOpen(false); setLocSearchQuery(''); cancelEditLocation(); }}
                  className="text-zinc-450 hover:text-white transition-colors active:scale-95 duration-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-5">
                {/* Form to Add/Edit Location */}
                <form onSubmit={handleLocationSubmit} className="space-y-4 bg-zinc-950/50 p-5 border border-zinc-800/80 rounded-xl">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                    {editingLocation ? 'Edytuj Miejsce' : 'Dodaj Nowe Miejsce'}
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                        <Boxes className="w-5 h-5 block shrink-0" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Nazwa pojemnika / szafy"
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                        <MapPin className="w-5 h-5 block shrink-0" />
                      </span>
                      <input
                        type="text"
                        placeholder="Pokój / Ciężarówka / Miejsce"
                        value={newLocRoom}
                        onChange={(e) => setNewLocRoom(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                  
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                      <User className="w-5 h-5 block shrink-0" />
                    </span>
                    <input
                      type="text"
                      placeholder="Domyślny opiekun pojemnika"
                      value={newLocResponsible}
                      onChange={(e) => setNewLocResponsible(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-505 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800/80">
                    {editingLocation && (
                      <button
                        type="button"
                        onClick={cancelEditLocation}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-semibold rounded-lg transition-colors shrink-0 active:scale-95 duration-100"
                      >
                        Anuluj
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="px-5 py-2 bg-blue-500 text-black hover:bg-blue-400 font-semibold text-sm rounded-lg transition-colors shrink-0 disabled:opacity-50 active:scale-95 duration-100"
                    >
                      {editingLocation ? 'Zapisz' : 'Stwórz'}
                    </button>
                  </div>
                </form>

                {/* Filter Search Input */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                    <Search className="w-5 h-5 block shrink-0" />
                  </span>
                  <input
                    type="text"
                    placeholder="Wyszukaj szafę/skrzynię po nazwie, pokoju lub opiekunie..."
                    value={locSearchQuery}
                    onChange={(e) => setLocSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                </div>

                {/* Current Locations List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto border border-zinc-800 bg-zinc-950/40 rounded-lg p-2">
                  {filteredLocsForModal.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">
                      {locations.length === 0 ? 'Brak zdefiniowanych pojemników stacjonarnych.' : 'Brak wyników wyszukiwania.'}
                    </p>
                  ) : (
                    filteredLocsForModal.map(loc => (
                      <div key={loc.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/40 border border-zinc-805 hover:border-zinc-700/80 hover:bg-zinc-900 transition-all">
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
                            className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-50"
                            title="Edytuj pojemnik"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(loc.id)}
                            disabled={modalLoading}
                            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all disabled:opacity-50"
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
        );
      })()}

      {/* 2. Modal: Add/Edit Item */}
      {isItemModalOpen && (
        <ItemEditModal
          isOpen={isItemModalOpen}
          onClose={() => setIsItemModalOpen(false)}
          editingItem={editingItem}
          locations={locations}
          categories={categories}
          isDemoMode={isDemoMode}
          onSave={fetchData}
          itemsList={items}
          onSaveDemo={(item, isEdit) => {
            if (isEdit) {
              setItems(prev => prev.map(i => i.id === item.id ? item : i));
            } else {
              setItems(prev => [...prev, item]);
            }
          }}
        />
      )}

      {/* 3. Modal: Add/Edit Consumable */}
      {isConsumableModalOpen && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsConsumableModalOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200"
        >
          <div className="w-[96%] max-w-xl md:w-full mx-auto my-auto bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-400" />
                {editingConsumable ? 'Edytuj Materiał Zużywalny' : 'Dodaj Materiał Zużywalny'}
              </h3>
              <button 
                onClick={() => setIsConsumableModalOpen(false)}
                className="text-zinc-455 hover:text-white transition-colors active:scale-95 duration-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConsumableSubmit} className="p-6 md:p-8 space-y-5">
              {/* Consumable Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Nazwa materiału
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                    <Package className="w-5 h-5 block shrink-0" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="np. Śruby M4x20 łeb stożkowy (szt)"
                    value={consName}
                    onChange={(e) => setConsName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                  />
                </div>
              </div>

              {/* Consumable ID / SKU */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5 flex justify-between items-center">
                  <span>ID materiału (kod QR / SKU)</span>
                  <span className="text-[10px] text-zinc-500 font-normal lowercase font-sans">format: C-KOD-0000</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                    <QrCode className="w-5 h-5 block shrink-0" />
                  </span>
                  <input
                    type="text"
                    required
                    disabled={!!editingConsumable}
                    placeholder="Wybierz kategorię, aby wygenerować ID lub wpisz ręcznie..."
                    value={consIdInput}
                    onChange={(e) => setConsIdInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Consumable Barcode / Label */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5 flex justify-between items-center">
                  <span>Kod kreskowy (Etykieta)</span>
                  <span className="text-[10px] text-zinc-500 font-normal lowercase font-sans">opcjonalny kod z naklejki</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                      <Barcode className="w-5 h-5 block shrink-0" />
                    </span>
                    <input
                      id="cons-barcode-input"
                      type="text"
                      placeholder="Zeskanuj lub wpisz kod z naklejki (np. 00045)..."
                      value={consBarcode}
                      onChange={(e) => setConsBarcode(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                    />
                  </div>
                  <ScannerButton
                    buttonText=""
                    icon={Barcode}
                    className="!px-3.5 !py-2.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700 rounded-lg shrink-0 flex items-center justify-center"
                    onScan={(scannedCode) => {
                      if (scannedCode) {
                        const cleanCode = String(scannedCode).trim();
                        setConsBarcode(cleanCode);
                        setTimeout(() => {
                          const input = document.getElementById('cons-barcode-input') as HTMLInputElement;
                          if (input) {
                            input.value = cleanCode;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                          }
                        }, 50);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Location Select (SearchableSelect component) */}
              <div>
                <SearchableSelect
                  options={locations}
                  value={consLocId}
                  onChange={handleConsLocChange}
                  label="Pojemnik / Szafa"
                  placeholder="Wyszukaj szafę lub pokój..."
                  searchLabel="Filtrowanie pojemników..."
                  icon={Boxes}
                />
              </div>

              {/* Category Select (SearchableSelect component) */}
              <div>
                <SearchableSelect
                  options={categories}
                  value={consCategoryId}
                  onChange={handleConsCategoryChange}
                  label="Kategoria"
                  placeholder="Wyszukaj lub wybierz kategorię..."
                  searchLabel="Filtrowanie kategorii..."
                  icon={Tag}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity stored */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Stan magazynu
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                      <Boxes className="w-5 h-5 block shrink-0" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={consQty}
                      onChange={(e) => setConsQty(parseInt(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Min Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Minimalny stan
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                      <AlertCircle className="w-5 h-5 block shrink-0" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={consMinQty}
                      onChange={(e) => setConsMinQty(parseInt(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Responsible Person */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun materiału
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                    <User className="w-5 h-5 block shrink-0" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Imię i nazwisko"
                    value={consResponsible}
                    onChange={(e) => setConsResponsible(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                  />
                </div>
              </div>

              {/* Shop Link */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Link do sklepu (opcjonalnie)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                    <ExternalLink className="w-5 h-5 block shrink-0" />
                  </span>
                  <input
                    type="url"
                    placeholder="https://allegro.pl/..."
                    value={consLink}
                    onChange={(e) => setConsLink(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                  />
                </div>
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

      {/* 1.5. Modal: Manage Categories */}
      {isCategoriesModalOpen && (() => {
        const filteredCatsForModal = categories.filter(cat => 
          cat.name.toLowerCase().includes(catSearchQuery.toLowerCase())
        );
        return (
          <div 
            onClick={(e) => { if (e.target === e.currentTarget) { setIsCategoriesModalOpen(false); setCatSearchQuery(''); cancelEditCategory(); } }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200"
          >
            <div className="w-[96%] max-w-xl md:w-full mx-auto my-auto bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 md:p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Tag className="h-5 w-5 text-blue-400" />
                  Zarządzaj Kategoriami
                </h3>
                <button 
                  onClick={() => { setIsCategoriesModalOpen(false); setCatSearchQuery(''); cancelEditCategory(); }}
                  className="text-zinc-455 hover:text-white transition-colors active:scale-95 duration-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                {/* Form to Add/Edit Category */}
                <form onSubmit={handleCategorySubmit} className="space-y-4 bg-zinc-950/50 p-5 border border-zinc-800/80 rounded-xl">
                  <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                    {editingCategory ? 'Edytuj Kategorię' : 'Dodaj Nową Kategorię'}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="relative md:col-span-2">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-550 pointer-events-none">
                        <Tag className="w-5 h-5 block shrink-0" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Nazwa kategorii (np. Pneumatyka)"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-450 pointer-events-none text-[10px] font-bold font-mono uppercase">
                        KOD
                      </span>
                      <input
                        type="text"
                        required
                        maxLength={3}
                        placeholder="np. PN"
                        value={newCategoryCode}
                        onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase())}
                        className="w-full pl-12 pr-4 py-2.5 text-sm rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {editingCategory && (
                      <button
                        type="button"
                        onClick={cancelEditCategory}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-semibold rounded-lg transition-colors shrink-0 active:scale-95 duration-100"
                      >
                        Anuluj
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="px-5 py-2 bg-blue-500 text-black hover:bg-blue-400 font-bold text-sm rounded-lg transition-colors shrink-0 disabled:opacity-50 active:scale-95 duration-100"
                    >
                      {editingCategory ? 'Zapisz' : 'Dodaj'}
                    </button>
                  </div>
                </form>

                {/* Filter Search Input */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                    <Search className="w-5 h-5 block shrink-0" />
                  </span>
                  <input
                    type="text"
                    placeholder="Wyszukaj kategorię..."
                    value={catSearchQuery}
                    onChange={(e) => setCatSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                </div>

                {/* Current Categories List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto border border-zinc-800 bg-zinc-950/40 rounded-lg p-2">
                  {filteredCatsForModal.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">
                      {categories.length === 0 ? 'Brak zdefiniowanych kategorii.' : 'Brak wyników wyszukiwania.'}
                    </p>
                  ) : (
                    filteredCatsForModal.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/40 border border-zinc-805 hover:border-zinc-700/80 hover:bg-zinc-900 transition-all">
                        <span className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-zinc-500" />
                          {cat.name}
                          {cat.code && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono font-bold uppercase">
                              {cat.code}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEditCategory(cat)}
                            disabled={modalLoading}
                            className="p-2 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all disabled:opacity-50"
                            title="Edytuj kategorię"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            disabled={modalLoading}
                            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all disabled:opacity-50"
                            title="Usuń kategorię"
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
        );
      })()}

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

export default function MagazynPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="text-zinc-550 animate-pulse text-xs font-semibold">Ładowanie magazynu...</div>
      </div>
    }>
      <MagazynPageContent />
    </Suspense>
  );
}
