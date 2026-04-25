import { createFileRoute } from '@tanstack/react-router';
import { MDXRenderer } from '@/components/mdxRenderer';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/mdxPublic')({
  component: MDXPublic,
});

function MDXPublic() {
  const [mdxContent, setMdxContent] = useState('');

  // Load content from localStorage on initial render and set up a listener
  useEffect(() => {
    // Initial load
    const savedContent = localStorage.getItem('mdx-content');
    if (savedContent) {
      setMdxContent(savedContent);
    }

    // Setup storage event listener to update content when changed in another tab/window
    const handleStorageChange = (event: any) => {
      if (event.key === 'mdx-content') {
        setMdxContent(event.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="w-full mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 md:mb-6 text-center">MDX Public View</h1>

        {mdxContent ? (
          <div className="w-full p-3 sm:p-4 md:p-6">
            <div className="w-full max-w-none">
              <MDXRenderer content={mdxContent} />
            </div>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8 md:py-10 px-3 sm:px-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm">
            <h2 className="text-lg sm:text-xl md:text-2xl font-medium">No content available</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">Edit content in the MDX editor first</p>
            <div className="mt-4 sm:mt-6">
              <a
                href="/mdx"
                className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to MDX Editor
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}