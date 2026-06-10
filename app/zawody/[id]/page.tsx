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
  DatabaseEventConsumable 
} from '@/utils/supabase/client';
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
  Minus
} from 'lucide-react';

interface ExtendedConsumableItem {
  eventConsumableId: number;
  consumableId: number;
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
  const [items, setItems] = useState<DatabaseItem[]>([]);
  const [consumablesList, setConsumablesList] = useState<ExtendedConsumableItem[]>([]);
  const [globalConsumables, setGlobalConsumables] = useState<DatabaseConsumable[]>([]);
  
  // New States
  const [workshopItems, setWorkshopItems] = useState<DatabaseItem[]>([]);
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
  } | null>(null);
  const [qtyToPack, setQtyToPack] = useState<string>('1');

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

  // 6. Item Edit Modal
  const [isItemEditModalOpen, setIsItemEditModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DatabaseItem | null>(null);
  const [editItemStatus, setEditItemStatus] = useState<'in_workshop' | 'assigned_to_event' | 'packed'>('assigned_to_event');
  const [editItemLocationId, setEditItemLocationId] = useState<string>('');
  const [editItemResponsible, setEditItemResponsible] = useState<string>('');

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

  const mockItems: DatabaseItem[] = [
    { id: 101, name: 'Szlifierka kątowa Bosch', location_id: 1, responsible_person: 'Jan Nowak', shop_link: '', status: 'in_workshop' },
    { id: 102, name: 'Wkrętarka Makita 18V', location_id: 301, responsible_person: 'Jan Nowak', shop_link: '', status: 'assigned_to_event' },
    { id: 103, name: 'Lutownica TS101', location_id: 302, responsible_person: 'Kamil Wiśniewski', shop_link: '', status: 'packed' },
    { id: 104, name: 'Dremel 4000', location_id: 1, responsible_person: 'Adam Kowalski', shop_link: '', status: 'in_workshop' },
    { id: 105, name: 'Zestaw kluczy płaskich', location_id: 301, responsible_person: 'Adam Kowalski', shop_link: '', status: 'assigned_to_event' },
    { id: 106, name: 'Oscyloskop Siglent', location_id: 302, responsible_person: 'Michał Zieliński', shop_link: '', status: 'packed' },
    { id: 107, name: 'Zasilacz laboratoryjny Korad', location_id: 2, responsible_person: 'Kamil Wiśniewski', shop_link: '', status: 'in_workshop' }
  ];

  const mockEventConsumables: ExtendedConsumableItem[] = [
    { eventConsumableId: 501, consumableId: 201, name: 'Frezy węglikowe 2mm', quantityPacked: 2, quantityRequired: 5, locationId: 301 },
    { eventConsumableId: 502, consumableId: 202, name: 'Cyna bezołowiowa Sn99', quantityPacked: 8, quantityRequired: 8, locationId: 302 },
    { eventConsumableId: 503, consumableId: 203, name: 'Śruby M3x10 imbusowe (szt)', quantityPacked: 50, quantityRequired: 150, locationId: 301 }
  ];

  const mockConsumables: DatabaseConsumable[] = [
    { id: 201, name: 'Frezy węglikowe 2mm', quantity_stored: 12, min_quantity: 10, shop_link: '', location_id: 1, responsible_person: null },
    { id: 202, name: 'Cyna bezołowiowa Sn99', quantity_stored: 4, min_quantity: 5, shop_link: '', location_id: 2, responsible_person: null },
    { id: 203, name: 'Śruby M3x10 imbusowe (szt)', quantity_stored: 340, min_quantity: 200, shop_link: '', location_id: 1, responsible_person: null }
  ];

  const mockPermanentLocations: DatabaseLocation[] = [
    { id: 1, name: 'Szafa A (Narzędziowa)', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Jan Nowak' },
    { id: 2, name: 'Szafa B (Materiały)', type: 'permanent', event_id: null, room: 'Warsztat Główny', responsible_person: 'Kamil Wiśniewski' },
    { id: 3, name: 'Regał C (Pudełka)', type: 'permanent', event_id: null, room: 'Korytarz', responsible_person: 'Bernie' }
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
      
      if (loadedBoxes.length > 0 && !activeBoxId) {
        setActiveBoxId(loadedBoxes[0].id);
      }

      // Fetch items assigned to this event
      const boxIds = loadedBoxes.map(b => b.id);
      let loadedItems: DatabaseItem[] = [];
      if (boxIds.length > 0) {
        const itemsRes = await supabase.from('items').select('*').in('location_id', boxIds);
        loadedItems = itemsRes.data || [];
      }
      setItems(loadedItems);

      // Fetch items currently in workshop (status = in_workshop)
      const workshopItemsRes = await supabase.from('items').select('*').eq('status', 'in_workshop');
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
      setIsDemoMode(false);
    } catch (err) {
      console.warn('Failed to load Supabase data, running mock environment:', err);
      setIsDemoMode(true);
      
      setEvent(mockEvent);
      setBoxes(mockBoxes);
      setActiveBoxId(activeBoxId || mockBoxes[0].id);
      setItems(mockItems.filter(i => i.status !== 'in_workshop'));
      setWorkshopItems(mockItems.filter(i => i.status === 'in_workshop'));
      setPermanentLocations(mockPermanentLocations);
      setGlobalConsumables(mockConsumables);
      setConsumablesList(mockEventConsumables);
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
        const remaining = boxes.filter(b => b.id !== boxId);
        setActiveBoxId(remaining.length > 0 ? remaining[0].id : null);
      }
      setIsBoxEditModalOpen(false);
      setModalLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from('locations').delete().eq('id', boxId);
      if (error) throw error;

      setIsBoxEditModalOpen(false);
      const remaining = boxes.filter(b => b.id !== boxId);
      setActiveBoxId(remaining.length > 0 ? remaining[0].id : null);
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
  const openEditItemModal = (item: DatabaseItem) => {
    setEditingItem(item);
    setEditItemStatus(item.status);
    setEditItemLocationId(item.location_id ? item.location_id.toString() : '');
    setEditItemResponsible(item.responsible_person || '');
    setIsItemEditModalOpen(true);
  };

  const handlePackItem = async (itemId: number) => {
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

  const handleUnpackItem = async (itemId: number) => {
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

  const handleReturnToWorkshop = async (itemId: number) => {
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

  const handleAssignItem = async (itemId: number, boxId: number) => {
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

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setModalLoading(true);
    const parsedBoxId = parseInt(editItemLocationId);

    if (isDemoMode) {
      // Update items status/location
      setItems(prev => prev.map(i => i.id === editingItem.id ? {
        ...i,
        status: editItemStatus,
        location_id: parsedBoxId,
        responsible_person: editItemResponsible
      } : i));

      // Update mockItems
      mockItems.forEach(i => {
        if (i.id === editingItem.id) {
          i.status = editItemStatus;
          i.location_id = parsedBoxId;
          i.responsible_person = editItemResponsible;
        }
      });

      // If status changed to in_workshop, filter it out from current checklist
      if (editItemStatus === 'in_workshop') {
        setItems(prev => prev.filter(i => i.id !== editingItem.id));
      }
      
      setWorkshopItems(mockItems.filter(i => i.status === 'in_workshop'));
      setIsItemEditModalOpen(false);
      setEditingItem(null);
      setModalLoading(false);
      setScanSuccess('Zapisano zmiany w sprzęcie (tryb demo).');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .update({
          status: editItemStatus,
          location_id: parsedBoxId,
          responsible_person: editItemResponsible || null
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      setIsItemEditModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      alert('Błąd zapisu sprzętu: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  // --- Consumables Quick Increments & Decrements ---
  const handleAdjustConsumable = async (eventConsumableId: number, consumableId: number, delta: number) => {
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

    const parsedConsId = parseInt(reqConsumableId);
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
  const handleScanCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanError(null);
    setScanSuccess(null);
    setScannedItem(null);

    if (!activeBoxId) {
      setScanError('Wybierz lub stwórz najpierw skrzynię, do której pakujesz.');
      return;
    }

    const rawInput = scanInput.trim();
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

    if (isDemoMode) {
      const scannedItemVal = (searchType === 'any' || searchType === 'item') 
        ? mockItems.find(i => i.id === id) 
        : null;

      const scannedConsVal = (searchType === 'any' || searchType === 'consumable') 
        ? mockConsumables.find(c => c.id === id) 
        : null;

      if (searchType === 'any' && scannedItemVal && scannedConsVal) {
        setScanError(`Kolizja ID: znaleziono sprzęt i materiał o ID ${id}. Wpisz I${id} dla sprzętu lub C${id} dla materiału.`);
        return;
      }

      if (scannedItemVal) {
        setScannedItem(scannedItemVal);
        setScanSuccess(`Znaleziono sprzęt trwały: "${scannedItemVal.name}" (ID #${scannedItemVal.id}). Możesz teraz zarządzać jego statusem i przypisaniem.`);
        setScanInput('');
        return;
      }

      if (scannedConsVal) {
        const existingEC = consumablesList.find(c => c.consumableId === id && c.locationId === activeBoxId);
        setPackingModal({
          isOpen: true,
          consumable: scannedConsVal,
          existingEventConsumable: existingEC
        });
        setQtyToPack('1');
        setScanInput('');
        return;
      }

      setScanError(`Nie znaleziono kodu: ${rawInput} w bazie.`);
      return;
    }

    try {
      let scannedItemVal = null;
      let scannedConsVal = null;

      if (searchType === 'any' || searchType === 'item') {
        const { data: itemData } = await supabase
          .from('items')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        scannedItemVal = itemData;
      }

      if (searchType === 'any' || searchType === 'consumable') {
        const { data: consData } = await supabase
          .from('consumables')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        scannedConsVal = consData;
      }

      if (searchType === 'any' && scannedItemVal && scannedConsVal) {
        setScanError(`Kolizja ID: znaleziono sprzęt i materiał o ID ${id}. Wpisz I${id} dla sprzętu lub C${id} dla materiału.`);
        return;
      }

      if (scannedItemVal) {
        setScannedItem(scannedItemVal);
        setScanSuccess(`Znaleziono sprzęt trwały: "${scannedItemVal.name}" (ID #${scannedItemVal.id}). Możesz teraz zarządzać jego statusem i przypisaniem.`);
        setScanInput('');
        return;
      }

      if (scannedConsVal) {
        const existingEC = consumablesList.find(c => c.consumableId === id && c.locationId === activeBoxId);
        setPackingModal({
          isOpen: true,
          consumable: scannedConsVal,
          existingEventConsumable: existingEC
        });
        setQtyToPack('1');
        setScanInput('');
        return;
      }

      setScanError(`Nie znaleziono kodu: ${rawInput} w bazie.`);
    } catch (err) {
      console.error(err);
      setScanError('Błąd podczas odczytu kodu.');
    }
  };

  const handleConfirmConsumablePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packingModal || !activeBoxId) return;

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
        locationId: activeBoxId
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
            location_id: activeBoxId,
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      {/* Back link & Title */}
      <div className="space-y-2">
        <Link href="/zawody" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Powrót do listy wyjazdów
        </Link>
        
        {event ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Trophy className="h-7 w-7 text-blue-400 shrink-0" />
                {event.name}
              </h1>
              <div className="flex items-center gap-2 text-zinc-400 text-sm mt-1.5">
                <Calendar className="h-4 w-4 text-zinc-550" />
                <span>Wyjazd: <span className="font-semibold text-zinc-200">{event.start_date}</span></span>
                <span className="text-zinc-650">•</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                  event.is_active 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {event.is_active ? 'Przygotowania aktywne' : 'Wyjazd zakończony'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={fetchData} 
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Odśwież stan
            </button>
          </div>
        ) : (
          <div className="h-20 bg-zinc-900 animate-pulse rounded-xl" />
        )}
      </div>

      {isDemoMode && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-amber-400 text-xs">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
          <span>Ekran w trybie demonstracyjnym. Dodawanie/edycja skrzyń, skanowanie kodów i wymagania materiałowe są symulowane.</span>
        </div>
      )}

      {/* Box Selection & Barcode Scanner Panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Box Picker Card */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-white text-md">1. Wybierz skrzynię pakowania</h3>
            <p className="text-zinc-550 text-xs mt-0.5">Wskaż skrzynię wyjazdową, do której aktualnie wkładasz sprzęt</p>
          </div>

          <div className="space-y-4">
            {/* Dropdown Selector */}
            {boxes.length === 0 ? (
              <div className="p-3 text-center text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg">
                Brak skrzyń przypisanych do tego wyjazdu. Stwórz skrzynię poniżej, aby rozpocząć pakowanie.
              </div>
            ) : (
              <div className="space-y-2">
                {boxes.map((box) => (
                  <div key={box.id} className="flex gap-2 items-center">
                    <button
                      onClick={() => {
                        setActiveBoxId(box.id);
                        setScanSuccess(null);
                        setScanError(null);
                      }}
                      className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all border ${
                        activeBoxId === box.id
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/40 font-semibold'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-900/50'
                      }`}
                    >
                      <span className="truncate">{box.name}</span>
                      {activeBoxId === box.id && <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />}
                    </button>
                    
                    <button
                      onClick={() => openEditBoxModal(box)}
                      className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      title="Zarządzaj skrzynią"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Box Creation */}
            <form onSubmit={handleCreateBox} className="border-t border-zinc-800/80 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">Dodaj nową skrzynię</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Nazwa (np. Skrzynia Chemia)"
                  value={newBoxName}
                  onChange={(e) => setNewBoxName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Pokój / Ciężarówka"
                    value={newBoxRoom}
                    onChange={(e) => setNewBoxRoom(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                  <input
                    type="text"
                    placeholder="Opiekun"
                    value={newBoxResponsible}
                    onChange={(e) => setNewBoxResponsible(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingBox}
                  className="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-black font-semibold text-xs rounded-lg transition-colors shrink-0 disabled:opacity-50 active:scale-95 duration-100"
                >
                  Stwórz skrzynię
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Barcode scanner mockup card */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-md">2. Zeskanuj przedmiot (Skaner Kodów)</h3>
              <p className="text-zinc-555 text-xs mt-0.5">
                Symulator odczytu kodu. Wpisz ID wiertarki (102), cyny (202), frezów (201) lub innego zasobu.
              </p>
            </div>
          </div>

          <form onSubmit={handleScanCode} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  required
                  placeholder={activeBoxId ? "Wpisz ID kodu przedmiotu..." : "Najpierw wybierz/stwórz skrzynię"}
                  disabled={!activeBoxId}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-blue-500/50 disabled:opacity-30"
                />
              </div>
              <button
                type="submit"
                disabled={!activeBoxId}
                className="px-6 py-2.5 bg-blue-500 text-black hover:bg-blue-400 font-bold text-sm rounded-lg transition-colors shrink-0 disabled:opacity-30"
              >
                Zeskanuj / Pakuj
              </button>
            </div>
          </form>

          {/* Scanner Feedback Messages */}
          {scanError && (
            <div className="p-3.5 rounded-lg border border-rose-500/25 bg-rose-500/5 text-rose-400 text-xs flex gap-2">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
              <span>{scanError}</span>
            </div>
          )}

          {scanSuccess && (
            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-blue-500" />
                <span>{scanSuccess}</span>
              </div>
              {scannedItem && (
                <button
                  type="button"
                  onClick={() => {
                    openEditItemModal(scannedItem);
                    setScanSuccess(null);
                    setScannedItem(null);
                  }}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs rounded-lg transition-colors shadow-sm whitespace-nowrap self-end sm:self-auto"
                >
                  Otwórz Edycję Zasobu
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Checklist / Panic Board Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        
        {/* Durable Items Checklist (Left Column) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-400" />
              Lista Paniki: Sprzęt Trwały
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAssignItemModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-indigo-400 hover:bg-indigo-300 rounded-lg transition-colors shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Przypisz z warsztatu
              </button>
              <span className="text-xs text-zinc-550 shrink-0">
                Spakowano: {items.filter(i => i.status === 'packed').length} / {items.length}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-850">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-zinc-850/50 rounded-xl bg-zinc-900/10 animate-pulse gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-12 bg-zinc-800 rounded" />
                        <div className="h-4 w-32 bg-zinc-800 rounded" />
                      </div>
                      <div className="h-3 w-40 bg-zinc-850 rounded" />
                    </div>
                    <div className="h-8 w-24 bg-zinc-800 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-sm space-y-2">
                <Package className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="font-semibold text-zinc-400">Brak narzędzi dla tego wyjazdu</p>
                <p className="text-xs max-w-xs mx-auto">
                  Zeskanuj ID dowolnego narzędzia trwałego (np. 101, 102) lub kliknij przycisk przypisywania powyżej, aby dodać je do wyjazdu.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const isPacked = item.status === 'packed';
                const isHighlighted = recentlyUpdatedId === `item-${item.id}`;
                return (
                  <div 
                    key={item.id}
                    className={`flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 transition-all duration-700 ease-out border border-transparent ${
                      isHighlighted 
                        ? 'bg-blue-500/25 border-blue-500/40 shadow-lg shadow-blue-500/5 scale-[1.005] duration-75' 
                        : isPacked 
                          ? 'bg-blue-500/[0.015] border-zinc-850 hover:bg-blue-500/[0.03]' 
                          : 'bg-rose-500/[0.01] border-zinc-850 hover:bg-rose-500/[0.02]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-550">#{item.id}</span>
                        <h4 className="font-bold text-zinc-100">{item.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                        <span>Opiekun: {item.responsible_person || 'brak'}</span>
                        <span className="text-zinc-700">•</span>
                        <span>Skrzynia: {getBoxName(item.location_id)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                      {isPacked ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                          Spakowany
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25 animate-pulse shrink-0">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                          Brakujący
                        </span>
                      )}

                      <div className="flex items-center gap-1 border-l border-zinc-800/85 pl-2 ml-1">
                        {isPacked ? (
                          <button
                            type="button"
                            onClick={() => handleUnpackItem(item.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 rounded-lg active:scale-90 transition-transform duration-100 shrink-0"
                          >
                            Rozpakuj
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePackItem(item.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-lg active:scale-90 transition-transform duration-100 shrink-0"
                          >
                            Spakuj
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleReturnToWorkshop(item.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 rounded-lg active:scale-90 transition-transform duration-100 shrink-0"
                          title="Zwróć do szafy warsztatowej"
                        >
                          Cofnij do szafy
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditItemModal(item)}
                          className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 active:scale-90 transition-transform duration-100 shrink-0"
                          title="Edytuj szczegóły"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Consumables Progress (Right Column) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Boxes className="h-5 w-5 text-teal-400" />
              Progress Wyjazdowy: Materiały Zużywalne
            </h2>
            <div className="flex items-center gap-3">
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Dodaj zapotrzebowanie
              </button>
              <span className="text-xs text-zinc-550 shrink-0">
                Pozycje skompletowane: {consumablesList.filter(c => c.quantityPacked >= c.quantityRequired).length} / {consumablesList.length}
              </span>
            </div>
          </div>

          <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden p-6 space-y-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="space-y-3 bg-zinc-900/10 p-4 border border-zinc-850/50 rounded-xl animate-pulse">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-1/3 bg-zinc-800 rounded" />
                      <div className="h-8 w-24 bg-zinc-800 rounded-lg" />
                    </div>
                    <div className="h-2 w-full bg-zinc-950 rounded-full" />
                  </div>
                ))}
              </div>
            ) : consumablesList.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-sm space-y-2">
                <Boxes className="h-10 w-10 text-zinc-700 mx-auto" />
                <p className="font-semibold text-zinc-400">Brak zapotrzebowania na materiały</p>
                <p className="text-xs">Zeskanuj ID materiału (np. 201) lub kliknij przycisk powyżej, aby dodać zapotrzebowanie.</p>
              </div>
            ) : (
              consumablesList.map((cons) => {
                const percent = Math.min(100, Math.round((cons.quantityPacked / cons.quantityRequired) * 100));
                const isComplete = percent >= 100;
                const isHighlighted = recentlyUpdatedId === `cons-${cons.eventConsumableId}`;

                return (
                  <div 
                    key={cons.eventConsumableId} 
                    className={`space-y-2 p-4 border transition-all duration-700 ease-out ${
                      isHighlighted 
                        ? 'bg-blue-500/25 border-blue-500/40 shadow-lg shadow-blue-500/5 scale-[1.005] duration-75' 
                        : isComplete 
                          ? 'bg-zinc-900/40 border-zinc-850/60 hover:bg-zinc-900/60' 
                          : 'bg-zinc-900/20 border-zinc-850/30 hover:bg-zinc-900/30'
                    } rounded-xl`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-bold text-zinc-200">{cons.name}</span>
                        <span className="text-xs text-zinc-550 ml-2 font-mono">({getBoxName(cons.locationId)})</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleAdjustConsumable(cons.eventConsumableId, cons.consumableId, -1)}
                            className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 rounded active:scale-75 transition-transform duration-100"
                            title="Rozpakuj 1 szt."
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          
                          <span className={`font-mono text-xs font-bold min-w-[65px] text-center ${isComplete ? 'text-blue-400' : 'text-zinc-450'}`}>
                            {cons.quantityPacked} / {cons.quantityRequired}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleAdjustConsumable(cons.eventConsumableId, cons.consumableId, 1)}
                            className="p-1 text-zinc-400 hover:text-blue-400 hover:bg-zinc-900 rounded active:scale-75 transition-transform duration-100"
                            title="Spakuj 1 szt."
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => openEditReqModal(cons)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700 text-zinc-450 active:scale-90 transition-transform duration-100"
                          title="Koryguj zapotrzebowanie"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-zinc-950 border border-zinc-850 rounded-full overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          isComplete 
                            ? 'bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' 
                            : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. Modal: Package Consumable Popup (Scanner helper) */}
      {packingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-400" />
                Pakowanie materiału do skrzyni
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Wkładasz materiał eksploatacyjny do skrzyni: <span className="font-semibold text-blue-400">{getBoxName(activeBoxId!)}</span>
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

      {/* 2. Modal: Edit Box Name / Delete Box */}
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

              {/* Action buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteBox(editingBox.id)}
                  disabled={modalLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all font-semibold"
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

      {/* 3. Modal: Edit/Delete Event Consumables Requirement */}
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
                {/* Qty Required */}
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

                {/* Qty Packed */}
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

              {/* Target Box Select */}
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
                    <option key={box.id} value={box.id}>{box.name}</option>
                  ))}
                </select>
              </div>

              {/* Action buttons */}
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

      {/* 4. Modal: Przypisz Sprzęt z Warsztatu */}
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
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const itemId = parseInt(assignItemId);
                const boxId = parseInt(assignBoxId);
                if (itemId && boxId) {
                  handleAssignItem(itemId, boxId);
                } else {
                  alert('Wybierz sprzęt oraz docelową skrzynię!');
                }
              }} 
              className="p-6 space-y-4"
            >
              {/* Item selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Wybierz narzędzie z warsztatu
                </label>
                {workshopItems.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-550 border border-zinc-850">
                    Brak wolnych narzędzi w warsztacie. Wszystkie są przypisane do wydarzeń!
                  </div>
                ) : (
                  <select
                    value={assignItemId}
                    onChange={(e) => setAssignItemId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="">-- Wybierz narzędzie --</option>
                    {workshopItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (ID: #{item.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target box selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Docelowa skrzynia wyjazdowa
                </label>
                {boxes.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-550 border border-zinc-850">
                    Brak skrzyń dla tego wyjazdu. Najpierw utwórz skrzynię!
                  </div>
                ) : (
                  <select
                    value={assignBoxId}
                    onChange={(e) => setAssignBoxId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="">-- Wybierz skrzynię --</option>
                    {boxes.map(box => (
                      <option key={box.id} value={box.id}>{box.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Action buttons */}
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

      {/* 5. Modal: Dodaj Zapotrzebowanie */}
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
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddRequirement} className="p-6 space-y-4">
              {/* Consumable select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Wybierz materiał z magazynu
                </label>
                {globalConsumables.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-550 border border-zinc-850">
                    Brak zdefiniowanych materiałów w magazynie.
                  </div>
                ) : (
                  <select
                    value={reqConsumableId}
                    onChange={(e) => setReqConsumableId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="">-- Wybierz materiał --</option>
                    {globalConsumables.map(cons => (
                      <option key={cons.id} value={cons.id}>
                        {cons.name} (Stan: {cons.quantity_stored} szt.)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target box select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Skrzynia docelowa
                </label>
                {boxes.length === 0 ? (
                  <div className="p-3 text-xs bg-zinc-950 rounded-lg text-zinc-550 border border-zinc-850">
                    Brak skrzyń dla tego wyjazdu. Najpierw utwórz skrzynię!
                  </div>
                ) : (
                  <select
                    value={reqBoxId}
                    onChange={(e) => setReqBoxId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    <option value="">-- Wybierz skrzynię --</option>
                    {boxes.map(box => (
                      <option key={box.id} value={box.id}>{box.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Qty Required */}
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

              {/* Responsible Person */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun zapotrzebowania (opcjonalnie)
                </label>
                <input
                  type="text"
                  placeholder="Domyślnie właściciel wybranej skrzyni"
                  value={reqResponsible}
                  onChange={(e) => setReqResponsible(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action buttons */}
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
                  className="px-5 py-2 rounded-lg text-sm bg-teal-400 text-black font-bold hover:bg-teal-350 transition-colors disabled:opacity-30"
                >
                  Dodaj zapotrzebowanie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Edytuj Szczegóły Sprzętu Trwałego */}
      {isItemEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Zarządzaj Przedmiotem
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsItemEditModalOpen(false);
                  setEditingItem(null);
                }}
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="p-6 space-y-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850">
                <div className="text-xs text-zinc-555">Nazwa przedmiotu:</div>
                <div className="font-bold text-white text-base mt-0.5">{editingItem.name}</div>
                <div className="text-[11px] text-zinc-555 font-mono mt-1">ID zasobu: #{editingItem.id}</div>
              </div>

              {/* Status Select */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Status zasobu
                </label>
                <select
                  value={editItemStatus}
                  onChange={(e) => {
                    const newStatus = e.target.value as any;
                    setEditItemStatus(newStatus);
                    if (newStatus === 'in_workshop') {
                      const defaultLoc = permanentLocations.length > 0 ? permanentLocations[0].id.toString() : '1';
                      setEditItemLocationId(defaultLoc);
                    } else if (boxes.length > 0 && (editingItem.status === 'in_workshop' || !editItemLocationId)) {
                      setEditItemLocationId(boxes[0].id.toString());
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                >
                  <option value="in_workshop">W warsztacie (Niewyjeżdżający)</option>
                  <option value="assigned_to_event">Przypisany na wyjazd (Brakujący)</option>
                  <option value="packed">Spakowany do skrzyni</option>
                </select>
              </div>

              {/* Location Select (conditional depending on status) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  {editItemStatus === 'in_workshop' ? 'Lokalizacja w warsztacie (Szafa)' : 'Skrzynia docelowa na wyjeździe'}
                </label>
                {editItemStatus === 'in_workshop' ? (
                  <select
                    value={editItemLocationId}
                    onChange={(e) => setEditItemLocationId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    {permanentLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.room ? `(${loc.room})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={editItemLocationId}
                    onChange={(e) => {
                      setEditItemLocationId(e.target.value);
                      const targetBox = boxes.find(b => b.id.toString() === e.target.value);
                      if (targetBox?.responsible_person) {
                        setEditItemResponsible(targetBox.responsible_person);
                      }
                    }}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 appearance-none"
                  >
                    {boxes.map(box => (
                      <option key={box.id} value={box.id}>{box.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Responsible Person */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Opiekun sprzętu
                </label>
                <input
                  type="text"
                  required
                  value={editItemResponsible}
                  onChange={(e) => setEditItemResponsible(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800/80 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsItemEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-lg text-sm bg-blue-500 text-black font-bold hover:bg-blue-400 transition-colors disabled:opacity-50"
                >
                  Zapisz zmiany
                </button>
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
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
