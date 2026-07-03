'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  supabase, 
  DatabaseEvent, 
  DatabaseLocation, 
  DatabaseItem, 
  DatabaseConsumable, 
  DatabaseEventConsumable,
  DatabaseCategory
} from '@/utils/supabase/client';
import ItemEditModal from '@/app/components/ItemEditModal';

interface ItemWithLocation extends DatabaseItem {
  locations?: {
    type: 'permanent' | 'event_box';
    event_id: number | null;
  } | null;
}
import { 
  Trophy, 
  Calendar, 
  ArrowLeft, 
  QrCode, 
  Package, 
  Boxes, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  Settings,
  Plus,
  Minus,
  LayoutDashboard,
  Check,
  Search,
  ArrowUpDown
} from 'lucide-react';
import ScannerButton from '@/app/components/ScannerButton';

interface ExtendedConsumableItem {
  eventConsumableId: number;
  consumableId: string;
  name: string;
  quantityPacked: number;
  quantityRequired: number;
  locationId: number;
}

export default function EventPackingPage() {
  const params = useParams();
  const eventId = parseInt(params.id as string);

  const [event, setEvent] = useState<DatabaseEvent | null>(null);
  const [boxes, setBoxes] = useState<DatabaseLocation[]>([]);
  const [activeBoxId, setActiveBoxId] = useState<number | null>(null);
  const [items, setItems] = useState<ItemWithLocation[]>([]);
  const [consumablesList, setConsumablesList] = useState<ExtendedConsumableItem[]>([]);
  const [globalConsumables, setGlobalConsumables] = useState<DatabaseConsumable[]>([]);
  
  // New States
  const [workshopItems, setWorkshopItems] = useState<ItemWithLocation[]>([]);
  const [permanentLocations, setPermanentLocations] = useState<DatabaseLocation[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [newBoxName, setNewBoxName] = useState<string>('');
  const [newBoxRoom, setNewBoxRoom] = useState<string>('');
  const [newBoxResponsible, setNewBoxResponsible] = useState<string>('');
  const [creatingBox, setCreatingBox] = useState<boolean>(false);
  const [modalLoading, setModalLoading] = useState<boolean>(false);

  // Scanner & Feedback State
  const [scanInput, setScanInput] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedItem, setScannedItem] = useState<DatabaseItem | null>(null);
  
  // Dynamic Item edit modal integration
  const [categories, setCategories] = useState<DatabaseCategory[]>([]);
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [selectedItemForModal, setSelectedItemForModal] = useState<ItemWithLocation | null>(null);
  
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

  // Synchronized Refs for thread-safe optimistic updates
  const consumablesListRef = useRef<ExtendedConsumableItem[]>([]);
  useEffect(() => {
    consumablesListRef.current = consumablesList;
  }, [consumablesList]);

  const globalConsumablesRef = useRef<DatabaseConsumable[]>([]);
  useEffect(() => {
    globalConsumablesRef.current = globalConsumables;
  }, [globalConsumables]);
  
  // 1. Pack Consumable Modal (from Scanner)
  const [packingModal, setPackingModal] = useState<{
    isOpen: boolean;
    consumable: DatabaseConsumable;
    existingEventConsumable?: ExtendedConsumableItem;
    targetBoxId?: number;
  } | null>(null);
  const [qtyToPack, setQtyToPack] = useState<string>('1');

  // Redesign: Tabs, Filters, Sort and Scanner Target
  const [activeTab, setActiveTab] = useState<'items' | 'consumables'>('items');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [scanTargetBoxId, setScanTargetBoxId] = useState<string>('');

  useEffect(() => {
    if (boxes.length > 0 && !scanTargetBoxId) {
      setScanTargetBoxId(boxes[0].id.toString());
    }
  }, [boxes, scanTargetBoxId]);

  // 2. Edit Chest Modal
  const [isBoxEditModalOpen, setIsBoxEditModalOpen] = useState<boolean>(false);
  const [editingBox, setEditingBox] = useState<DatabaseLocation | null>(null);
  const [editBoxName, setEditBoxName] = useState<string>('');
  const [editBoxRoom, setEditBoxRoom] = useState<string>('');
  const [editBoxResponsible, setEditBoxResponsible] = useState<string>('');

  // 3. Edit Requirement Modal
  const [isReqEditModalOpen, setIsReqEditModalOpen] = useState<boolean>(false);
  const [editingReq, setEditingReq] = useState<ExtendedConsumableItem | null>(null);
  const [reqQtyRequired, setReqQtyRequired] = useState<number>(0);
  const [reqQtyPacked, setReqQtyPacked] = useState<number>(0);
  const [reqLocationId, setReqLocationId] = useState<string>('');

  // 4. Assign Item Modal
  const [isAssignItemModalOpen, setIsAssignItemModalOpen] = useState<boolean>(false);
  const [assignItemId, setAssignItemId] = useState<string>('');
  const [assignBoxId, setAssignBoxId] = useState<string>('');
  
  // 5. Add Requirement Modal
  const [isAddReqModalOpen, setIsAddReqModalOpen] = useState<boolean>(false);
  const [reqConsumableId, setReqConsumableId] = useState<string>('');
  const [reqBoxId, setReqBoxId] = useState<string>('');
  const [reqQtyVal, setReqQtyVal] = useState<string>('5');
  const [reqResponsible, setReqResponsible] = useState<string>('');



  // MOCK DATA for specific event id 10
  const mockEvent: DatabaseEvent = {
    id: 10,
    name: 'Formula Student East 2026 (Győr, Węgry)',
    start_date: '2026-07-20',
    is_active: true
  };

  const mockBoxes: DatabaseLocation[] = [
    { id: 301, name: 'Skrzynia Mechaniczna #1', type: 'event_box', event_id: 10, room: null, responsible_person: null },
    { id: 302, name: 'Skrzynia Elektroniki #2', type: 'event_box', event_id: 10, room: null, responsible_person: null }
  ];

  const mockItems: ItemWithLocation[] = [
    { id: 'I-NR-0101', name: 'Szlifierka kątowa Bosch', location_id: 1, responsible_person: 'Jan Nowak', shop_link: '', status: 'in_workshop', locations: { type: 'permanent', event_id: null } },
    { id: 'I-NR-0102', name: 'Wkrętarka Makita 18V', location_id: 301, responsible_person: 'Jan Nowak', shop_link: '', status: 'assigned_to_event', locations: { type: 'event_box', event_id: 10 } },
    { id: 'I-EL-0103', name: 'Lutownica TS101', location_id: 302, responsible_person: 'Kamil Wiśniewski', shop_link: '', status: 'packed', locations: { type: 'event_box', event_id: 10 } },
    { id: 'I-NR-0104', name: 'Dremel 4000', location_id: 1, responsible_person: 'Adam Kowalski', shop_link: '', status: 'in_workshop', locations: { type: 'permanent', event_id: null } },
    { id: 'I-NR-0105', name: 'Zestaw kluczy płaskich', location_id: 301, responsible_person: 'Adam Kowalski', shop_link: '', status: 'assigned_to_event', locations: { type: 'event_box', event_id: 10 } },
    { id: 'I-EL-0106', name: 'Oscyloskop Siglent', location_id: 302, responsible_person: 'Michał Zieliński', shop_link: '', status: 'packed', locations: { type: 'event_box', event_id: 10 } },
    { id: 'I-EL-0107', name: 'Zasilacz laboratoryjny Korad', location_id: 2, responsible_person: 'Kamil Wiśniewski', shop_link: '', status: 'in_workshop', locations: { type: 'permanent', event_id: null } }
  ];

  const mockEventConsumables: ExtendedConsumableItem[] = [
    { eventConsumableId: 501, consumableId: 'C-MM-0201', name: 'Frezy węglikowe 2mm', quantityPacked: 2, quantityRequired: 5, locationId: 301 },
    { eventConsumableId: 502, consumableId: 'C-EL-0202', name: 'Cyna bezołowiowa Sn99', quantityPacked: 8, quantityRequired: 8, locationId: 302 },
    { eventConsumableId: 503, consumableId: 'C-MM-0203', name: 'Śruby M3x10 imbusowe (szt)', quantityPacked: 50, quantityRequired: 150, locationId: 301 }
  ];

  const mockConsumables: DatabaseConsumable[] = [
    { id: 'C-MM-0201', name: 'Frezy węglikowe 2mm', quantity_stored: 12, min_quantity: 10, shop_link: '', location_id: 1, responsible_person: null },
    { id: 'C-EL-0202', name: 'Cyna bezołowiowa Sn99', quantity_stored: 4, min_quantity: 5, shop_link: '', location_id: 2, responsible_person: null },
    { id: 'C-MM-0203', name: 'Śruby M3x10 imbusowe (szt)', quantity_stored: 340, min_quantity: 200, shop_link: '', location_id: 1, responsible_person: null }
  ];

  const mockPermanentLocations: DatabaseLocation[] = [
    { id: 1, name: 'Szafa A (Narzędziowa)', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Jan Nowak' },
    { id: 2, name: 'Szafa B (Materiały)', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Kamil Wiśniewski' },
    { id: 3, name: 'Regał C (Pudełka)', type: 'permanent', event_id: null, room: 'Korytarz', responsible_person: 'Bernie' }
  ];

  const mockCategories: DatabaseCategory[] = [
    { id: 1, name: 'Elektronika', code: 'EL' },
    { id: 2, name: 'Narzędzia ręczne', code: 'NR' },
    { id: 3, name: 'Materiały montażowe', code: 'MM' },
    { id: 4, name: 'Pneumatyka', code: 'PN' }
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      setScanError(null);
      setScanSuccess(null);
      setScannedItem(null);

      // Fetch Event details
      const eventRes = await supabase.from('events').select('*').eq('id', eventId).single();
      if (eventRes.error) throw eventRes.error;
      setEvent(eventRes.data);

      // Fetch event locations (boxes)
      const boxesRes = await supabase.from('locations').select('*').eq('event_id', eventId).eq('type', 'event_box');
      const loadedBoxes = boxesRes.data || [];
      setBoxes(loadedBoxes);

      // Fetch items assigned to this event
      const boxIds = loadedBoxes.map(b => b.id);
      let loadedItems: ItemWithLocation[] = [];
      if (boxIds.length > 0) {
        const itemsRes = await supabase.from('items').select('*, locations(type, event_id)').in('location_id', boxIds);
        loadedItems = itemsRes.data || [];
      }
      setItems(loadedItems);

      // Fetch items currently in workshop (status = in_workshop)
      const workshopItemsRes = await supabase.from('items').select('*, locations(type, event_id)').eq('status', 'in_workshop');
      setWorkshopItems(workshopItemsRes.data || []);

      // Fetch permanent locations
      const permRes = await supabase.from('locations').select('*').eq('type', 'permanent');
      setPermanentLocations(permRes.data || []);

      // Fetch global consumables for scanning reference
      const globalConsRes = await supabase.from('consumables').select('*');
      setGlobalConsumables(globalConsRes.data || []);

      // Fetch event consumables
      let loadedEventCons: ExtendedConsumableItem[] = [];
      if (boxIds.length > 0) {
        const evConsRes = await supabase.from('event_consumables').select('*').in('location_id', boxIds);
        const rawEvCons: DatabaseEventConsumable[] = evConsRes.data || [];

        loadedEventCons = rawEvCons.map(ec => {
          const matchingCons = (globalConsRes.data || []).find(c => c.id === ec.consumable_id);
          return {
            eventConsumableId: ec.id,
            consumableId: ec.consumable_id,
            name: matchingCons ? matchingCons.name : `Materiał zużywalny #${ec.consumable_id}`,
            quantityPacked: ec.quantity_packed,
            quantityRequired: ec.quantity_required,
            locationId: ec.location_id
          };
        });
      }
      setConsumablesList(loadedEventCons);

      // Fetch categories
      const catsRes = await supabase.from('categories').select('*').order('name');
      setCategories(catsRes.data || []);

      setIsDemoMode(false);
    } catch (err) {
      console.warn('Failed to load Supabase data, running mock environment:', err);
      setIsDemoMode(true);
      
      setEvent(mockEvent);
      setBoxes(mockBoxes);
      setItems(mockItems.filter(i => i.status !== 'in_workshop'));
      setWorkshopItems(mockItems.filter(i => i.status === 'in_workshop'));
      setPermanentLocations(mockPermanentLocations);
      setGlobalConsumables(mockConsumables);
      setConsumablesList(mockEventConsumables);
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

    const handleCreateBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoxName.trim()) return;

    setCreatingBox(true);

    if (isDemoMode) {
      const newBox: DatabaseLocation = {
        id: Date.now(),
        name: newBoxName.trim(),
        type: 'event_box',
        event_id: eventId,
        room: newBoxRoom.trim() || null,
        responsible_person: newBoxResponsible.trim() || null
      };
      setBoxes(prev => [...prev, newBox]);
      setActiveBoxId(newBox.id);
      setNewBoxName('');
      setNewBoxRoom('');
      setNewBoxResponsible('');
      setCreatingBox(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('locations')
        .insert({
          name: newBoxName.trim(),
          type: 'event_box',
          event_id: eventId,
          room: newBoxRoom.trim() || null,
          responsible_person: newBoxResponsible.trim() || null
        })
        .select()
        .single();

      if (error) {
        alert('Błąd tworzenia skrzyni: ' + error.message);
      } else if (data) {
        setBoxes(prev => [...prev, data]);
        setActiveBoxId(data.id);
        setNewBoxName('');
        setNewBoxRoom('');
        setNewBoxResponsible('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingBox(false);
    }
  };

  const openEditBoxModal = (box: DatabaseLocation) => {
    setEditingBox(box);
    setEditBoxName(box.name);
    setEditBoxRoom(box.room || '');
    setEditBoxResponsible(box.responsible_person || '');
    setIsBoxEditModalOpen(true);
  };

  const handleEditBoxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBox || !editBoxName.trim()) return;

    setModalLoading(true);

    const oldResponsible = editingBox.responsible_person;
    const newResponsible = editBoxResponsible.trim() || null;
    const oldRes = oldResponsible ? oldResponsible.trim() : '';
    const newRes = newResponsible ? newResponsible.trim() : '';

    if (isDemoMode) {
      setBoxes(prev => prev.map(b => b.id === editingBox.id ? { 
        ...b, 
        name: editBoxName.trim(),
        room: editBoxRoom.trim() || null,
        responsible_person: editBoxResponsible.trim() || null
      } : b));

      if (oldRes !== newRes) {
        setItems(prev => prev.map(i => 
          (i.location_id === editingBox.id && (i.responsible_person || '') === oldRes)
            ? { ...i, responsible_person: newRes }
            : i
        ));
      }

      setIsBoxEditModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      // 1. Update the box location
      const { error: boxError } = await supabase
        .from('locations')
        .update({ 
          name: editBoxName.trim(),
          room: editBoxRoom.trim() || null,
          responsible_person: editBoxResponsible.trim() || null
        })
        .eq('id', editingBox.id);

      if (boxError) throw boxError;

      // 2. Cascade responsible person updates
      if (oldRes !== newRes) {
        // Update items in database
        const { error: itemsError } = await supabase
          .from('items')
          .update({ responsible_person: newRes })
          .eq('location_id', editingBox.id)
          .eq('responsible_person', oldRes);
        
        if (itemsError) console.error('Błąd kaskady opiekuna dla przedmiotów:', itemsError);
        
        // Update event consumables in database
        const { error: consError } = await supabase
          .from('event_consumables')
          .update({ responsible_person: newRes })
          .eq('location_id', editingBox.id)
          .eq('responsible_person', oldRes);

        if (consError) console.error('Błąd kaskady opiekuna dla materiałów:', consError);
      }

      setIsBoxEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Błąd edycji skrzyni: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteBox = async (boxId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę skrzynię? Wszystkie spakowane do niej narzędzia oraz przypisane materiały zużywalne stracą przypisanie skrzyni (zostaną zresetowane w warsztacie).')) {
      return;
    }

    setModalLoading(true);

    if (isDemoMode) {
      setBoxes(prev => prev.filter(b => b.id !== boxId));
      // Cascade/Set Null emulation:
      setItems(prev => prev.map(i => i.location_id === boxId ? { ...i, location_id: null as any, status: 'in_workshop' } : i));
      setConsumablesList(prev => prev.filter(ec => ec.locationId !== boxId));
      
      if (activeBoxId === boxId) {
        setActiveBoxId(null);
      }
      setIsBoxEditModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('locations').delete().eq('id', boxId);
      if (error) throw error;

      setIsBoxEditModalOpen(false);
      if (activeBoxId === boxId) {
        setActiveBoxId(null);
      }
      fetchData();
    } catch (err: any) {
      alert('Błąd usuwania skrzyni: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- event_consumables CRUD ---
  const openEditReqModal = (req: ExtendedConsumableItem) => {
    setEditingReq(req);
    setReqQtyRequired(req.quantityRequired);
    setReqQtyPacked(req.quantityPacked);
    setReqLocationId(req.locationId.toString());
    setIsReqEditModalOpen(true);
  };

  const handleEditReqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq || reqQtyRequired < 0 || reqQtyPacked < 0) return;

    setModalLoading(true);
    const parsedLocId = parseInt(reqLocationId);

    if (isDemoMode) {
      setConsumablesList(prev => prev.map(ec => ec.eventConsumableId === editingReq.eventConsumableId ? {
        ...ec,
        quantityRequired: reqQtyRequired,
        quantityPacked: reqQtyPacked,
        locationId: parsedLocId
      } : ec));
      setIsReqEditModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('event_consumables')
        .update({
          quantity_required: reqQtyRequired,
          quantity_packed: reqQtyPacked,
          location_id: parsedLocId
        })
        .eq('id', editingReq.eventConsumableId);

      if (error) throw error;

      setIsReqEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Błąd zapisu wymagań: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteReq = async (reqId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć to zapotrzebowanie z wyjazdu? Spakowane sztuki nie zostaną automatycznie zwrócone do magazynu warsztatu, chyba że rozpakujesz je ręcznie.')) {
      return;
    }

    setModalLoading(true);

    if (isDemoMode) {
      setConsumablesList(prev => prev.filter(ec => ec.eventConsumableId !== reqId));
      setIsReqEditModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('event_consumables').delete().eq('id', reqId);
      if (error) throw error;

      setIsReqEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Błąd usuwania zapotrzebowania: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- Durable Items Actions & Modal Helpers ---
  const openEditItemModal = (item: ItemWithLocation) => {
    setSelectedItemForModal(item);
    setIsItemModalOpen(true);
  };

  const handlePackItem = async (itemId: string) => {
    const originalItems = [...items];
    
    // Optimistic Update
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'packed' } : i));
    setRecentlyUpdatedId(`item-${itemId}`);
    setTimeout(() => {
      setRecentlyUpdatedId(prev => prev === `item-${itemId}` ? null : prev);
    }, 1000);

    if (isDemoMode) {
      showToast('Spakowano sprzęt (Tryb Demo)');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .update({ status: 'packed' })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setItems(originalItems);
      showToast(`Błąd pakowania: ${err.message || 'Brak połączenia'}`, 'error');
    }
  };

  const handleUnpackItem = async (itemId: string) => {
    const originalItems = [...items];

    // Optimistic Update
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'assigned_to_event' } : i));
    setRecentlyUpdatedId(`item-${itemId}`);
    setTimeout(() => {
      setRecentlyUpdatedId(prev => prev === `item-${itemId}` ? null : prev);
    }, 1000);

    if (isDemoMode) {
      showToast('Rozpakowano sprzęt (Tryb Demo)');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .update({ status: 'assigned_to_event' })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setItems(originalItems);
      showToast(`Błąd rozpakowywania: ${err.message || 'Brak połączenia'}`, 'error');
    }
  };

  const handleReturnToWorkshop = async (itemId: string) => {
    const defaultLocId = permanentLocations.length > 0 ? permanentLocations[0].id : 1;
    
    if (isDemoMode) {
      // Remove from active event checklist
      setItems(prev => prev.filter(i => i.id !== itemId));
      
      // Update mockItems list in memory
      mockItems.forEach(i => {
        if (i.id === itemId) {
          i.status = 'in_workshop';
          i.location_id = defaultLocId;
        }
      });
      // Refresh workshop items list
      setWorkshopItems(mockItems.filter(i => i.status === 'in_workshop'));
      setScanSuccess('Zwrócono sprzęt do warsztatu w trybie demo.');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .update({ 
          status: 'in_workshop',
          location_id: defaultLocId 
        })
        .eq('id', itemId);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Błąd podczas zwracania do warsztatu: ' + err.message);
    }
  };

  const handleAssignItem = async (itemId: string, boxId: number) => {
    // Look up default responsible person from the target box if any
    const targetBox = boxes.find(b => b.id === boxId);
    const responsible = targetBox?.responsible_person || '';

    if (isDemoMode) {
      const itemToAssign = mockItems.find(i => i.id === itemId);
      if (itemToAssign) {
        itemToAssign.status = 'assigned_to_event';
        itemToAssign.location_id = boxId;
        if (responsible) {
          itemToAssign.responsible_person = responsible;
        }

        // Add to active event items
        setItems(prev => {
          if (prev.some(i => i.id === itemId)) {
            return prev.map(i => i.id === itemId ? { ...i, status: 'assigned_to_event', location_id: boxId, responsible_person: responsible } : i);
          } else {
            return [...prev, { ...itemToAssign, status: 'assigned_to_event', location_id: boxId, responsible_person: responsible }];
          }
        });
        setWorkshopItems(mockItems.filter(i => i.status === 'in_workshop'));
      }
      setIsAssignItemModalOpen(false);
      setScanSuccess('Przypisano sprzęt z warsztatu w trybie demo.');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .update({ 
          status: 'assigned_to_event',
          location_id: boxId,
          responsible_person: responsible || null
        })
        .eq('id', itemId);

      if (error) throw error;
      setIsAssignItemModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Błąd podczas przypisywania sprzętu: ' + err.message);
    }
  };



  // --- Consumables Quick Increments & Decrements ---
  const handleAdjustConsumable = async (eventConsumableId: number, consumableId: string, delta: number) => {
    const ecItem = consumablesListRef.current.find(ec => ec.eventConsumableId === eventConsumableId);
    if (!ecItem) return;

    const globalCons = globalConsumablesRef.current.find(gc => gc.id === consumableId);
    if (delta > 0 && (!globalCons || Number(globalCons.quantity_stored) <= 0)) {
      showToast(`Brak materiału "${ecItem.name}" w magazynie głównym!`, 'error');
      return;
    }

    const oldPacked = ecItem.quantityPacked;
    const newPacked = Math.max(0, oldPacked + delta);
    if (newPacked === oldPacked) return;

    const oldStored = globalCons ? Number(globalCons.quantity_stored) : 0;
    const newStored = Math.max(0, oldStored - delta);

    // 1. Sync refs immediately so next clicks see correct values
    consumablesListRef.current = consumablesListRef.current.map(ec =>
      ec.eventConsumableId === eventConsumableId ? { ...ec, quantityPacked: newPacked } : ec
    );
    if (globalCons) {
      globalConsumablesRef.current = globalConsumablesRef.current.map(gc =>
        gc.id === consumableId ? { ...gc, quantity_stored: newStored } : gc
      );
    }

    // 2. Schedule React state updates
    setConsumablesList(consumablesListRef.current);
    setGlobalConsumables(globalConsumablesRef.current);

    // Trigger row flash / microinteraction
    setRecentlyUpdatedId(`cons-${eventConsumableId}`);
    setTimeout(() => {
      setRecentlyUpdatedId(prev => prev === `cons-${eventConsumableId}` ? null : prev);
    }, 1000);

    if (isDemoMode) {
      showToast(`Zaktualizowano stan: ${newPacked} szt. (Tryb Demo)`);
      setTimeout(() => {
        window.dispatchEvent(new Event('stock-updated'));
      }, 50);
      return;
    }

    try {
      // 3. Update main warehouse stock
      const { error: whError } = await supabase
        .from('consumables')
        .update({ quantity_stored: newStored })
        .eq('id', consumableId);
      if (whError) throw whError;

      // 4. Update event consumable quantity
      const { error: ecError } = await supabase
        .from('event_consumables')
        .update({ quantity_packed: newPacked })
        .eq('id', eventConsumableId);
      if (ecError) throw ecError;

      window.dispatchEvent(new Event('stock-updated'));
    } catch (err: any) {
      console.error(err);
      // Revert refs
      consumablesListRef.current = consumablesListRef.current.map(ec =>
        ec.eventConsumableId === eventConsumableId ? { ...ec, quantityPacked: oldPacked } : ec
      );
      if (globalCons) {
        globalConsumablesRef.current = globalConsumablesRef.current.map(gc =>
          gc.id === consumableId ? { ...gc, quantity_stored: oldStored } : gc
        );
      }
      // Revert React states
      setConsumablesList(consumablesListRef.current);
      setGlobalConsumables(globalConsumablesRef.current);
      showToast(`Błąd zapisu: ${err.message || 'Brak połączenia'}`, 'error');
    }
  };

  // --- Add Consumable Requirement ---
  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqConsumableId || !reqBoxId) return;

    const parsedConsId = reqConsumableId;
    const parsedBoxId = parseInt(reqBoxId);
    const reqQty = parseInt(reqQtyVal) || 0;

    if (reqQty <= 0) {
      alert('Wymagana ilość musi być większa od zera.');
      return;
    }

    const selectedCons = globalConsumables.find(gc => gc.id === parsedConsId);
    if (!selectedCons) return;

    // Resolve owner of selected chest
    const targetBox = boxes.find(b => b.id === parsedBoxId);
    const ownerResponsible = targetBox?.responsible_person || '';
    const responsible = reqResponsible.trim() || ownerResponsible;

    if (isDemoMode) {
      const newEC: ExtendedConsumableItem = {
        eventConsumableId: Date.now(),
        consumableId: parsedConsId,
        name: selectedCons.name,
        quantityPacked: 0,
        quantityRequired: reqQty,
        locationId: parsedBoxId
      };
      setConsumablesList(prev => [...prev, newEC]);
      setIsAddReqModalOpen(false);
      setReqConsumableId('');
      setReqQtyVal('5');
      setReqResponsible('');
      return;
    }

    try {
      const { error } = await supabase
        .from('event_consumables')
        .insert({
          consumable_id: parsedConsId,
          location_id: parsedBoxId,
          quantity_packed: 0,
          quantity_required: reqQty,
          responsible_person: responsible || null
        });

      if (error) throw error;
      setIsAddReqModalOpen(false);
      setReqConsumableId('');
      setReqQtyVal('5');
      setReqResponsible('');
      fetchData();
    } catch (err: any) {
      alert('Błąd dodawania zapotrzebowania: ' + err.message);
    }
  };

  // --- Scanner Logic ---
  const handleScanCode = async (skuCode: string) => {
    setScanError(null);
    setScanSuccess(null);
    setScannedItem(null);

    const targetBoxId = activeBoxId || parseInt(scanTargetBoxId);

    if (!targetBoxId) {
      setScanError('Wybierz lub stwórz najpierw skrzynię, do której pakujesz.');
      alert('Wybierz lub stwórz najpierw skrzynię, do której pakujesz.');
      return;
    }

    const cleanSku = skuCode.trim().toUpperCase();
    if (!cleanSku) return;

    // Sprawdzamy pierwszą literę identyfikatora (SKU)
    const firstChar = cleanSku[0]?.toUpperCase();
    if (firstChar !== 'I' && firstChar !== 'C') {
      setScanError('ID musi zaczynać się od litery I (sprzęt) lub C (materiały), np. I-NA-0001.');
      alert('ID musi zaczynać się od litery I (sprzęt) lub C (materiały), np. I-NA-0001.');
      return;
    }

    const searchType = firstChar === 'I' ? 'item' : 'consumable';

    if (isDemoMode) {
      const scannedItemVal = searchType === 'item'
        ? mockItems.find(i => i.id.toUpperCase() === cleanSku)
        : null;

      const scannedConsVal = searchType === 'consumable'
        ? mockConsumables.find(c => c.id.toUpperCase() === cleanSku)
        : null;

      if (scannedItemVal) {
        setSelectedItemForModal(scannedItemVal);
        setIsItemModalOpen(true);
        return;
      }

      if (scannedConsVal) {
        const existingEC = consumablesList.find(c => c.consumableId.toUpperCase() === cleanSku && c.locationId === targetBoxId);
        setPackingModal({
          isOpen: true,
          consumable: scannedConsVal,
          existingEventConsumable: existingEC,
          targetBoxId: targetBoxId
        });
        setQtyToPack('1');
        return;
      }

      setScanError(`Nie znaleziono kodu: ${cleanSku} w bazie.`);
      alert(`Nie znaleziono kodu: ${cleanSku} w bazie.`);
      return;
    }

    try {
      let scannedItemVal = null;
      let scannedConsVal = null;

      if (searchType === 'item') {
        const { data: itemData } = await supabase
          .from('items')
          .select('*, locations(type, event_id)')
          .eq('id', cleanSku)
          .maybeSingle();
        scannedItemVal = itemData;
      } else {
        const { data: consData } = await supabase
          .from('consumables')
          .select('*')
          .eq('id', cleanSku)
          .maybeSingle();
        scannedConsVal = consData;
      }

      if (scannedItemVal) {
        setSelectedItemForModal(scannedItemVal);
        setIsItemModalOpen(true);
        return;
      }

      if (scannedConsVal) {
        const existingEC = consumablesList.find(c => c.consumableId.toUpperCase() === cleanSku && c.locationId === targetBoxId);
        setPackingModal({
          isOpen: true,
          consumable: scannedConsVal,
          existingEventConsumable: existingEC,
          targetBoxId: targetBoxId
        });
        setQtyToPack('1');
        return;
      }

      setScanError(`Nie znaleziono kodu: ${cleanSku} w bazie.`);
      alert(`Nie znaleziono kodu: ${cleanSku} w bazie.`);
    } catch (err) {
      console.error(err);
      setScanError('Błąd podczas odczytu kodu.');
    }
  };

  const handleConfirmConsumablePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packingModal) return;

    const targetBoxId = packingModal.targetBoxId || activeBoxId || parseInt(scanTargetBoxId);
    if (!targetBoxId) {
      showToast('Wybierz lub stwórz najpierw skrzynię, do której pakujesz.', 'error');
      return;
    }

    const count = parseInt(qtyToPack);
    if (isNaN(count) || count <= 0) {
      showToast('Ilość musi być liczbą większą od zera.', 'error');
      return;
    }

    const { consumable, existingEventConsumable } = packingModal;

    if (count > consumable.quantity_stored) {
      showToast(`Brak wystarczającej ilości w magazynie. Dostępne: ${consumable.quantity_stored} szt.`, 'error');
      return;
    }

    const previousConsumablesList = [...consumablesList];
    const previousGlobalConsumables = [...globalConsumables];

    const tempId = Date.now();
    let targetId = existingEventConsumable ? existingEventConsumable.eventConsumableId : tempId;

    // Optimistic Update
    if (existingEventConsumable) {
      setConsumablesList(prev =>
        prev.map(ec => 
          ec.eventConsumableId === existingEventConsumable.eventConsumableId 
            ? { ...ec, quantityPacked: ec.quantityPacked + count } 
            : ec
        )
      );
    } else {
      const newEC: ExtendedConsumableItem = {
        eventConsumableId: tempId,
        consumableId: consumable.id,
        name: consumable.name,
        quantityPacked: count,
        quantityRequired: count,
        locationId: targetBoxId
      };
      setConsumablesList(prev => [...prev, newEC]);
    }

    setGlobalConsumables(prev =>
      prev.map(c => c.id === consumable.id ? { ...c, quantity_stored: Math.max(0, Number(c.quantity_stored) - count) } : c)
    );

    setPackingModal(null);
    setRecentlyUpdatedId(`cons-${targetId}`);
    setTimeout(() => {
      setRecentlyUpdatedId(prev => prev === `cons-${targetId}` ? null : prev);
    }, 1000);

    if (isDemoMode) {
      showToast(`Dodano ${count} szt. "${consumable.name}"`);
      setTimeout(() => {
        window.dispatchEvent(new Event('stock-updated'));
      }, 50);
      return;
    }

    try {
      const newWarehouseQty = Number(consumable.quantity_stored) - count;
      const { error: warehouseError } = await supabase
        .from('consumables')
        .update({ quantity_stored: newWarehouseQty })
        .eq('id', consumable.id);

      if (warehouseError) throw warehouseError;

      if (existingEventConsumable) {
        const newPackedQty = Number(existingEventConsumable.quantityPacked) + count;
        const { error: eventConsError } = await supabase
          .from('event_consumables')
          .update({ quantity_packed: newPackedQty })
          .eq('id', existingEventConsumable.eventConsumableId);
          
        if (eventConsError) throw eventConsError;
      } else {
        const { error: insertError } = await supabase
          .from('event_consumables')
          .insert({
            consumable_id: consumable.id,
            location_id: targetBoxId,
            quantity_packed: count,
            quantity_required: count
          });
          
        if (insertError) throw insertError;
      }

      showToast(`Spakowano ${count} szt. "${consumable.name}"`);
      window.dispatchEvent(new Event('stock-updated'));
      fetchData(); // Sync IDs after real insert
    } catch (err: any) {
      console.error(err);
      setConsumablesList(previousConsumablesList);
      setGlobalConsumables(previousGlobalConsumables);
      showToast(`Błąd zapisu: ${err.message || 'Brak połączenia'}`, 'error');
    }
  };

  const getBoxName = (boxId: number) => {
    const box = boxes.find(b => b.id === boxId);
    return box ? box.name : `Skrzynia #${boxId}`;
  };

  const filteredItems = items.filter(item => {
    if (activeBoxId !== null && item.location_id !== activeBoxId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = item.name.toLowerCase().includes(q);
      const matchesId = item.id.toString() === q || `i${item.id}` === q;
      const matchesResp = (item.responsible_person || '').toLowerCase().includes(q);
      return matchesName || matchesId || matchesResp;
    }
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortKey === 'id') {
      valA = a.id;
      valB = b.id;
    } else if (sortKey === 'responsible') {
      valA = (a.responsible_person || '').toLowerCase();
      valB = (b.responsible_person || '').toLowerCase();
    } else if (sortKey === 'status') {
      valA = a.status;
      valB = b.status;
    } else if (sortKey === 'box') {
      valA = getBoxName(a.location_id).toLowerCase();
      valB = getBoxName(b.location_id).toLowerCase();
    } else {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredConsumables = consumablesList.filter(cons => {
    if (activeBoxId !== null && cons.locationId !== activeBoxId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = cons.name.toLowerCase().includes(q);
      const matchesId = cons.consumableId.toString() === q || `c${cons.consumableId}` === q;
      return matchesName || matchesId;
    }
    return true;
  });

  const sortedConsumables = [...filteredConsumables].sort((a, b) => {
    let valA: any = '';
    let valB: any = '';

    if (sortKey === 'id') {
      valA = a.consumableId;
      valB = b.consumableId;
    } else if (sortKey === 'qty') {
      valA = a.quantityPacked;
      valB = b.quantityPacked;
    } else if (sortKey === 'min_qty') {
      valA = a.quantityRequired;
      valB = b.quantityRequired;
    } else if (sortKey === 'box') {
      valA = getBoxName(a.locationId).toLowerCase();
      valB = getBoxName(b.locationId).toLowerCase();
    } else {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      <div className="space-y-2">
        <Link href="/zawody" className="inline-flex items-center gap-1 text-sm text-zinc-455 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Powrót do listy wyjazdów
        </Link>
        
        {event ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Trophy className="h-7 w-7 text-blue-400 shrink-0" />
                {event.name}
              </h1>
              <div className="flex items-center gap-2 text-zinc-350 text-sm mt-1.5 font-medium">
                <Calendar className="h-4 w-4 text-blue-400 shrink-0" />
                <span>Wyjazd: <span className="text-white font-bold">{event.start_date}</span></span>
                <span className="text-zinc-800">•</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                  {event.is_active ? 'Przygotowania aktywne' : 'Wyjazd zakończony'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={fetchData} 
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-850 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 active:scale-95 duration-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Odśwież stan
            </button>
          </div>
        ) : (
          <div className="h-20 bg-zinc-900/60 animate-pulse rounded-xl" />
        )}
      </div>

      {isDemoMode && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-amber-400 text-xs">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
          <span>Ekran w trybie demonstracyjnym. Dodawanie/edycja skrzyń, skanowanie kodów i wymagania materiałowe są symulowane.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-300 text-xs tracking-wider uppercase">Skrzynie Wyjazdowe</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-zinc-950 border border-zinc-800 text-zinc-300 rounded font-mono">
                {boxes.length}
              </span>
            </div>

            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              <button
                onClick={() => {
                  setActiveBoxId(null);
                  setScanSuccess(null);
                  setScanError(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  activeBoxId === null
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/35 font-bold shadow-lg shadow-blue-500/[0.02]'
                    : 'bg-zinc-950/90 text-zinc-300 border-zinc-800/80 hover:bg-zinc-900 hover:text-white hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Wszystkie skrzynie</span>
                </div>
                {activeBoxId === null && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
              </button>

              {boxes.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-550 border border-dashed border-zinc-800 rounded-xl">
                  Brak skrzyń. Stwórz nową skrzynię poniżej.
                </div>
              ) : (
                boxes.map((box) => {
                  const boxItems = items.filter(i => i.location_id === box.id);
                  const packedBoxItems = boxItems.filter(i => i.status === 'packed');
                  const boxConsumables = consumablesList.filter(c => c.locationId === box.id);
                  const packedBoxConsumables = boxConsumables.filter(c => c.quantityPacked >= c.quantityRequired);
                  
                  const totalItems = boxItems.length + boxConsumables.length;
                  const packedItems = packedBoxItems.length + packedBoxConsumables.length;
                  const isBoxActive = activeBoxId === box.id;
                  const allPacked = totalItems > 0 && packedItems === totalItems;

                  return (
                    <div key={box.id} className="flex gap-1.5 items-center">
                      <button
                        onClick={() => {
                          setActiveBoxId(box.id);
                          setScanSuccess(null);
                          setScanError(null);
                        }}
                        className={`flex-1 flex flex-col items-start px-3.5 py-2.5 rounded-xl text-sm transition-all border text-left ${
                          isBoxActive
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/35 font-bold shadow-lg shadow-blue-500/[0.02]'
                            : 'bg-zinc-950/90 text-zinc-300 border-zinc-800/80 hover:bg-zinc-900 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`font-bold truncate pr-2 text-sm ${isBoxActive ? 'text-blue-400' : 'text-zinc-100'}`}>{box.name}</span>
                          {isBoxActive && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                        </div>
                        
                        <div className="flex justify-between items-center w-full mt-1.5 text-xs font-semibold">
                          <span className="text-zinc-400 truncate max-w-[80px] font-normal">{box.room || 'Brak lokacji'}</span>
                          <span className={allPacked ? 'text-emerald-400 font-bold' : 'text-zinc-300'}>
                            Spakowano: <span>{packedItems}/{totalItems}</span>
                          </span>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => openEditBoxModal(box)}
                        className="p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-900 transition-all active:scale-95 shrink-0"
                        title="Zarządzaj skrzynią"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-zinc-850 pt-4">
              <button
                type="button"
                onClick={() => setCreatingBox(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-950/30 border border-zinc-850 hover:border-zinc-800 rounded-lg transition-colors uppercase tracking-wider"
              >
                <span>{creatingBox ? 'Ukryj kreator' : 'Dodaj nową skrzynię'}</span>
                <Plus className={`h-4 w-4 transition-transform ${creatingBox ? 'rotate-45 text-rose-450' : ''}`} />
              </button>

              {creatingBox && (
                <form onSubmit={handleCreateBox} className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <input
                    type="text"
                    required
                    placeholder="Nazwa (np. Skrzynia Chemia)"
                    value={newBoxName}
                    onChange={(e) => setNewBoxName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Lokalizacja"
                      value={newBoxRoom}
                      onChange={(e) => setNewBoxRoom(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    <input
                      type="text"
                      placeholder="Opiekun"
                      value={newBoxResponsible}
                      onChange={(e) => setNewBoxResponsible(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs rounded-lg active:scale-95 transition-all duration-100"
                  >
                    Stwórz skrzynię
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-900/20 border border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Skrzynie Wyjazdowe</span>
                <div className="text-xl font-extrabold text-white mt-0.5">{boxes.length}</div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <LayoutDashboard className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Sprzęt Trwały</span>
                <div className="text-xl font-extrabold text-white mt-0.5">
                  {items.filter(i => i.status === 'packed').length} / {items.length}
                </div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-800 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Materiały Zużywalne</span>
                <div className="text-xl font-extrabold text-white mt-0.5">
                  {consumablesList.filter(c => c.quantityPacked >= c.quantityRequired).length} / {consumablesList.length}
                </div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <Boxes className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-850 pb-3 gap-3">
              <div className="flex space-x-6">
                <button
                  onClick={() => { setActiveTab('items'); setScanSuccess(null); setScanError(null); }}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'items'
                      ? 'border-blue-500 text-blue-400 font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Package className="h-4 w-4" />
                  Sprzęt Trwały ({filteredItems.length})
                </button>
                <button
                  onClick={() => { setActiveTab('consumables'); setScanSuccess(null); setScanError(null); }}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
                    activeTab === 'consumables'
                      ? 'border-blue-500 text-blue-400 font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Boxes className="h-4 w-4" />
                  Materiały Zużywalne ({filteredConsumables.length})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <ScannerButton 
                  onScan={handleScanCode} 
                  buttonText="Pakuj Skanerem" 
                  className="!bg-blue-500/10 !text-blue-400 !border !border-blue-500/20 hover:!bg-blue-500/20 hover:!text-blue-300 py-2 px-3 text-xs" 
                />
                {activeTab === 'items' ? (
                  <button
                    type="button"
                    onClick={() => setIsAssignItemModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-black bg-indigo-400 hover:bg-indigo-350 rounded-lg active:scale-95 transition-all shadow-sm shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Przypisz z warsztatu
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddReqModalOpen(true);
                      if (boxes.length > 0) {
                        setReqBoxId(boxes[0].id.toString());
                      }
                      if (globalConsumables.length > 0) {
                        setReqConsumableId(globalConsumables[0].id.toString());
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-black bg-teal-400 hover:bg-teal-355 rounded-lg active:scale-95 transition-all shadow-sm shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" /> Dodaj zapotrzebowanie
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder={activeTab === 'items' ? "Szukaj narzędzi po nazwie, ID, opiekunie..." : "Szukaj materiałów po nazwie, ID..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Sortowanie:</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  <option value="name" className="bg-zinc-950 text-zinc-200">Nazwa</option>
                  <option value="id" className="bg-zinc-950 text-zinc-200">ID</option>
                  {activeTab === 'items' ? (
                    <>
                      <option value="responsible" className="bg-zinc-950 text-zinc-200">Opiekun</option>
                      <option value="status" className="bg-zinc-950 text-zinc-200">Status</option>
                    </>
                  ) : (
                    <>
                      <option value="qty" className="bg-zinc-950 text-zinc-200">Spakowane</option>
                      <option value="min_qty" className="bg-zinc-950 text-zinc-200">Wymagane</option>
                    </>
                  )}
                  <option value="box" className="bg-zinc-950 text-zinc-200">Skrzynia</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-2 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg active:scale-95 transition-all"
                  title="Zmień kierunek sortowania"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="bg-zinc-950/40 border border-zinc-850/60 rounded-xl overflow-hidden divide-y divide-zinc-850 shadow-inner">
              {activeTab === 'items' ? (
                loading ? (
                  <div className="p-5 space-y-4">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="flex justify-between items-center bg-zinc-900/10 p-3.5 border border-zinc-850 animate-pulse rounded-xl">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-1/3 bg-zinc-800 rounded" />
                          <div className="h-3 w-1/4 bg-zinc-850 rounded" />
                        </div>
                        <div className="h-8 w-24 bg-zinc-800 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : sortedItems.length === 0 ? (
                  <div className="p-12 text-center text-zinc-550 text-xs space-y-2.5">
                    <Package className="h-10 w-10 text-zinc-700 mx-auto" />
                    <div className="font-semibold text-zinc-450">Brak dopasowanych narzędzi</div>
                    <p className="max-w-xs mx-auto text-zinc-550">
                      Spróbuj zmienić filtry lub przypisz nowe narzędzia z warsztatu za pomocą przycisku "+ Przypisz z warsztatu" u góry.
                    </p>
                  </div>
                ) : (
                  sortedItems.map((item) => {
                    const isPacked = item.status === 'packed';
                    const isHighlighted = recentlyUpdatedId === `item-${item.id}`;
                    
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 transition-all duration-305 border rounded-xl ${
                          isHighlighted
                            ? 'bg-blue-500/20 border-blue-500/40 shadow-md scale-[1.002]'
                            : isPacked
                              ? 'bg-blue-500/[0.03] border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/[0.05]'
                              : 'bg-rose-500/[0.03] border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/[0.05]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] font-bold text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
                              #{item.id}
                            </span>
                            <span className="font-bold text-white text-sm">{item.name}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1.5 text-[11px] font-semibold">
                            <span className="flex items-center gap-1 text-zinc-400">
                              Opiekun: <span className="text-zinc-200">{item.responsible_person || 'brak'}</span>
                            </span>
                            <span className="text-zinc-700 font-bold">•</span>
                            <span className="flex items-center gap-1 text-zinc-400">
                              Skrzynia: <span className="text-blue-400 font-bold">{getBoxName(item.location_id)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3.5 mt-2 sm:mt-0 pt-2.5 sm:pt-0 border-t border-zinc-900/60 sm:border-t-0">
                          {isPacked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                              <CheckCircle2 className="h-3 w-3 text-blue-500" />
                              Spakowany
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse shrink-0">
                              <AlertTriangle className="h-3 w-3 text-rose-500" />
                              Brakujący
                            </span>
                          )}

                          <div className="flex items-center gap-1.5 border-l border-zinc-900 pl-3">
                            {isPacked ? (
                              <button
                                type="button"
                                onClick={() => handleUnpackItem(item.id)}
                                className="px-2.5 py-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded-md active:scale-95 transition-all shrink-0"
                              >
                                Rozpakuj
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePackItem(item.id)}
                                className="px-2.5 py-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-md active:scale-95 transition-all shrink-0"
                              >
                                Spakuj
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleReturnToWorkshop(item.id)}
                              className="px-2.5 py-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded-md active:scale-95 transition-all shrink-0"
                              title="Zwróć sprzęt do warsztatu"
                            >
                              Wycofaj
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditItemModal(item)}
                              className="p-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 active:scale-95 transition-all"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                loading ? (
                  <div className="p-5 space-y-4">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="space-y-2 bg-zinc-900/10 p-3.5 border border-zinc-850 animate-pulse rounded-xl">
                        <div className="h-4 w-1/3 bg-zinc-800 rounded" />
                        <div className="h-2.5 w-full bg-zinc-950 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : sortedConsumables.length === 0 ? (
                  <div className="p-12 text-center text-zinc-550 text-xs space-y-2.5">
                    <Boxes className="h-10 w-10 text-zinc-700 mx-auto" />
                    <div className="font-semibold text-zinc-450">Brak zapotrzebowań materiałowych</div>
                    <p className="max-w-xs mx-auto text-zinc-550">
                      Dodaj zapotrzebowanie za pomocą przycisku "+ Dodaj zapotrzebowanie" u góry.
                    </p>
                  </div>
                ) : (
                  sortedConsumables.map((cons) => {
                    const percent = Math.min(100, Math.round((cons.quantityPacked / cons.quantityRequired) * 100));
                    const isComplete = percent >= 100;
                    const isHighlighted = recentlyUpdatedId === `cons-${cons.eventConsumableId}`;

                    return (
                      <div
                        key={cons.eventConsumableId}
                        className={`p-4 space-y-2.5 transition-all duration-305 border rounded-xl ${
                          isHighlighted
                            ? 'bg-blue-500/20 border-blue-500/40 shadow-md scale-[1.002]'
                            : isComplete
                              ? 'bg-blue-500/[0.03] border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/[0.05]'
                              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80 shadow-md shadow-black/5'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-white text-base">{cons.name}</span>
                            <span className="text-xs text-zinc-300 font-semibold font-mono ml-2.5 bg-zinc-950/80 border border-zinc-800/80 px-2.5 py-1 rounded">
                              Skrzynia: <span className="text-blue-400 font-bold">{getBoxName(cons.locationId)}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleAdjustConsumable(cons.eventConsumableId, cons.consumableId, -1)}
                                className="p-1 text-zinc-400 hover:text-rose-500 hover:bg-zinc-900 rounded active:scale-75 transition-transform"
                                title="Odejmij 1 szt."
                              >
                                <Minus className="h-3 w-3" />
                              </button>

                              <span className={`font-mono text-sm font-bold min-w-[70px] text-center ${isComplete ? 'text-blue-400' : 'text-zinc-200'}`}>
                                {cons.quantityPacked} / {cons.quantityRequired}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleAdjustConsumable(cons.eventConsumableId, cons.consumableId, 1)}
                                className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-zinc-900 rounded active:scale-75 transition-transform"
                                title="Dodaj 1 szt."
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => openEditReqModal(cons)}
                              className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 active:scale-95 transition-transform"
                              title="Koryguj zapotrzebowanie"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <div className="h-2 w-full bg-zinc-950 border border-zinc-850/65 rounded-full overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isComplete
                                  ? 'bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0_0_8px_rgba(59,130,246,0.35)]'
                                  : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {packingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-400" />
                Pakowanie materiału do skrzyni
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Wkładasz materiał eksploatacyjny do skrzyni: <span className="font-semibold text-blue-400">{getBoxName(packingModal.targetBoxId || activeBoxId || parseInt(scanTargetBoxId))}</span>
              </p>
            </div>

            <form onSubmit={handleConfirmConsumablePack} className="p-6 space-y-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                <div className="text-xs text-zinc-500 font-mono">ID materiału: #{packingModal.consumable.id}</div>
                <div className="font-bold text-white text-base">{packingModal.consumable.name}</div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 text-xs border-t border-zinc-850 mt-2">
                  <div>
                    <span className="text-zinc-500 block">W magazynie koła:</span>
                    <span className="font-bold text-blue-400 text-sm font-mono">{packingModal.consumable.quantity_stored} szt.</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Już spakowano:</span>
                    <span className="font-bold text-zinc-300 text-sm font-mono">{packingModal.existingEventConsumable?.quantityPacked || 0} szt.</span>
                  </div>
                </div>
              </div>

              {packingModal.existingEventConsumable && (
                <div className="text-xs text-amber-500 bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg">
                  Wymagane na wyjazd: <span className="font-bold">{packingModal.existingEventConsumable.quantityRequired} szt.</span> 
                  (Brakuje jeszcze: <span className="font-bold">{Math.max(0, packingModal.existingEventConsumable.quantityRequired - packingModal.existingEventConsumable.quantityPacked)} szt.</span>)
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Ile sztuk dorzucasz?
                </label>
                <input
                  type="number"
                  min="1"
                  max={packingModal.consumable.quantity_stored}
                  required
                  value={qtyToPack}
                  onChange={(e) => setQtyToPack(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setPackingModal(null)}
                  className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-sm bg-blue-500 text-black font-bold hover:bg-blue-400 transition-colors"
                >
                  Potwierdź pakowanie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBoxEditModalOpen && editingBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Edytuj / Usuń Skrzynię
              </h3>
              <button 
                onClick={() => setIsBoxEditModalOpen(false)}
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditBoxSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Nazwa skrzyni wyjazdowej
                </label>
                <input
                  type="text"
                  required
                  value={editBoxName}
                  onChange={(e) => setEditBoxName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Pokój / Ciężarówka / Miejsce docelowe
                </label>
                <input
                  type="text"
                  placeholder="np. Pokój 102 / Ciężarówka"
                  value={editBoxRoom}
                  onChange={(e) => setEditBoxRoom(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun skrzyni
                </label>
                <input
                  type="text"
                  placeholder="np. Jan Kowalski"
                  value={editBoxResponsible}
                  onChange={(e) => setEditBoxResponsible(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteBox(editingBox.id)}
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-rose-500/10 text-rose-455 border border-rose-500/25 hover:bg-rose-500/20 transition-all font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Usuń skrzynię
                </button>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBoxEditModalOpen(false)}
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

      {isReqEditModalOpen && editingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-400" />
                Edytuj Zapotrzebowanie
              </h3>
              <button 
                onClick={() => setIsReqEditModalOpen(false)}
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditReqSubmit} className="p-6 space-y-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850">
                <div className="text-xs text-zinc-550">Nazwa materiału:</div>
                <div className="font-bold text-white text-base mt-0.5">{editingReq.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Wymagane na wyjazd
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reqQtyRequired}
                    onChange={(e) => setReqQtyRequired(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Aktualnie spakowane
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={reqQtyPacked}
                    onChange={(e) => setReqQtyPacked(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Spakowane do skrzyni
                </label>
                <select
                  value={reqLocationId}
                  onChange={(e) => setReqLocationId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                >
                  {boxes.map(box => (
                    <option key={box.id} value={box.id} className="bg-zinc-950 text-zinc-200">{box.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteReq(editingReq.eventConsumableId)}
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Usuń zapotrzebowanie
                </button>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReqEditModalOpen(false)}
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

      {isAssignItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-400" />
                Przypisz Sprzęt z Warsztatu
              </h3>
              <button 
                type="button"
                onClick={() => setIsAssignItemModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const itemId = assignItemId;
                const boxId = parseInt(assignBoxId);
                if (itemId && boxId) {
                  handleAssignItem(itemId, boxId);
                } else {
                  alert('Wybierz sprzęt oraz docelową skrzynię!');
                }
              }} 
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Wybierz narzędzie z warsztatu
                </label>
                {workshopItems.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-500 border border-zinc-800">
                    Brak wolnych narzędzi w warsztacie. Wszystkie są przypisane do wydarzeń!
                  </div>
                ) : (
                  <select
                    value={assignItemId}
                    onChange={(e) => setAssignItemId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-200">-- Wybierz narzędzie --</option>
                    {workshopItems.map(item => (
                      <option key={item.id} value={item.id} className="bg-zinc-950 text-zinc-200">
                        {item.name} (ID: #{item.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Docelowa skrzynia wyjazdowa
                </label>
                {boxes.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-500 border border-zinc-800">
                    Brak skrzyń dla tego wyjazdu. Najpierw utwórz skrzynię!
                  </div>
                ) : (
                  <select
                    value={assignBoxId}
                    onChange={(e) => setAssignBoxId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-200">-- Wybierz skrzynię --</option>
                    {boxes.map(box => (
                      <option key={box.id} value={box.id} className="bg-zinc-950 text-zinc-200">{box.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAssignItemModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={workshopItems.length === 0 || boxes.length === 0}
                  className="px-5 py-2 rounded-lg text-sm bg-indigo-500 text-white font-semibold hover:bg-indigo-400 transition-colors disabled:opacity-30"
                >
                  Przypisz do wyjazdu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isItemModalOpen && (
        <ItemEditModal
          isOpen={isItemModalOpen}
          onClose={() => {
            setIsItemModalOpen(false);
            setSelectedItemForModal(null);
          }}
          editingItem={selectedItemForModal}
          locations={[...boxes, ...permanentLocations]}
          categories={categories}
          isDemoMode={isDemoMode}
          onSave={fetchData}
          itemsList={[...items, ...workshopItems]}
          onSaveDemo={(item, isEdit) => {
            if (isEdit) {
              mockItems.forEach((i, idx) => {
                if (i.id === item.id) {
                  mockItems[idx] = item;
                }
              });
            } else {
              mockItems.push(item);
            }
            fetchData();
          }}
        />
      )}

      {isAddReqModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="h-5 w-5 text-teal-400" />
                Dodaj Zapotrzebowanie na Materiał
              </h3>
              <button 
                type="button"
                onClick={() => setIsAddReqModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddRequirement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Wybierz materiał z magazynu
                </label>
                {globalConsumables.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-500 border border-zinc-800">
                    Brak zdefiniowanych materiałów w magazynie.
                  </div>
                ) : (
                  <select
                    value={reqConsumableId}
                    onChange={(e) => setReqConsumableId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-200">-- Wybierz materiał --</option>
                    {globalConsumables.map(cons => (
                      <option key={cons.id} value={cons.id} className="bg-zinc-950 text-zinc-200">
                        {cons.name} (Stan: {cons.quantity_stored} szt.)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Skrzynia docelowa
                </label>
                {boxes.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-500 border border-zinc-800">
                    Brak skrzyń dla tego wyjazdu. Najpierw utwórz skrzynię!
                  </div>
                ) : (
                  <select
                    value={reqBoxId}
                    onChange={(e) => setReqBoxId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="" className="bg-zinc-950 text-zinc-200">-- Wybierz skrzynię --</option>
                    {boxes.map(box => (
                      <option key={box.id} value={box.id} className="bg-zinc-950 text-zinc-200">{box.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Wymagana ilość (szt.)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={reqQtyVal}
                  onChange={(e) => setReqQtyVal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun zapotrzebowania (opcjonalnie)
                </label>
                <input
                  type="text"
                  placeholder="Domyślnie właściciel wybranej skrzyni"
                  value={reqResponsible}
                  onChange={(e) => setReqResponsible(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddReqModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={globalConsumables.length === 0 || boxes.length === 0}
                  className="px-5 py-2 rounded-lg text-sm bg-teal-400 text-black font-bold hover:bg-teal-300 transition-colors disabled:opacity-30"
                >
                  Dodaj zapotrzebowanie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 ${
          toast.type === 'success' 
            ? 'bg-zinc-950 border-blue-500/35 text-blue-400' 
            : 'bg-zinc-950 border-rose-500/35 text-rose-455'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-550" />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
