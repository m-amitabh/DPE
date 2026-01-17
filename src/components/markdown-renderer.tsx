import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Note: import mermaid dynamically in-browser (below) for better compatibility
export interface MarkdownRendererProps {
  content: string;
}
function CodeBlock({ inline, className, children }: any) {
  const code = String(children).trim();
  const ref = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  // If this is inline code, render as inline and avoid producing block elements
  if (inline) {
    return <code className={className}>{code}</code>;
  }

  useEffect(() => {
    if (!className || !className.includes('language-mermaid')) return;
    let mounted = true;
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;

    (async () => {
      try {
        const mod = await import('mermaid');
        const mermaid = (mod && (mod as any).default) ? (mod as any).default : mod;
        if (!mermaid) return;
        // determine theme (dark mode) from document or prefers-color-scheme
        const prefersDark = typeof document !== 'undefined' && (document.documentElement.classList.contains('dark') || window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        // initialize mermaid with theme-aware variables to ensure good contrast
        try {
          mermaid.initialize && mermaid.initialize({
            startOnLoad: false,
            theme: prefersDark ? 'dark' : 'default',
            themeVariables: prefersDark
              ? {
                  background: 'transparent',
                  primaryTextColor: '#E6EDF3',
                  lineColor: '#9CA3AF',
                  primaryColor: '#0f172a'
                }
              : {
                  background: 'transparent',
                  primaryTextColor: '#0f172a',
                  lineColor: '#374151',
                  primaryColor: '#ffffff'
                }
          });
        } catch {}

        // Try modern promise-based API first
        if (typeof mermaid.render === 'function') {
          try {
            const rendered = await mermaid.render(id, code);
            if (!mounted) return;
            // mermaid.render may return an object or a string depending on version
            const svgOut = typeof rendered === 'string' ? rendered : (rendered?.svg || rendered?.svgString || '');
            setSvg(svgOut);
            return;
          } catch (err) {
            // fallthrough to mermaidAPI
          }
        }

        // Fallback to mermaidAPI.render callback-style
        if (mermaid.mermaidAPI && typeof mermaid.mermaidAPI.render === 'function') {
          mermaid.mermaidAPI.render(id, code, (rendered: string) => {
            if (!mounted) return;
            setSvg(rendered);
          });
          return;
        }
      } catch (e) {
        console.error('Mermaid dynamic import/render error', e);
      }
    })();

    return () => { mounted = false; };
  }, [className, code]);

  if (className && className.includes('language-mermaid')) {
    return (
      <div ref={ref} className="my-4">
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <pre className="rounded-md bg-slate-900 text-slate-100 p-4 overflow-auto"><code>{code}</code></pre>
        )}
      </div>
    );
  }

  // default code rendering
  if (inline) {
    return <code className={className}>{code}</code>;
  }
  return (
    <pre className="rounded-md bg-slate-900 text-slate-100 p-2 overflow-auto"><code className={className}>{code}</code></pre>
  );
}

// Handle pre blocks to avoid invalid nesting (<pre> inside <p>) and to support mermaid rendering
function PreBlock({ children }: any) {
  // children typically is [<code className="language-...">...</code>]
  const codeChild = Array.isArray(children) ? children[0] : children;
  const className = codeChild?.props?.className || '';
  const code = codeChild?.props?.children ? String(codeChild.props.children) : '';

  if (className && className.includes('language-mermaid')) {
    // Reuse the same rendering logic as CodeBlock but ensure we render at top-level (not within a <p>)
    const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
    const [svg, setSvg] = useState<string | null>(null);

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const mod = await import('mermaid');
          const mermaid = (mod && (mod as any).default) ? (mod as any).default : mod;
          if (!mermaid) return;
          try { mermaid.initialize && mermaid.initialize({ startOnLoad: false }); } catch {}
          if (typeof mermaid.render === 'function') {
            try {
              const rendered = await mermaid.render(id, code);
              if (!mounted) return;
              const svgOut = typeof rendered === 'string' ? rendered : (rendered?.svg || rendered?.svgString || '');
              setSvg(svgOut);
              return;
            } catch (err) {}
          }
          if (mermaid.mermaidAPI && typeof mermaid.mermaidAPI.render === 'function') {
            mermaid.mermaidAPI.render(id, code, (rendered: string) => {
              if (!mounted) return;
              setSvg(rendered);
            });
            return;
          }
        } catch (e) {
          console.error('Mermaid render error', e);
        }
      })();
      return () => { mounted = false; };
    }, [code]);

    return (
      <div className="my-4">
        {svg ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="rounded-md bg-slate-900 text-slate-100 p-4 overflow-auto"><code>{code}</code></div>
        )}
      </div>
    );
  }

  return <pre>{children}</pre>;
}

/**
 * Markdown renderer component with GitHub Flavored Markdown support and Mermaid support
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-code:text-pink-600 prose-pre:bg-slate-900 prose-pre:text-slate-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock, pre: PreBlock }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
