'use client';

import React, { useState, useEffect } from 'react';
import { supabase, DatabaseItem, DatabaseLocation, DatabaseCategory } from '@/utils/supabase/client';
import SearchableSelect from '@/app/components/SearchableSelect';
import ScannerButton from '@/app/components/ScannerButton';
import { X, Package, QrCode, Boxes, Tag, User, ExternalLink, Settings, Barcode } from 'lucide-react';

interface ItemWithLocation extends DatabaseItem {
  locations?: {
    type: 'permanent' | 'event_box';
    event_id: number | null;
  } | null;
}

interface ItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: ItemWithLocation | null;
  locations: DatabaseLocation[];
  categories: DatabaseCategory[];
  isDemoMode: boolean;
  onSave: () => void;
  itemsList: DatabaseItem[];
  onSaveDemo?: (item: DatabaseItem, isEdit: boolean) => void;
}

export default function ItemEditModal({
  isOpen,
  onClose,
  editingItem,
  locations,
  categories,
  isDemoMode,
  onSave,
  itemsList,
  onSaveDemo
}: ItemEditModalProps) {
  const [itemName, setItemName] = useState('');
  const [itemIdInput, setItemIdInput] = useState('');
  const [itemLocId, setItemLocId] = useState('');
  const [itemResponsible, setItemResponsible] = useState('');
  const [itemLink, setItemLink] = useState('');
  const [itemStatus, setItemStatus] = useState<'in_workshop' | 'assigned_to_event' | 'packed'>('in_workshop');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [showAllEventBoxes, setShowAllEventBoxes] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      if (isDemoMode) {
        setEvents([{ id: 10, name: 'Zawody Robotyczne 2026' }]);
        return;
      }
      try {
        const { data } = await supabase.from('events').select('id, name');
        if (data) setEvents(data);
      } catch (err) {
        console.error('Błąd pobierania wydarzeń w modalic:', err);
      }
    };
    fetchEvents();
  }, [isDemoMode]);

  useEffect(() => {
    if (isOpen) {
      if (editingItem) {
        setItemName(editingItem.name || '');
        setItemIdInput(editingItem.id || '');
        setItemLocId(editingItem.location_id ? editingItem.location_id.toString() : '');
        setItemResponsible(editingItem.responsible_person || '');
        setItemLink(editingItem.shop_link || '');
        setItemStatus(editingItem.status || 'in_workshop');
        setItemCategoryId(editingItem.category_id ? editingItem.category_id.toString() : '');
        setItemBarcode(editingItem.barcode || '');
      } else {
        setItemName('');
        setItemIdInput('');
        setItemLocId('');
        setItemResponsible('');
        setItemLink('');
        setItemStatus('in_workshop');
        setItemCategoryId('');
        setItemBarcode('');
      }
      setShowAllEventBoxes(false);
    }
  }, [isOpen, editingItem]);


  const suggestNextSku = async (type: 'I' | 'C', categoryId: number | null): Promise<string> => {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || !cat.code) return '';
    const code = cat.code.toUpperCase();
    const prefix = `${type}-${code}-`;

    if (isDemoMode) {
      let highestNum = 0;
      itemsList.forEach(item => {
        if (item.id && item.id.toUpperCase().startsWith(prefix)) {
          const parts = item.id.split('-');
          const lastPart = parts[parts.length - 1];
          const num = parseInt(lastPart, 10);
          if (!isNaN(num) && num > highestNum) {
            highestNum = num;
          }
        }
      });
      const nextNum = highestNum + 1;
      return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    } else {
      const table = type === 'I' ? 'items' : 'consumables';
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .like('id', `${prefix}%`)
        .order('id', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Błąd wyszukiwania SKU:', error);
        return `${prefix}0001`;
      }

      if (data && data.length > 0) {
        const lastId = data[0].id;
        const parts = lastId.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num)) {
          const nextNum = num + 1;
          return `${prefix}${nextNum.toString().padStart(4, '0')}`;
        }
      }
      return `${prefix}0001`;
    }
  };

  const handleItemCategoryChange = async (catIdStr: string) => {
    setItemCategoryId(catIdStr);
    if (!editingItem && catIdStr) {
      const catId = parseInt(catIdStr, 10);
      if (!isNaN(catId)) {
        const suggested = await suggestNextSku('I', catId);
        setItemIdInput(suggested);
      }
    }
  };

  const handleItemLocChange = (locId: string) => {
    setItemLocId(locId);
    const loc = locations.find(l => l.id.toString() === locId);
    if (!loc) return;

    if (loc.responsible_person && !editingItem) {
      setItemResponsible(loc.responsible_person);
    }

    if (loc.type === 'permanent') {
      setItemStatus('in_workshop');
    } else if (loc.type === 'event_box') {
      if (itemStatus === 'in_workshop') {
        setItemStatus('packed');
      }
    }
  };

  const handleItemStatusChange = (status: 'in_workshop' | 'assigned_to_event' | 'packed') => {
    setItemStatus(status);
    if (status === 'in_workshop') {
      const loc = locations.find(l => l.id.toString() === itemLocId);
      if (loc && loc.type === 'event_box') {
        const firstPerm = locations.filter(l => l.type === 'permanent')[0];
        setItemLocId(firstPerm ? firstPerm.id.toString() : '');
      }
    } else if (status === 'assigned_to_event' || status === 'packed') {
      const loc = locations.find(l => l.id.toString() === itemLocId);
      if (loc && loc.type === 'permanent') {
        const firstEventBox = locations.filter(l => l.type === 'event_box')[0];
        setItemLocId(firstEventBox ? firstEventBox.id.toString() : '');
      }
    }
  };

  const getFilteredLocations = () => {
    if (itemStatus === 'in_workshop') {
      return locations.filter(l => l.type === 'permanent');
    } else if (itemStatus === 'assigned_to_event' || itemStatus === 'packed') {
      if (showAllEventBoxes) {
        return locations.filter(l => l.type === 'event_box');
      }
      const currentLoc = locations.find(l => l.id.toString() === itemLocId);
      if (currentLoc && currentLoc.type === 'event_box' && currentLoc.event_id !== null) {
        return locations.filter(l => l.type === 'event_box' && l.event_id === currentLoc.event_id);
      } else {
        return locations.filter(l => l.type === 'event_box');
      }
    }
    return locations;
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemResponsible.trim() || !itemIdInput.trim()) return;

    setModalLoading(true);

    const skuRegex = /^(I|C)-[A-Z]{2,3}-\d{4}$/;
    if (!skuRegex.test(itemIdInput.trim())) {
      alert('Błędny format ID! Wymagany format: I-KOD-XXXX, np. I-EL-0001');
      setModalLoading(false);
      return;
    }

    const parsedLocId = parseInt(itemLocId) || null;
    const parsedCategoryId = parseInt(itemCategoryId) || null;

    const loc = locations.find(l => l.id.toString() === itemLocId);
    const itemLocationsMock = loc ? { type: loc.type, event_id: loc.event_id } : null;

    if (isDemoMode) {
      const mockItem: any = {
        id: itemIdInput.trim(),
        name: itemName.trim(),
        responsible_person: itemResponsible.trim(),
        shop_link: itemLink.trim(),
        location_id: parsedLocId as any,
        status: itemStatus,
        category_id: parsedCategoryId,
        barcode: itemBarcode.trim() || null,
        locations: itemLocationsMock
      };
      if (onSaveDemo) {
        onSaveDemo(mockItem, !!editingItem);
      }
      onClose();
      setModalLoading(false);
      onSave();
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
            status: itemStatus,
            category_id: parsedCategoryId,
            barcode: itemBarcode.trim() || null
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('items')
          .insert({
            id: itemIdInput.trim(),
            name: itemName.trim(),
            responsible_person: itemResponsible.trim(),
            shop_link: itemLink.trim(),
            location_id: parsedLocId,
            status: itemStatus,
            category_id: parsedCategoryId,
            barcode: itemBarcode.trim() || null
          });

        if (error) throw error;
      }

      onClose();
      onSave();
    } catch (err: any) {
      alert('Błąd zapisu przedmiotu: ' + err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredLocationsList = getFilteredLocations();
  const currentLoc = locations.find(l => l.id.toString() === itemLocId);
  const currentEvent = currentLoc && currentLoc.type === 'event_box' && currentLoc.event_id !== null
    ? events.find(e => e.id === currentLoc.event_id)
    : null;

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm transition-all animate-in fade-in duration-200"
    >
      <div className="w-[96%] max-w-xl md:w-full mx-auto my-auto bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-400" />
            {editingItem ? 'Edytuj Przedmiot Trwały' : 'Dodaj Przedmiot Trwały'}
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors active:scale-95 duration-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleItemSubmit} className="p-6 md:p-8 space-y-5 overflow-y-auto flex-1 max-h-[75vh]">
          
          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
              Nazwa przedmiotu / narzędzia
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                <Package className="w-5 h-5 block shrink-0" />
              </span>
              <input
                type="text"
                required
                placeholder="np. Wkrętarka DeWalt 18V"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm"
              />
            </div>
          </div>

          {/* Item ID / SKU */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5 flex justify-between items-center">
              <span>ID przedmiotu (kod QR / SKU)</span>
              <span className="text-[10px] text-zinc-500 font-normal lowercase font-sans">format: I-KOD-0000</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                <QrCode className="w-5 h-5 block shrink-0" />
              </span>
              <input
                type="text"
                required
                disabled={!!editingItem}
                placeholder="Wybierz kategorię, aby wygenerować ID lub wpisz ręcznie..."
                value={itemIdInput}
                onChange={(e) => setItemIdInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-105 placeholder-zinc-550 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm font-mono disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Item Barcode / Label */}
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
                  type="text"
                  placeholder="Zeskanuj lub wpisz kod z naklejki (np. 00045)..."
                  value={itemBarcode}
                  onChange={(e) => setItemBarcode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm font-mono"
                />
              </div>
              <ScannerButton
                buttonText=""
                icon={Barcode}
                className="!px-3.5 !py-2.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700 rounded-lg shrink-0 flex items-center justify-center"
                onScan={(scannedCode) => {
                  if (scannedCode) {
                    setItemBarcode(String(scannedCode).trim());
                  }
                }}
              />
            </div>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
              Status sprzętu
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                <Settings className="w-5 h-5 block shrink-0" />
              </span>
              <select
                value={itemStatus}
                onChange={(e) => handleItemStatusChange(e.target.value as any)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm appearance-none bg-none"
              >
                <option value="in_workshop" className="bg-zinc-950 text-zinc-250">W warsztacie</option>
                <option value="assigned_to_event" className="bg-zinc-950 text-zinc-250">Przypisany na wyjazd</option>
                <option value="packed" className="bg-zinc-950 text-zinc-250">Spakowany do skrzyni</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none border-l border-t border-zinc-500 h-2 w-2 transform rotate-135" />
            </div>
          </div>

          {/* Location Select */}
          <div>
            <SearchableSelect
              options={filteredLocationsList}
              value={itemLocId}
              onChange={handleItemLocChange}
              label="Pojemnik / Szafa / Skrzynia"
              placeholder="Wyszukaj szafę lub skrzynię..."
              searchLabel="Filtrowanie lokalizacji..."
              icon={Boxes}
            />
            
            {/* Event lock metadata and resets */}
            {(itemStatus === 'assigned_to_event' || itemStatus === 'packed') && (
              <div className="mt-1.5 p-2 rounded bg-zinc-950/40 border border-zinc-850/50 text-[11px] flex items-center justify-between">
                {currentEvent ? (
                  <>
                    <span className="text-zinc-400">
                      Zasób przypisany do wyjazdu: <strong className="text-blue-400 font-semibold">{currentEvent.name}</strong>
                    </span>
                    {!showAllEventBoxes && (
                      <button
                        type="button"
                        onClick={() => setShowAllEventBoxes(true)}
                        className="text-blue-500 hover:text-blue-400 hover:underline font-semibold focus:outline-none"
                      >
                        Pokaż inne wyjazdy
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-zinc-500">Brak aktywnego ograniczenia wyjazdu.</span>
                    {showAllEventBoxes && (
                      <button
                        type="button"
                        onClick={() => setShowAllEventBoxes(false)}
                        className="text-blue-500 hover:text-blue-400 hover:underline font-semibold focus:outline-none"
                      >
                        Filtruj wyjazd
                      </button>
                    )}
                  </>
                )}
                {showAllEventBoxes && currentEvent && (
                  <button
                    type="button"
                    onClick={() => setShowAllEventBoxes(false)}
                    className="text-blue-500 hover:text-blue-400 hover:underline font-semibold focus:outline-none"
                  >
                    Przywróć filtr
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category Select */}
          <div>
            <SearchableSelect
              options={categories}
              value={itemCategoryId}
              onChange={handleItemCategoryChange}
              label="Kategoria"
              placeholder="Wyszukaj lub wybierz kategorię..."
              searchLabel="Filtrowanie kategorii..."
              icon={Tag}
            />
          </div>

          {/* Responsible Person */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
              Opiekun / Osoba odpowiedzialna
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-500 pointer-events-none">
                <User className="w-5 h-5 block shrink-0" />
              </span>
              <input
                type="text"
                required
                placeholder="Imię i nazwisko"
                value={itemResponsible}
                onChange={(e) => setItemResponsible(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm"
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
                value={itemLink}
                onChange={(e) => setItemLink(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all duration-200 text-sm font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={modalLoading}
              className="px-5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-350 hover:bg-zinc-800 hover:text-white font-semibold text-xs active:scale-95 transition-all duration-150 uppercase tracking-wider disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={modalLoading}
              className="px-6 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-black font-extrabold text-xs active:scale-95 transition-all duration-150 uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-blue-500/5"
            >
              {modalLoading ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
