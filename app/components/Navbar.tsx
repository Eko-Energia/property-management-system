'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
import { LayoutDashboard, Boxes, ShoppingCart, Trophy } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  const fetchLowStockCount = async () => {
    try {
      const { data: rawData, error } = await supabase
        .from('consumables')
        .select('quantity_stored, min_quantity');

      if (error) {
        console.error('Error fetching low stock count:', error);
        return;
      }

      if (rawData) {
        const data = rawData as unknown as { quantity_stored: number; min_quantity: number }[];
        const count = data.filter(
          (c) => Number(c.quantity_stored) < Number(c.min_quantity)
        ).length;
        setLowStockCount(count);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLowStockCount();

    // Polling or Realtime subscription can be configured here.
    // For reliability across client updates, we'll expose a refresh mechanism
    // via custom events so other pages can notify Navbar to re-fetch when stock changes.
    const handleStockUpdate = () => {
      fetchLowStockCount();
    };

    window.addEventListener('stock-updated', handleStockUpdate);
    return () => {
      window.removeEventListener('stock-updated', handleStockUpdate);
    };
  }, []);

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Magazyn', href: '/magazyn', icon: Boxes },
    {
      name: 'Lista Zakupów',
      href: '/magazyn/zakupy',
      icon: ShoppingCart,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { name: 'Zawody', href: '/zawody', icon: Trophy },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Title */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-sm text-black transition-all group-hover:scale-105 group-hover:bg-blue-400">
                EE
              </span>
              <span className="font-semibold text-lg tracking-wider text-zinc-100 group-hover:text-blue-400 transition-colors">
                Eko<span className="text-blue-500 font-light">Energia</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-zinc-800/60 text-blue-400 border border-blue-500/20'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-zinc-400'}`} />
                    <span>{item.name}</span>
                    {item.badge !== undefined && (
                      <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500/10 px-1.5 text-xs font-bold text-rose-400 border border-rose-500/30 animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile view indicator */}
          <div className="flex md:hidden items-center space-x-2">
            {navItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`p-2 rounded-lg relative ${
                    isActive ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={item.name}
                >
                  <Icon className="h-5 w-5" />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
