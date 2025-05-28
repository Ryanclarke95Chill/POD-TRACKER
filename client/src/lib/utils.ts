import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Convert UTC date to AEST (Australian Eastern Standard Time)
export function formatToAEST(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Convert to AEST (UTC+10) or AEDT (UTC+11 during daylight saving)
    const formatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const formattedParts = parts.reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);
    
    return `${formattedParts.day}/${formattedParts.month}/${formattedParts.year} ${formattedParts.hour}:${formattedParts.minute} AEST`;
  } catch (error) {
    return dateString; // fallback to original if parsing fails
  }
}
