import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white p-4">
      <div className="w-16 h-16 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <div className="text-2xl">404</div>
      </div>
      <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        The configuration page or resource you are looking for does not exist.
      </p>
      <Link 
        href="/"
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20"
      >
        Return to Deck Configurator
      </Link>
    </div>
  );
}
