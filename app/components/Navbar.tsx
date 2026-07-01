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
            <Link href="/" className="flex items-center gap-2.5 group">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 67 60" className="h-9 w-auto transition-all duration-300 group-hover:scale-105 shrink-0" fill="none">
                <path d="M20.2155 55.3213C11.7914 45.2126 22.8259 33.0415 29.3275 27.9855C22.3392 51.1634 39.0959 58.9631 46.5388 56.3337C40.9387 59.6448 27.2995 63.0148 20.2155 55.3213Z" className="fill-blue-500 group-hover:fill-blue-400 transition-colors duration-300"></path>
                <path d="M32.3652 45.1969C40.5403 50.3574 46.6189 42.4103 48.5642 38.1099C50.5175 42.1597 53.2804 50.6353 45.5269 53.2964C39.2384 55.4547 34.0943 49.2064 32.3652 45.1969Z" className="fill-blue-500 group-hover:fill-blue-400 transition-colors duration-300"></path>
                <path d="M18.8142 5.74434C31.8583 4.06537 36.2068 19.9142 36.9881 28.1168C21.0104 9.977 5.57442 19.5441 3.84753 27.4211C4.05533 20.9165 8.52613 7.58969 18.8142 5.74434Z" className="fill-blue-500 group-hover:fill-blue-400 transition-colors duration-300"></path>
                <path d="M21.1663 21.6859C12.453 25.7678 15.0101 34.6784 17.6058 38.6224C13.1449 38.0831 4.54085 35.8367 6.42365 27.9025C7.9507 21.4675 16.4367 20.9862 21.1663 21.6859Z" className="fill-blue-500 group-hover:fill-blue-400 transition-colors duration-300"></path>
                <path d="M60.8613 28.2489C56.1164 40.506 40.1087 36.7824 32.5495 33.5591C56.6586 28.2727 54.4384 9.54077 48.9825 4.73523C54.5827 8.01799 64.1471 18.3332 60.8613 28.2489Z" className="fill-blue-500 group-hover:fill-blue-400 transition-colors duration-300"></path>
                <path d="M46.7867 23.0097C47.2778 13.4548 38.2461 11.4324 33.6224 11.7934C36.1551 8.16809 41.4715 2.10267 47.4844 7.56421C52.3612 11.9938 49.6718 18.9273 46.7867 23.0097Z" className="fill-blue-500 group-hover:fill-blue-400 transition-colors duration-300"></path>
              </svg>
              <span className="font-semibold text-lg tracking-wider text-zinc-100 group-hover:text-blue-400 transition-colors duration-300">
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
