'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';
import { 
  Boxes, 
  Trophy, 
  ShoppingCart, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  ArrowRight,
  TrendingDown
} from 'lucide-react';

interface DashboardStats {
  totalItems: number;
  totalConsumables: number;
  lowStockCount: number;
  activeEventsCount: number;
  totalLocations: number;
}

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalConsumables: 0,
    lowStockCount: 0,
    activeEventsCount: 0,
    totalLocations: 0
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Fetch data using standard select('*') matching other pages
      const [
        itemsRes, 
        consumablesRes, 
        eventsRes, 
        locationsRes
      ] = await Promise.all([
        supabase.from('items').select('*'),
        supabase.from('consumables').select('*'),
        supabase.from('events').select('*').eq('is_active', true),
        supabase.from('locations').select('*')
      ]);

      const dbError = itemsRes.error || consumablesRes.error || eventsRes.error || locationsRes.error;

      if (dbError) {
        throw dbError;
      }

      const totalItems = itemsRes.data?.length || 0;
      const consumablesData = (consumablesRes.data || []) as unknown as { quantity_stored: number; min_quantity: number }[];
      const totalConsumables = consumablesData.length;
      const lowStockCount = consumablesData.filter(
        c => Number(c.quantity_stored) < Number(c.min_quantity)
      ).length;
      const activeEventsCount = eventsRes.data?.length || 0;
      const totalLocations = locationsRes.data?.length || 0;

      setStats({
        totalItems,
        totalConsumables,
        lowStockCount,
        activeEventsCount,
        totalLocations
      });
      setSupabaseConnected(true);
    } catch (err) {
      console.warn('Error fetching dashboard stats, using mock fallback:', err);
      setSupabaseConnected(false);
      setStats({
        totalItems: 42,
        totalConsumables: 15,
        lowStockCount: 3,
        activeEventsCount: 2,
        totalLocations: 6
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto Revalidate on Window Focus & Tab Switch
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    // Supabase Realtime Channel: Instant live dashboard updates
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consumables' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchStats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-10 py-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ease-out">
      {/* Welcome Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-zinc-900 via-slate-900 to-zinc-900 border border-zinc-800 p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25 mb-4">
            <CheckCircle2 className="h-3 w-3" /> System ERP Gotowy
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Centrum Dowodzenia <br />
            <span className="bg-gradient-to-r from-blue-400 to-teal-500 bg-clip-text text-transparent">
              EkoEnergia
            </span>
          </h1>
          <p className="text-zinc-400 text-lg mb-6 leading-relaxed">
            Zarządzaj zasobami warsztatu studenckiego, monitoruj stany materiałów zużywalnych i sprawnie organizuj pakowanie na najbliższe zawody.
          </p>
        </div>
      </div>

      {/* Supabase Connection Alert */}
      {!supabaseConnected && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 text-amber-400 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Uruchomiono w trybie demonstracyjnym</p>
            <p className="text-amber-500/80 mt-1">
              Nie skonfigurowano poprawnych zmiennych środowiskowych Supabase w pliku <code className="bg-amber-500/10 px-1 py-0.5 rounded text-amber-300">.env.local</code>. Dane w aplikacji są zsymulowane.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Sprzęt Trwały',
            value: stats.totalItems,
            icon: Package,
            color: 'text-blue-400',
            borderColor: 'border-blue-500/10'
          },
          {
            label: 'Materiały Zużywalne',
            value: stats.totalConsumables,
            icon: Boxes,
            color: 'text-indigo-400',
            borderColor: 'border-indigo-500/10'
          },
          {
            label: 'Brakujące Materiały',
            value: stats.lowStockCount,
            icon: TrendingDown,
            color: stats.lowStockCount > 0 ? 'text-rose-400' : 'text-blue-400',
            borderColor: stats.lowStockCount > 0 ? 'border-rose-500/25 bg-rose-500/5' : 'border-blue-500/10',
            href: '/magazyn/zakupy'
          },
          {
            label: 'Aktywne Wyjazdy',
            value: stats.activeEventsCount,
            icon: Trophy,
            color: 'text-amber-400',
            borderColor: 'border-amber-500/10',
            href: '/zawody'
          }
        ].map((stat, idx) => {
          const CardContent = (
            <div className={`p-6 rounded-xl border bg-zinc-900/40 backdrop-blur-sm hover:bg-zinc-900/60 hover:border-zinc-700 hover:shadow-lg hover:shadow-blue-500/[0.01] transition-all duration-300 ease-out ${stat.borderColor} h-full`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-zinc-500 text-sm font-medium">{stat.label}</span>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              {loading ? (
                <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse mt-2" />
              ) : (
                <div className="text-3xl font-bold tracking-tight text-white">{stat.value}</div>
              )}
            </div>
          );

          return stat.href ? (
            <Link key={idx} href={stat.href} className="block transition-all duration-200 ease-out hover:-translate-y-1 active:scale-[0.99]">
              {CardContent}
            </Link>
          ) : (
            <div key={idx} className="transition-all duration-200 ease-out hover:-translate-y-1">
              {CardContent}
            </div>
          );
        })}
      </div>

      {/* Main Modes Selector */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Mode: Magazyn */}
        <Link href="/magazyn" className="group relative block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 p-8 transition-all duration-300 ease-out hover:border-zinc-700 hover:bg-zinc-900/40 hover:-translate-y-1 active:scale-[0.995]">
          <div className="absolute top-0 right-0 h-40 w-40 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
            <Boxes className="h-6 w-6" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors flex items-center gap-2">
            Magazyn <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </h2>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            Baza inwentaryzacji sprzętu i materiałów warsztatowych. Umożliwia filtrowanie według szaf, edycję stanów magazynowych w czasie rzeczywistym oraz dostęp do linków zakupowych.
          </p>

          <div className="flex gap-4 mt-6 text-xs text-zinc-500 font-medium">
            <span className="flex items-center gap-1.5"><Package className="h-4 w-4 text-zinc-600" /> Sprzęt trwały</span>
            <span className="flex items-center gap-1.5"><ShoppingCart className="h-4 w-4 text-zinc-600" /> Szybkie uzupełnianie</span>
          </div>
        </Link>

        {/* Mode: Zawody */}
        <Link href="/zawody" className="group relative block overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 p-8 transition-all duration-300 ease-out hover:border-zinc-700 hover:bg-zinc-900/40 hover:-translate-y-1 active:scale-[0.995]">
          <div className="absolute top-0 right-0 h-40 w-40 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-6 group-hover:scale-110 transition-transform duration-300">
            <Trophy className="h-6 w-6" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors flex items-center gap-2">
            Pakowanie / wyjazdy <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </h2>
          
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            Ekran pakowania na wyjazdy i zawody („ekran paniki”). Sprawdzaj co zostało spakowane do skrzyń wyjazdowych, weryfikuj braki sprzętowe i kontroluj paski postępu zużywalnych.
          </p>

          <div className="flex gap-4 mt-6 text-xs text-zinc-500 font-medium">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-zinc-600" /> Lista paniki</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-zinc-600" /> Skaner QR (Kody skrzyni)</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
