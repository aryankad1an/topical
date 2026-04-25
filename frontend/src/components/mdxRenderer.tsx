import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MDXRendererProps {
    content: string;
}

export function MDXRenderer({ content }: MDXRendererProps) {
    const [error, setError] = useState<string | null>(null);

    // Simple error boundary
    if (error) {
        return (
            <div className="text-red-500 p-3 sm:p-4 border border-red-300 rounded bg-red-50 text-sm sm:text-base">
                <h3 className="font-bold text-base sm:text-lg">Error rendering MDX:</h3>
                <pre className="mt-2 whitespace-pre-wrap text-xs sm:text-sm overflow-auto">{error}</pre>
            </div>
        );
    }

    try {
        return (
            <div className="prose prose-sm sm:prose-base md:prose-lg dark:prose-invert w-full max-w-full" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                <div style={{ maxWidth: '100%', wordBreak: 'break-word' }}>
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeHighlight, rehypeKatex]}
                        components={{
                            // Make headings responsive
                            h1: ({ node, ...props }) => (
                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-6 mb-4" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mt-5 mb-3" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                                <h3 className="text-lg sm:text-xl md:text-2xl font-medium mt-4 mb-2" {...props} />
                            ),
                            // Make code blocks responsive and scrollable on small screens
                            pre: ({ node, ...props }) => (
                                <pre className="text-xs sm:text-sm md:text-base p-2 sm:p-4 rounded-md overflow-x-auto max-w-full" {...props} />
                            ),
                            code: ({ node, ...props }) => (
                                <code className="text-xs sm:text-sm font-mono" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }} {...props} />
                            ),
                            // Make images responsive
                            img: ({ node, ...props }) => (
                                <img className="max-w-full h-auto rounded-md my-4" {...props} />
                            ),
                            // Make tables responsive
                            table: ({ node, ...props }) => (
                                <div className="overflow-x-auto my-4">
                                    <table className="min-w-full text-xs sm:text-sm md:text-base border-collapse" {...props} />
                                </div>
                            ),
                            // Adjust paragraph spacing
                            p: ({ node, ...props }) => (
                                <p className="my-2 sm:my-3 md:my-4 text-sm sm:text-base" {...props} />
                            ),
                            // Adjust list spacing
                            ul: ({ node, ...props }) => (
                                <ul className="my-2 sm:my-3 md:my-4 pl-5 sm:pl-6 list-disc" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                                <ol className="my-2 sm:my-3 md:my-4 pl-5 sm:pl-6 list-decimal" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                                <li className="my-1 sm:my-2 text-sm sm:text-base" {...props} />
                            ),
                            // Adjust blockquote styling
                            blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 sm:pl-4 my-3 sm:my-4 italic text-sm sm:text-base" {...props} />
                            )
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </div>
        );
    } catch (err) {
        console.error('Error rendering markdown:', err);
        setError(err instanceof Error ? err.message : 'Unknown error rendering markdown');
        return null;
    }
}