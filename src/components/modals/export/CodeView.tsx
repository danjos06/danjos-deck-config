import { memo, useEffect, useRef, useState } from 'react';
import { Highlight, themes, type Token } from 'prism-react-renderer';

const LINE_H = 19;
const CHUNK = 80;

type GetLineProps = (input: { line: Token[]; key?: number }) => React.HTMLAttributes<HTMLElement>;
type GetTokenProps = (input: { token: Token; key?: number }) => React.HTMLAttributes<HTMLElement>;

interface ChunkProps {
  start: number;
  lines: Token[][];
  getLineProps: GetLineProps;
  getTokenProps: GetTokenProps;
  width: number;
}

/** Renders a slice of highlighted lines only once it scrolls near the viewport. */
const Chunk = memo(function Chunk({ start, lines, getLineProps, getTokenProps, width }: ChunkProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(start === 0);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={{ minHeight: lines.length * LINE_H, contentVisibility: 'auto', containIntrinsicSize: `auto ${lines.length * LINE_H}px` }}>
      {visible &&
        lines.map((line, i) => {
          const { key: _k, ...lp } = getLineProps({ line }) as React.HTMLAttributes<HTMLElement> & { key?: string };
          void _k;
          return (
            <div key={start + i} {...lp} style={{ ...lp.style, height: LINE_H, display: 'flex' }}>
              <span aria-hidden="true" className="sticky left-0 select-none bg-ink-950 pr-3 text-right text-fg-dim/60" style={{ width: width + 16, flex: `0 0 ${width + 16}px` }}>
                {start + i + 1}
              </span>
              <span className="whitespace-pre">
                {line.map((token, k) => {
                  const { key: _tk, ...tp } = getTokenProps({ token }) as React.HTMLAttributes<HTMLElement> & { key?: string };
                  void _tk;
                  return <span key={k} {...tp} />;
                })}
              </span>
            </div>
          );
        })}
    </div>
  );
});

/** Highlighted, line-numbered, lazily rendered code view (handles several thousand lines). */
export function CodeView({ code, language = 'cpp' }: { code: string; language?: string }) {
  return (
    <Highlight theme={themes.vsDark} code={code} language={language}>
      {({ tokens, getLineProps, getTokenProps }) => {
        const width = String(tokens.length).length * 8;
        const chunks: { start: number; lines: Token[][] }[] = [];
        for (let i = 0; i < tokens.length; i += CHUNK) chunks.push({ start: i, lines: tokens.slice(i, i + CHUNK) });
        return (
          <pre className="m-0 overflow-x-auto bg-ink-950 py-3 font-mono text-[12.5px] leading-[19px]" tabIndex={0} aria-label="Código gerado">
            <code className="block min-w-max">
              {chunks.map((c) => (
                <Chunk key={c.start} start={c.start} lines={c.lines} getLineProps={getLineProps} getTokenProps={getTokenProps} width={width} />
              ))}
            </code>
          </pre>
        );
      }}
    </Highlight>
  );
}
