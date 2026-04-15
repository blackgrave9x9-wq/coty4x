import { useState, useEffect } from 'react';

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      try {
        const errorData = JSON.parse(event.message);
        setErrorMessage(`Error: ${errorData.error || 'Unknown error'}`);
        setHasError(true);
      } catch (e) {
        // Not a JSON error, ignore or handle differently
      }
    };
    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-primary/10 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <p className="text-text/70 mb-6">{errorMessage}</p>
          <button onClick={() => window.location.reload()} className="bg-primary text-white px-6 py-2 rounded-lg">
            Reload App
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
