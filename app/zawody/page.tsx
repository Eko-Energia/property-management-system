'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, DatabaseEvent } from '@/utils/supabase/client';
import { 
  Trophy, 
  Calendar, 
  CheckCircle2, 
  Archive, 
  ArrowRight, 
  RefreshCw,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  X
} from 'lucide-react';

export default function ZawodyPage() {
  const [events, setEvents] = useState<DatabaseEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Form & Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<DatabaseEvent | null>(null); // null means creating
  const [eventName, setEventName] = useState<string>('');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventActive, setEventActive] = useState<boolean>(true);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // Fallback Mock Events
  const mockEvents: DatabaseEvent[] = [
    { id: 10, name: 'Formula Student East 2026 (Győr, Węgry)', start_date: '2026-07-20', is_active: true },
    { id: 11, name: 'Smart Moto Challenge 2026 (Barcelona, Hiszpania)', start_date: '2026-08-12', is_active: true },
    { id: 8, name: 'Formula Student Germany 2025 (Hockenheim)', start_date: '2025-08-10', is_active: false },
    { id: 9, name: 'Kraków Robot Show 2025', start_date: '2025-11-05', is_active: false },
  ];

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;

      if (data) {
        setEvents(data);
      }
      setIsDemoMode(false);
    } catch (err) {
      console.warn('Failed to fetch events from Supabase, entering demo mode:', err);
      setIsDemoMode(true);
      setEvents(mockEvents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Auto Revalidate on Window Focus & Tab Switch
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchEvents();
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    // Supabase Realtime Channel: Instant live updates when any user edits events
    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setEditingEvent(null);
    setEventName('');
    setEventDate(new Date().toISOString().split('T')[0]);
    setEventActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (event: DatabaseEvent, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to /zawody/[id] when clicking edit!
    setEditingEvent(event);
    setEventName(event.name);
    setEventDate(event.start_date);
    setEventActive(event.is_active);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !eventDate) return;

    setFormLoading(true);

    if (isDemoMode) {
      if (editingEvent) {
        // Edit mock event
        setEvents(prev =>
          prev.map(ev =>
            ev.id === editingEvent.id
              ? { ...ev, name: eventName.trim(), start_date: eventDate, is_active: eventActive }
              : ev
          )
        );
      } else {
        // Add mock event
        const newEvent: DatabaseEvent = {
          id: Date.now(),
          name: eventName.trim(),
          start_date: eventDate,
          is_active: eventActive
        };
        setEvents(prev => [newEvent, ...prev]);
      }
      setIsModalOpen(false);
      setFormLoading(false);
      return;
    }

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update({
            name: eventName.trim(),
            start_date: eventDate,
            is_active: eventActive
          })
          .eq('id', editingEvent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('events')
          .insert({
            name: eventName.trim(),
            start_date: eventDate,
            is_active: eventActive
          });

        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      alert('Błąd podczas zapisywania wyjazdu: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten wyjazd? Z bazy znikną przypisane do niego lokalizacje (skrzynie), a statusy powiązanych przedmiotów i wymagania materiałowe zostaną zresetowane.')) {
      return;
    }

    setFormLoading(true);

    if (isDemoMode) {
      setEvents(prev => prev.filter(ev => ev.id !== eventId));
      setIsModalOpen(false);
      setFormLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      setIsModalOpen(false);
      fetchEvents();
    } catch (err: any) {
      alert('Błąd podczas usuwania wyjazdu: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const activeEvents = events.filter(e => e.is_active);
  const archivedEvents = events.filter(e => !e.is_active);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Panel Zawodów</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Zarządzaj listami pakowania i sprawdź stan przygotowań do wyjazdów koła naukowego.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-black bg-blue-500 rounded-lg hover:bg-blue-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nowy Wyjazd
          </button>
          
          <button 
            onClick={fetchEvents} 
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </button>
        </div>
      </div>

      {isDemoMode && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-amber-400 text-xs">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
          <span>Wyszukiwanie w trybie demo. Wszystkie modyfikacje zapisują się w pamięci lokalnej.</span>
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rounded-2xl border border-zinc-850 bg-zinc-900/10 p-6 animate-pulse min-h-[190px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="h-10 w-10 bg-zinc-800 rounded-xl" />
                <div className="h-5 w-2/3 bg-zinc-800 rounded" />
                <div className="h-4 w-1/2 bg-zinc-850 rounded" />
              </div>
              <div className="h-4 w-1/3 bg-zinc-850 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {/* Active Events Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
              Aktywne Przygotowania
            </h2>
            
            {activeEvents.length === 0 ? (
              <div className="p-8 rounded-xl border border-zinc-850 bg-zinc-900/10 text-center text-zinc-500 text-sm">
                Brak aktualnych wyjazdów wymagających pakowania.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {activeEvents.map((event) => (
                  <Link 
                    key={event.id}
                    href={`/zawody/${event.id}`}
                    className="group relative rounded-2xl border border-blue-500/20 bg-zinc-900/30 p-6 hover:bg-zinc-900/60 hover:border-blue-500/40 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 ease-out flex flex-col justify-between min-h-[190px] text-left shadow-md"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <div>
                      <div className="flex justify-between items-start mb-3 relative z-10">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditModal(event, e);
                            }}
                            className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 hover:bg-zinc-700 active:scale-90 transition-transform duration-100"
                            title="Edytuj wyjazd"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-2.5 py-1 text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                            Pakowanie
                          </span>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                        {event.name}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-zinc-400 text-sm mb-4">
                        <Calendar className="h-4 w-4 text-zinc-550" />
                        <span>Wyjazd: <span className="font-semibold text-zinc-200">{event.start_date}</span></span>
                      </div>
                    </div>

                    <div 
                      className="flex items-center justify-between text-xs font-semibold text-blue-400 border-t border-zinc-800/80 pt-3 group-hover:underline"
                    >
                      <span>Otwórz Panel Pakowania (Lista Paniki)</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Archived Events Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Archive className="h-5 w-5 text-zinc-500" />
              Zakończone Wyjazdy / Archiwum
            </h2>

            {archivedEvents.length === 0 ? (
              <div className="p-8 rounded-xl border border-zinc-850 bg-zinc-900/10 text-center text-zinc-500 text-sm">
                Brak zarchiwizowanych wyjazdów w bazie danych.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {archivedEvents.map((event) => (
                  <Link 
                    key={event.id}
                    href={`/zawody/${event.id}`}
                    className="group flex items-center justify-between rounded-xl border border-zinc-850 bg-zinc-900/10 p-5 hover:bg-zinc-900/30 hover:border-zinc-800 hover:-translate-y-0.5 active:scale-[0.995] transition-all duration-200 ease-out text-left shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-850 text-zinc-550 group-hover:text-zinc-450 transition-colors">
                        <Archive className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-zinc-350 group-hover:text-white transition-colors">
                          {event.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-zinc-500 text-xs mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>Zakończono: {event.start_date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 relative z-10">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEditModal(event, e);
                        }}
                        className="p-1.5 rounded-md bg-zinc-800/40 text-zinc-500 hover:text-white border border-zinc-800 hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100"
                        title="Edytuj wyjazd"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <div>
                        <ArrowRight className="h-4 w-4 text-zinc-650 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Event */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-400" />
                {editingEvent ? 'Edytuj Wyjazd / Zawody' : 'Nowy Wyjazd / Zawody'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-450 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Event Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Nazwa wyjazdu / lokalizacja
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Smart Moto Challenge Barcelona 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                  Data wyjazdu / startu
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Is Active Status Checkbox */}
              <div className="flex items-center gap-3 p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <input
                  type="checkbox"
                  id="eventActive"
                  checked={eventActive}
                  onChange={(e) => setEventActive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-800 bg-zinc-950 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950"
                />
                <label htmlFor="eventActive" className="text-sm text-zinc-300 font-medium select-none cursor-pointer">
                  Przygotowania aktywne (pakowanie w toku)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-zinc-800/80 mt-4">
                {editingEvent ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEvent.id)}
                    disabled={formLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń wyjazd
                  </button>
                ) : (
                  <div />
                )}
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
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
    </div>
  );
}
