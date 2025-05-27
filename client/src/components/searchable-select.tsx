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

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
    }
  }, [isOpen]);
  
  const filteredOptions = options
    .filter(option => option.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  
  return (
    <div className="relative">
      {/* Selection display */}
      <div 
        className={`flex items-center justify-between w-full rounded-md border border-neutral-200 p-2 bg-white cursor-pointer ${className}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="truncate">
          {value || placeholder}
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
              onMouseDown={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              className="w-full p-1 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Options list */}
          <div>
            <div 
              className="p-2 hover:bg-neutral-100 cursor-pointer"
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearchTerm("");
              }}
            >
              {placeholder}
            </div>
            
            {filteredOptions.map((option, index) => (
              <div 
                key={index} 
                className={`p-2 hover:bg-neutral-100 cursor-pointer ${value === option ? "bg-neutral-100" : ""}`}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {option}
              </div>
            ))}
            
            {filteredOptions.length === 0 && (
              <div className="p-2 text-neutral-500 text-sm italic">
                No matching options
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}