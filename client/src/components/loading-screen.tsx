import chillLogo from "@assets/Chill Logo CMYK Primary (1)_1760581487204.png";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="relative">
        <div className="absolute inset-0 blur-2xl opacity-30">
          <div className="w-32 h-32 bg-blue-400 rounded-full animate-pulse"></div>
        </div>
        
        <div className="relative animate-float">
          <img 
            src={chillLogo} 
            alt="Chill Transport" 
            className="h-24 w-auto drop-shadow-lg"
          />
        </div>
      </div>
      
      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        
        <p className="text-gray-600 font-medium font-montserrat">Loading POD Quality Dashboard...</p>
      </div>
    </div>
  );
}
