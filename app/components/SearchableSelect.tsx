'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';

interface SelectOption {
  id: string | number;
  name: string;
  room?: string | null;
  responsible_person?: string | null;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string; // selected ID as string
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  searchLabel?: string;
  icon?: React.ComponentType<any>;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Szukaj...',
  label,
  searchLabel = 'Filtrowanie...',
  icon: Icon
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  // Sync selected option when value or options change
  useEffect(() => {
    const selected = options.find((opt) => opt.id.toString() === value);
    setSelectedOption(selected || null);
    if (selected) {
      setSearchQuery(selected.name);
    } else {
      setSearchQuery('');
    }
  }, [value, options]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        !(dropdownRef.current && dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
        // Reset query text to show selected option name
        setSearchQuery(selectedOption ? selectedOption.name : '');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedOption]);

  const filteredOptions = options.filter((opt) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = opt.name.toLowerCase().includes(query);
    const roomMatch = opt.room ? opt.room.toLowerCase().includes(query) : false;
    return nameMatch || roomMatch;
  });

  const handleSelect = (option: SelectOption) => {
    setSelectedOption(option);
    setSearchQuery(option.name);
    onChange(option.id.toString());
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOption(null);
    setSearchQuery('');
    onChange('');
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5 w-full">
      {label && (
        <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Input Trigger */}
        <div 
          onClick={() => setIsOpen(true)}
          className="relative flex items-center w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all cursor-pointer"
        >
          {Icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-zinc-400 pointer-events-none">
              <Icon className="w-5 h-5 block shrink-0" />
            </div>
          )}
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            className={`w-full bg-transparent py-2.5 text-sm focus:outline-none placeholder-zinc-500 pr-10 text-zinc-100 ${
              Icon ? 'pl-10' : 'pl-4'
            }`}
          />

          {/* Icons control */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-zinc-500">
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="hover:text-zinc-300 p-0.5 rounded transition-colors"
                title="Wyczyść wybór"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
          </div>
        </div>

        {/* Dropdown Options List (Rendered via React Portal to prevent overflow cuts inside modals) */}
        {isOpen && isMounted && coords && createPortal(
          <div 
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`
            }}
            className="z-[9999] mt-1.5 rounded-xl border border-zinc-800 bg-zinc-950/98 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in duration-200"
          >
            {/* Search query header within dropdown */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-zinc-900 bg-zinc-950 text-zinc-500">
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{searchLabel}</span>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-zinc-900">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Brak wyników dopasowania.
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selectedOption?.id === option.id;
                  return (
                    <div
                      key={option.id}
                      onClick={() => handleSelect(option)}
                      className={`flex items-center justify-between px-4 py-3 text-sm cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-500/10 text-blue-400 font-semibold' 
                          : 'text-zinc-350 hover:bg-zinc-900/60 hover:text-white'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{option.name}</span>
                        {option.room && (
                          <span className="text-[10px] text-zinc-500 font-normal mt-0.5">
                            Pokój: <span className="text-zinc-400 font-medium">{option.room}</span>
                          </span>
                        )}
                        {option.responsible_person && (
                          <span className="text-[10px] text-zinc-500 font-normal">
                            Opiekun: <span className="text-zinc-400 font-medium">{option.responsible_person}</span>
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-400 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
