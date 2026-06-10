'use client';

import React, { useEffect, useState } from 'react';
import { 
  supabase, 
  DatabaseConsumable, 
  DatabaseShoppingListItem, 
  DatabaseLocation 
} from '@/utils/supabase/client';
import { 
  ExternalLink, 
  Check, 
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  ArrowRight,
  ShoppingBag,
  PackageOpen,
  PackageCheck,
  Search,
  ShoppingCart,
  Inbox
} from 'lucide-react';
import SearchableSelect from '@/app/components/SearchableSelect';

export default function ZakupyPage() {
  const [lowStockItems, setLowStockItems] = useState<DatabaseConsumable[]>([]);
  const [shoppingList, setShoppingList] = useState<DatabaseShoppingListItem[]>([]);
  const [locations, setLocations] = useState<DatabaseLocation[]>([]);
  const [allConsumables, setAllConsumables] = useState<DatabaseConsumable[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Filter for shopping list
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ordered' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Restock Modal state
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedRestockItem, setSelectedRestockItem] = useState<DatabaseConsumable | null>(null);
  const [restockQtyToAdd, setRestockQtyToAdd] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // 2. New Shopping List Request Modal state
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [newReqName, setNewReqName] = useState('');
  const [newReqType, setNewReqType] = useState<'item' | 'consumable'>('consumable');
  const [newReqQty, setNewReqQty] = useState('1');
  const [newReqShopLink, setNewReqShopLink] = useState('');
  const [newReqPrice, setNewReqPrice] = useState('');
  const [newReqSuggestedBy, setNewReqSuggestedBy] = useState('');
  const [newReqSubmitting, setNewReqSubmitting] = useState(false);

  // 3. Receive into Warehouse Modal state
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedReceiveItem, setSelectedReceiveItem] = useState<DatabaseShoppingListItem | null>(null);
  const [receiveMode, setReceiveMode] = useState<'new' | 'existing'>('existing');
  const [receiveExistingConsId, setReceiveExistingConsId] = useState('');
  const [receiveLocationId, setReceiveLocationId] = useState('');
  const [receiveResponsiblePerson, setReceiveResponsiblePerson] = useState('');
  const [receiveMinQty, setReceiveMinQty] = useState('10');
  const [receiveItemName, setReceiveItemName] = useState('');
  const [receiveItemLink, setReceiveItemLink] = useState('');
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  // Initial Mock data for fallback
  const mockConsumables: DatabaseConsumable[] = [
    { id: 201, name: 'Frezy węglikowe 2mm', quantity_stored: 3, min_quantity: 10, shop_link: 'https://allegro.pl', location_id: 1, responsible_person: 'Jan Kowalski' },
    { id: 203, name: 'Śruby M3x10 imbusowe (szt)', quantity_stored: 120, min_quantity: 200, shop_link: 'https://sruby.pl', location_id: 1, responsible_person: 'Adam Nowak' },
    { id: 204, name: 'Opaski zaciskowe czarne (szt)', quantity_stored: 45, min_quantity: 100, shop_link: 'https://tme.eu', location_id: 3, responsible_person: 'Katarzyna Zielińska' },
  ];

  const mockShoppingList: DatabaseShoppingListItem[] = [
    { id: 301, name: 'Szlifierka kątowa Bosch GWS 9-125', type: 'item', quantity: 1, shop_link: 'https://allegro.pl', price_estimate: 350, suggested_by: 'Jan Kowalski', status: 'pending' },
    { id: 302, name: 'Cyna do lutowania 1mm Sn99Cu1 250g', type: 'consumable', quantity: 5, shop_link: 'https://tme.eu', price_estimate: 85, suggested_by: 'Adam Nowak', status: 'ordered' },
    { id: 303, name: 'Zasilacz laboratoryjny Wanptek 30V 10A', type: 'item', quantity: 2, shop_link: null, price_estimate: 580, suggested_by: 'Marta Wiśniewska', status: 'received' },
  ];

  const mockLocations: DatabaseLocation[] = [
    { id: 1, name: 'Szafa A - Narzędzia i Elektronika', type: 'permanent', event_id: null, room: 'Warsztat 101', responsible_person: 'Jan Kowalski' },
    { id: 2, name: 'Szafa B - Pneumatyka i Mechanika', type: 'permanent', event_id: null, room: 'Warsztat 101', responsible_person: 'Adam Nowak' },
    { id: 3, name: 'Regał C - Chemia i Drobiazgi', type: 'permanent', event_id: null, room: 'Korytarz', responsible_person: 'Katarzyna Zielińska' },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch low stock items from consumables table
      const resCons = await supabase.from('consumables').select('*');
      const resShopping = await supabase.from('shopping_list').select('*').order('id', { ascending: false });
      const resLocs = await supabase.from('locations').select('*').eq('type', 'permanent');

      if (resCons.error || resShopping.error || resLocs.error) {
        throw new Error('Supabase request failed');
      }

      if (resCons.data) {
        setAllConsumables(resCons.data);
        const filtered = resCons.data.filter(
          (c) => Number(c.quantity_stored) < Number(c.min_quantity)
        );
        setLowStockItems(filtered);
      }
      if (resShopping.data) {
        setShoppingList(resShopping.data);
      }
      if (resLocs.data) {
        setLocations(resLocs.data);
      }
      setIsDemoMode(false);
    } catch (err) {
      console.warn('Supabase error on loading shopping data, fallback to mock:', err);
      setIsDemoMode(true);
      setLowStockItems(mockConsumables.filter(c => c.quantity_stored < c.min_quantity));
      setShoppingList(mockShoppingList);
      setLocations(mockLocations);
      setAllConsumables(mockConsumables);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- RESTOCK ALERTS HANDLERS ---
  const openRestockModal = (item: DatabaseConsumable) => {
    setSelectedRestockItem(item);
    const missing = Number(item.min_quantity) - Number(item.quantity_stored);
    setRestockQtyToAdd(missing > 0 ? missing.toString() : '1');
    setIsRestockModalOpen(true);
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestockItem) return;

    const qty = parseInt(restockQtyToAdd);
    if (isNaN(qty) || qty <= 0) {
      alert('Ilość dostarczona musi być liczbą większą niż 0.');
      return;
    }

    setRestockSubmitting(true);
    const newQuantity = Number(selectedRestockItem.quantity_stored) + qty;

    if (isDemoMode) {
      // Mock update
      setAllConsumables(prev =>
        prev.map(c => c.id === selectedRestockItem.id ? { ...c, quantity_stored: newQuantity } : c)
      );
      setLowStockItems(prev =>
        prev.map(c => c.id === selectedRestockItem.id ? { ...c, quantity_stored: newQuantity } : c)
            .filter(c => Number(c.quantity_stored) < Number(c.min_quantity))
      );
      setRestockSubmitting(false);
      setIsRestockModalOpen(false);
      // Notify components
      setTimeout(() => window.dispatchEvent(new Event('stock-updated')), 50);
      return;
    }

    try {
      const { error } = await supabase
        .from('consumables')
        .update({ quantity_stored: newQuantity })
        .eq('id', selectedRestockItem.id);

      if (error) throw error;
      
      setIsRestockModalOpen(false);
      window.dispatchEvent(new Event('stock-updated'));
      await fetchData();
    } catch (err: any) {
      alert('Błąd podczas aktualizacji stanu: ' + err.message);
    } finally {
      setRestockSubmitting(false);
    }
  };

  // --- CRUD HANDLERS FOR SHOPPING LIST ---
  const openNewRequestModal = () => {
    setNewReqName('');
    setNewReqType('consumable');
    setNewReqQty('1');
    setNewReqShopLink('');
    setNewReqPrice('');
    setNewReqSuggestedBy('');
    setIsNewRequestModalOpen(true);
  };

  const handleNewRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqName.trim()) {
      alert('Nazwa wniosku jest wymagana.');
      return;
    }

    const qty = parseInt(newReqQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Ilość musi być liczbą większą niż 0.');
      return;
    }

    const price = newReqPrice ? parseInt(newReqPrice) : null;
    if (newReqPrice && (isNaN(price as number) || (price as number) < 0)) {
      alert('Szacowany koszt musi być liczbą nieujemną.');
      return;
    }

    setNewReqSubmitting(true);

    const payload = {
      name: newReqName.trim(),
      type: newReqType,
      quantity: qty,
      shop_link: newReqShopLink.trim() || null,
      price_estimate: price,
      suggested_by: newReqSuggestedBy.trim() || null,
      status: 'pending' as const
    };

    if (isDemoMode) {
      const newItem: DatabaseShoppingListItem = {
        id: Date.now(),
        ...payload
      };
      setShoppingList(prev => [newItem, ...prev]);
      setNewReqSubmitting(false);
      setIsNewRequestModalOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('shopping_list')
        .insert(payload);

      if (error) throw error;
      setIsNewRequestModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert('Błąd zapisu wniosku zakupowego: ' + err.message);
    } finally {
      setNewReqSubmitting(false);
    }
  };

  const handleUpdateStatus = async (item: DatabaseShoppingListItem, nextStatus: 'pending' | 'ordered' | 'received') => {
    setActionLoading(item.id);
    if (isDemoMode) {
      setShoppingList(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i)
      );
      setActionLoading(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ status: nextStatus })
        .eq('id', item.id);

      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert('Błąd aktualizacji statusu: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRequest = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć tę pozycję z listy zakupowej?')) return;
    
    setActionLoading(id);
    if (isDemoMode) {
      setShoppingList(prev => prev.filter(i => i.id !== id));
      setActionLoading(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert('Błąd usuwania wniosku: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // --- RECEIVE INTO WAREHOUSE HANDLERS ---
  const openReceiveModal = (item: DatabaseShoppingListItem) => {
    setSelectedReceiveItem(item);
    setReceiveItemName(item.name);
    setReceiveItemLink(item.shop_link || '');
    setReceiveMode('existing');
    setReceiveExistingConsId('');
    
    // Default location configuration
    const defaultLoc = locations.length > 0 ? locations[0] : null;
    setReceiveLocationId(defaultLoc ? defaultLoc.id.toString() : '');
    setReceiveResponsiblePerson(defaultLoc && defaultLoc.responsible_person ? defaultLoc.responsible_person : '');
    
    setReceiveMinQty((item.quantity * 2).toString());
    setIsReceiveModalOpen(true);
  };

  const handleLocationChange = (locIdStr: string) => {
    setReceiveLocationId(locIdStr);
    const loc = locations.find(l => l.id.toString() === locIdStr);
    if (loc && loc.responsible_person) {
      setReceiveResponsiblePerson(loc.responsible_person);
    } else {
      setReceiveResponsiblePerson('');
    }
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiveItem) return;

    if (!receiveItemName.trim()) {
      alert('Nazwa przedmiotu jest wymagana.');
      return;
    }

    setReceiveSubmitting(true);

    try {
      if (selectedReceiveItem.type === 'item') {
        // DURA BLE ITEM RECEIPT
        const locId = parseInt(receiveLocationId);
        if (isNaN(locId)) {
          alert('Wybierz szafę/lokalizację docelową.');
          setReceiveSubmitting(false);
          return;
        }

        if (isDemoMode) {
          // Add to mock durables conceptually or just output success
          setShoppingList(prev => prev.filter(i => i.id !== selectedReceiveItem.id));
        } else {
          // Loop to insert the number of copies ordered
          const inserts = Array.from({ length: selectedReceiveItem.quantity }).map(() => ({
            name: receiveItemName.trim(),
            location_id: locId,
            responsible_person: receiveResponsiblePerson.trim(),
            shop_link: receiveItemLink.trim(),
            status: 'in_workshop' as const
          }));

          const { error: insertErr } = await supabase
            .from('items')
            .insert(inserts);

          if (insertErr) throw insertErr;

          const { error: deleteErr } = await supabase
            .from('shopping_list')
            .delete()
            .eq('id', selectedReceiveItem.id);

          if (deleteErr) throw deleteErr;
        }
      } else {
        // CONSUMABLE RECEIPT
        if (receiveMode === 'existing') {
          const consId = parseInt(receiveExistingConsId);
          if (isNaN(consId)) {
            alert('Wybierz materiał zużywalny do aktualizacji stanu.');
            setReceiveSubmitting(false);
            return;
          }

          const targetCons = allConsumables.find(c => c.id === consId);
          if (!targetCons) throw new Error('Nie znaleziono wybranego materiału.');

          const updatedQty = Number(targetCons.quantity_stored) + Number(selectedReceiveItem.quantity);

          if (isDemoMode) {
            setAllConsumables(prev =>
              prev.map(c => c.id === consId ? { ...c, quantity_stored: updatedQty } : c)
            );
            setShoppingList(prev => prev.filter(i => i.id !== selectedReceiveItem.id));
          } else {
            const { error: updateErr } = await supabase
              .from('consumables')
              .update({ quantity_stored: updatedQty })
              .eq('id', consId);

            if (updateErr) throw updateErr;

            const { error: deleteErr } = await supabase
              .from('shopping_list')
              .delete()
              .eq('id', selectedReceiveItem.id);

            if (deleteErr) throw deleteErr;
          }
        } else {
          // CREATE NEW CONSUMABLE
          const locId = parseInt(receiveLocationId);
          if (isNaN(locId)) {
            alert('Wybierz szafę/lokalizację docelową.');
            setReceiveSubmitting(false);
            return;
          }

          const minQty = parseInt(receiveMinQty);
          if (isNaN(minQty) || minQty < 0) {
            alert('Wpisz poprawny zalecany stan minimalny.');
            setReceiveSubmitting(false);
            return;
          }

          if (isDemoMode) {
            const newMockCons: DatabaseConsumable = {
              id: Date.now(),
              name: receiveItemName.trim(),
              quantity_stored: selectedReceiveItem.quantity,
              min_quantity: minQty,
              shop_link: receiveItemLink.trim(),
              location_id: locId,
              responsible_person: receiveResponsiblePerson.trim() || null
            };
            setAllConsumables(prev => [...prev, newMockCons]);
            setShoppingList(prev => prev.filter(i => i.id !== selectedReceiveItem.id));
          } else {
            const { error: insertErr } = await supabase
              .from('consumables')
              .insert({
                name: receiveItemName.trim(),
                quantity_stored: selectedReceiveItem.quantity,
                min_quantity: minQty,
                shop_link: receiveItemLink.trim(),
                location_id: locId,
                responsible_person: receiveResponsiblePerson.trim() || null
              });

            if (insertErr) throw insertErr;

            const { error: deleteErr } = await supabase
              .from('shopping_list')
              .delete()
              .eq('id', selectedReceiveItem.id);

            if (deleteErr) throw deleteErr;
          }
        }
      }

      setIsReceiveModalOpen(false);
      window.dispatchEvent(new Event('stock-updated'));
      await fetchData();
    } catch (err: any) {
      alert('Błąd podczas przyjmowania do magazynu: ' + err.message);
    } finally {
      setReceiveSubmitting(false);
    }
  };

  // --- FILTERS LOGIC ---
  const filteredShoppingList = shoppingList.filter(item => {
    const statusMatches = statusFilter === 'all' || item.status === statusFilter;
    const searchMatches = searchQuery.trim() === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.suggested_by && item.suggested_by.toLowerCase().includes(searchQuery.toLowerCase()));
    return statusMatches && searchMatches;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white font-sans">Zaopatrzenie & Zakupy</h1>
            {lowStockItems.length > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500/10 px-2 text-xs font-bold text-rose-400 border border-rose-500/30">
                {lowStockItems.length} alert{lowStockItems.length === 1 ? 'y' : 'ów'}
              </span>
            )}
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Zarządzaj brakami w magazynie oraz wnioskami o zakupy sprzętu trwałego i zużywalnego.
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-850 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
          <button
            onClick={openNewRequestModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors font-semibold"
          >
            <Plus className="h-4.5 w-4.5 text-black stroke-[3]" />
            Nowy wniosek
          </button>
        </div>
      </div>

      {isDemoMode && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-amber-400 text-xs">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
          <span>Baza danych niedostępna. Uruchomiono tryb demo z mockami. Zmiany nie są trwałe.</span>
        </div>
      )}

      {/* SECTION 1: LOW STOCK ALERTS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-850">
          <div className="p-1 rounded bg-rose-500/10 text-rose-400">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-bold text-zinc-200">Alerty niskiego stanu (zapotrzebowanie)</h2>
        </div>

        {loading ? (
          <div className="bg-zinc-900/10 border border-zinc-850 rounded-xl p-6 space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="flex gap-4 items-center justify-between py-2 border-b border-zinc-850/30 animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-zinc-850 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-zinc-800 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="bg-blue-950/10 border border-blue-500/10 rounded-xl p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Stan magazynowy w normie!</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Żaden z materiałów zużywalnych nie spadł poniżej zdefiniowanego stanu minimalnego.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-6 w-20">ID</th>
                    <th className="py-3 px-6">Nazwa materiału</th>
                    <th className="py-3 px-6 text-center">Aktualny stan</th>
                    <th className="py-3 px-6 text-center">Stan minimalny</th>
                    <th className="py-3 px-6 text-center">Brakująca ilość</th>
                    <th className="py-3 px-6 text-center">Sklep</th>
                    <th className="py-3 px-6 text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 text-sm text-zinc-300">
                  {lowStockItems.map((item) => {
                    const missingQty = Number(item.min_quantity) - Number(item.quantity_stored);
                    return (
                      <tr key={`alert-${item.id}`} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="py-3 px-6 font-mono text-xs text-zinc-500">#C{item.id}</td>
                        <td className="py-3 px-6 font-semibold text-zinc-100">{item.name}</td>
                        <td className="py-3 px-6 text-center font-mono text-rose-400 font-bold bg-rose-500/[0.02]">
                          {item.quantity_stored}
                        </td>
                        <td className="py-3 px-6 text-center font-mono text-zinc-500">{item.min_quantity}</td>
                        <td className="py-3 px-6 text-center font-mono font-bold text-amber-500">
                          -{missingQty}
                        </td>
                        <td className="py-3 px-6 text-center">
                          {item.shop_link ? (
                            <a
                              href={item.shop_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all"
                            >
                              Kup <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            onClick={() => openRestockModal(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30 transition-all font-semibold"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Uzupełnij stan
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: UNIVERSAL SHOPPING LIST */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-850">
          <div className="p-1 rounded bg-blue-500/10 text-blue-400">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <h2 className="text-lg font-bold text-zinc-200">Uniwersalna lista zakupowa</h2>
        </div>

        {/* Filters and search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === 'all'
                  ? 'bg-zinc-100 text-black border-zinc-100'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              Wszystkie ({shoppingList.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === 'pending'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              Oczekuje ({shoppingList.filter(i => i.status === 'pending').length})
            </button>
            <button
              onClick={() => setStatusFilter('ordered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === 'ordered'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              Zamówione ({shoppingList.filter(i => i.status === 'ordered').length})
            </button>
            <button
              onClick={() => setStatusFilter('received')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === 'received'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              Odebrane ({shoppingList.filter(i => i.status === 'received').length})
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Szukaj po nazwie / zgłaszającym..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-zinc-850 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="bg-zinc-900/10 border border-zinc-850 rounded-xl p-6 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex gap-4 items-center justify-between py-2 border-b border-zinc-850/30 animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-zinc-850 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-zinc-800 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredShoppingList.length === 0 ? (
          <div className="bg-zinc-900/10 border border-zinc-850 rounded-xl p-12 text-center text-zinc-500">
            <Inbox className="h-8 w-8 mx-auto text-zinc-600 mb-3" />
            <p className="font-semibold text-zinc-400">Brak wniosków zakupowych</p>
            <p className="text-zinc-650 text-xs mt-1">
              Brak zapytań o zakupy o tym statusie lub pasujących do filtra wyszukiwania.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-6 w-20">ID</th>
                    <th className="py-3.5 px-6">Nazwa pozycji</th>
                    <th className="py-3.5 px-6">Typ</th>
                    <th className="py-3.5 px-6 text-center">Ilość</th>
                    <th className="py-3.5 px-6 text-center">Szac. Koszt</th>
                    <th className="py-3.5 px-6">Zgłaszający</th>
                    <th className="py-3.5 px-6 text-center">Status</th>
                    <th className="py-3.5 px-6 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850 text-sm text-zinc-300">
                  {filteredShoppingList.map((item) => {
                    return (
                      <tr key={`shop-${item.id}`} className="hover:bg-zinc-900/20 transition-colors group">
                        <td className="py-4 px-6 font-mono text-xs text-zinc-500">#{item.id}</td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-zinc-100">{item.name}</span>
                            {item.shop_link && (
                              <a
                                href={item.shop_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium self-start"
                              >
                                Link do sklepu <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          {item.type === 'item' ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              Sprzęt trwały
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              Zużywalne
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center font-mono font-medium text-white">{item.quantity} szt.</td>
                        <td className="py-4 px-6 text-center font-mono text-zinc-400">
                          {item.price_estimate ? `${item.price_estimate} zł` : '—'}
                        </td>
                        <td className="py-4 px-6 text-zinc-400">{item.suggested_by || 'Brak'}</td>
                        <td className="py-4 px-6 text-center">
                          {item.status === 'pending' && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Oczekuje
                            </span>
                          )}
                          {item.status === 'ordered' && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Zamówione
                            </span>
                          )}
                          {item.status === 'received' && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Odebrane
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {actionLoading === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-zinc-500 mx-2" />
                            ) : (
                              <>
                                {/* Status cycle controls */}
                                {item.status === 'pending' && (
                                  <button
                                    onClick={() => handleUpdateStatus(item, 'ordered')}
                                    className="px-2.5 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-blue-950 hover:text-blue-300 hover:border-blue-800 transition-all font-medium"
                                    title="Zmień status na: Zamówione"
                                  >
                                    Zamówiono
                                  </button>
                                )}
                                {item.status === 'ordered' && (
                                  <button
                                    onClick={() => handleUpdateStatus(item, 'received')}
                                    className="px-2.5 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-950 hover:text-blue-300 hover:border-blue-800 transition-all font-medium"
                                    title="Zmień status na: Odebrane"
                                  >
                                    Odebrano
                                  </button>
                                )}
                                {item.status === 'received' && (
                                  <button
                                    onClick={() => openReceiveModal(item)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-blue-500 text-black hover:bg-blue-400 transition-all font-bold"
                                    title="Przyjmij do magazynu"
                                  >
                                    <PackageCheck className="h-3.5 w-3.5" />
                                    Przyjmij
                                  </button>
                                )}

                                {/* Cancel/Delete request */}
                                <button
                                  onClick={() => handleDeleteRequest(item.id)}
                                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors md:opacity-0 md:group-hover:opacity-100"
                                  title="Usuń wniosek"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: RESTOCK CONUSMABLE ALERT */}
      {isRestockModalOpen && selectedRestockItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2">Dostawa materiału</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Uzupełniasz stan magazynowy dla: <span className="font-semibold text-zinc-200">{selectedRestockItem.name}</span>.
            </p>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  Dostarczona ilość (szt.)
                </label>
                <input
                  type="number"
                  required
                  value={restockQtyToAdd}
                  onChange={(e) => setRestockQtyToAdd(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-mono"
                  placeholder="np. 50"
                  min="1"
                />
                <span className="block text-[11px] text-zinc-555">
                  Domyślnie sugerujemy brakującą ilość do stanu minimalnego (obecnie: {selectedRestockItem.quantity_stored} / {selectedRestockItem.min_quantity}).
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-blue-500 hover:bg-blue-400 rounded-lg active:scale-95 transition-all duration-150 disabled:opacity-50"
                >
                  {restockSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Zapisz dostawę
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW PURCHASE REQUEST */}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-1">Nowy wniosek zakupowy</h3>
            <p className="text-zinc-400 text-xs mb-5">Dodaj pozycję do uniwersalnej listy zakupowej koła naukowego.</p>

            <form onSubmit={handleNewRequestSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nazwa pozycji</label>
                  <input
                    type="text"
                    required
                    value={newReqName}
                    onChange={(e) => setNewReqName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    placeholder="np. Cyna z kalofonią, Wiertarka akumulatorowa Makita"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Typ zasobu</label>
                  <select
                    value={newReqType}
                    onChange={(e) => setNewReqType(e.target.value as 'item' | 'consumable')}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                  >
                    <option value="consumable">Zużywalne (śruby, taśmy, frezy)</option>
                    <option value="item">Sprzęt trwały (narzędzia, mierniki)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ilość sztuk</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newReqQty}
                    onChange={(e) => setNewReqQty(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Szacowany koszt (zł)</label>
                  <input
                    type="number"
                    min="0"
                    value={newReqPrice}
                    onChange={(e) => setNewReqPrice(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                    placeholder="np. 350 (opcjonalne)"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Osoba zgłaszająca</label>
                  <input
                    type="text"
                    value={newReqSuggestedBy}
                    onChange={(e) => setNewReqSuggestedBy(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    placeholder="np. Jan Kowalski (opcjonalne)"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Link do sklepu</label>
                  <input
                    type="url"
                    value={newReqShopLink}
                    onChange={(e) => setNewReqShopLink(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                    placeholder="https://allegro.pl/... (opcjonalne)"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsNewRequestModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={newReqSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-blue-500 hover:bg-blue-400 rounded-lg active:scale-95 transition-all duration-150 disabled:opacity-50"
                >
                  {newReqSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Dodaj wniosek
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECEIVE PURCHASED RESOURCE INTO WAREHOUSE */}
      {isReceiveModalOpen && selectedReceiveItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5 mb-1.5">
              <PackageOpen className="h-5 w-5 text-blue-400" />
              <h3 className="text-xl font-bold text-white">Przyjęcie do magazynu</h3>
            </div>
            <p className="text-zinc-400 text-xs mb-5">
              Definiujesz położenie zakupionej pozycji: <span className="font-semibold text-zinc-200">{selectedReceiveItem.name}</span> ({selectedReceiveItem.quantity} szt.)
            </p>

            <form onSubmit={handleReceiveSubmit} className="space-y-4">
              
              {/* Type = durable Item Form */}
              {selectedReceiveItem.type === 'item' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nazwa w bazie</label>
                    <input
                      type="text"
                      required
                      value={receiveItemName}
                      onChange={(e) => setReceiveItemName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <SearchableSelect
                      label="Szafa / Lokalizacja docelowa"
                      placeholder="Wyszukaj szafę w warsztacie..."
                      options={locations}
                      value={receiveLocationId}
                      onChange={handleLocationChange}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Opiekun / Osoba odpowiedzialna</label>
                    <input
                      type="text"
                      value={receiveResponsiblePerson}
                      onChange={(e) => setReceiveResponsiblePerson(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                      placeholder="np. Jan Kowalski"
                    />
                    <span className="block text-[10px] text-zinc-550">
                      Wartość domyślnie pobierana jest z właściciela/opiekuna wybranej szafy.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Link do sklepu / instrukcji</label>
                    <input
                      type="url"
                      value={receiveItemLink}
                      onChange={(e) => setReceiveItemLink(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                    />
                  </div>

                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3.5 text-xs text-purple-400">
                    Oznaczenie tego sprzętu jako przyjęty spowoduje utworzenie <span className="font-bold font-mono">{selectedReceiveItem.quantity} osobnych kopii</span> w bazie sprzętu o statusie <span className="font-bold italic">w warsztacie</span>.
                  </div>
                </div>
              ) : (
                /* Type = consumable Form */
                <div className="space-y-4">
                  <div className="flex border border-zinc-850 p-1 rounded-xl bg-zinc-950 gap-1">
                    <button
                      type="button"
                      onClick={() => setReceiveMode('existing')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        receiveMode === 'existing'
                          ? 'bg-zinc-900 text-blue-400 border border-zinc-800/80 shadow-md'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Dolej / Dosyp do istniejącego
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiveMode('new')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        receiveMode === 'new'
                          ? 'bg-zinc-900 text-blue-400 border border-zinc-800/80 shadow-md'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Utwórz nowy materiał
                    </button>
                  </div>

                  {receiveMode === 'existing' ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <SearchableSelect
                          label="Wybierz istniejący materiał z bazy"
                          placeholder="Wyszukaj materiał w magazynie..."
                          options={allConsumables.map(c => ({
                            id: c.id,
                            name: `${c.name} (obecnie: ${c.quantity_stored} szt.)`,
                            responsible_person: c.responsible_person
                          }))}
                          value={receiveExistingConsId}
                          onChange={setReceiveExistingConsId}
                        />
                      </div>
                      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-blue-400">
                        Zwiększysz stan magazynowy wybranego materiału o <span className="font-bold font-mono">+{selectedReceiveItem.quantity} szt.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Nazwa materiału</label>
                        <input
                          type="text"
                          required
                          value={receiveItemName}
                          onChange={(e) => setReceiveItemName(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Stan początkowy</label>
                          <input
                            type="text"
                            disabled
                            value={`${selectedReceiveItem.quantity} szt.`}
                            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-850 text-zinc-500 text-sm font-mono focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Zalecane minimum (alert)</label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={receiveMinQty}
                            onChange={(e) => setReceiveMinQty(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <SearchableSelect
                          label="Szafa / Lokalizacja docelowa"
                          placeholder="Wyszukaj szafę w warsztacie..."
                          options={locations}
                          value={receiveLocationId}
                          onChange={handleLocationChange}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Opiekun / Osoba odpowiedzialna</label>
                        <input
                          type="text"
                          value={receiveResponsiblePerson}
                          onChange={(e) => setReceiveResponsiblePerson(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm"
                          placeholder="np. Jan Kowalski"
                        />
                        <span className="block text-[10px] text-zinc-550">
                          Wartość domyślnie pobierana jest z właściciela/opiekuna wybranej szafy.
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">Link do sklepu</label>
                        <input
                          type="url"
                          value={receiveItemLink}
                          onChange={(e) => setReceiveItemLink(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-sm font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-all active:scale-95 duration-150"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={receiveSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-blue-500 hover:bg-blue-400 rounded-lg transition-all active:scale-95 duration-150 disabled:opacity-50"
                >
                  {receiveSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Przyjmij do magazynu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
