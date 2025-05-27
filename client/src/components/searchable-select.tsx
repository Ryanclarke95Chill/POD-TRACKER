import { useState, useRef, useEffect } from 'react';

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const filteredOptions = options
    .filter(option => option.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  
  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm("");
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Selection display */}
      <div 
        className={`flex items-center justify-between w-full rounded-md border border-neutral-200 p-2 bg-white cursor-pointer ${className}`}
        onClick={handleToggle}
      >
        <div className="truncate">
          {value === "ignore" ? "Don't import" : 
           value === "" ? placeholder :
           value || placeholder}
        </div>
        <div className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </div>
      </div>
      
      {/* Dropdown panel */}
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Search input */}
          <div className="sticky top-0 bg-white border-b border-neutral-100 p-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-1 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
          </div>
          
          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {!searchTerm && (
              <div 
                className="p-2 hover:bg-neutral-100 cursor-pointer text-neutral-500"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {placeholder}
              </div>
            )}
            
            {filteredOptions.map((option, index) => (
              <div 
                key={index} 
                className={`p-2 hover:bg-neutral-100 cursor-pointer ${value === option ? "bg-blue-50 text-blue-700" : ""}`}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {option}
              </div>
            ))}
            
            {searchTerm && filteredOptions.length === 0 && (
              <div className="p-2 text-neutral-500 text-sm italic">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}