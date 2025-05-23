import { ConsignmentEvent } from "@shared/schema";

interface TimelineEventProps {
  event: ConsignmentEvent;
  isLast: boolean;
}

export default function TimelineEvent({ event, isLast }: TimelineEventProps) {
  // Function to get the icon based on event type
  const getEventIcon = (type: string) => {
    switch (type) {
      case "create":
        return (
          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case "pickup":
        return (
          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
          </svg>
        );
      case "transport":
        return (
          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        );
      case "scan":
        return (
          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case "delivery":
        return (
          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l4 4a1 1 0 010 1.414l-4 4A1 1 0 0112 12V9.414L9.707 11.707a1 1 0 11-1.414-1.414L11.586 7 8.293 3.707a1 1 0 011.414-1.414L12 4.586V2a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Parse the timestamp
  const [date, time] = event.timestamp.split(" ");

  return (
    <li>
      <div className={`relative ${!isLast ? "pb-8" : ""}`}>
        {!isLast && (
          <span
            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-neutral-200"
            aria-hidden="true"
          ></span>
        )}
        <div className="relative flex items-start">
          <div className="flex-shrink-0">
            <span className={`h-8 w-8 rounded-full bg-primary flex items-center justify-center ring-4 ring-white`}>
              {getEventIcon(event.type)}
            </span>
          </div>
          <div className="ml-4 flex-grow min-w-0 flex justify-between">
            <div className="pt-0.5">
              <p className="text-sm font-medium text-neutral-800">{event.description}</p>
              <p className="text-xs text-neutral-500">{event.location}</p>
            </div>
            <div className="text-right text-sm whitespace-nowrap text-neutral-500 ml-4">
              <p className="font-medium">May {date && date.split("-")[2]},</p>
              <p className="text-xs">{time}</p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
