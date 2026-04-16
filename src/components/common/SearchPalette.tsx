import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import { searchAll, type SearchResult } from '../../lib/search';
import { useUiStore } from '../../store/uiStore';

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

function groupByProject(results: SearchResult[]): Map<string, SearchResult[]> {
  const groups = new Map<string, SearchResult[]>();
  const projectResults = results.filter((r) => r.type === 'project');
  const taskResults = results.filter((r) => r.type === 'task');

  if (projectResults.length > 0) {
    groups.set('__projects__', projectResults);
  }

  for (const task of taskResults) {
    const key = task.projectId ?? '__no_project__';
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  return groups;
}

function groupLabel(key: string, items: SearchResult[]): string {
  if (key === '__projects__') return 'Projects';
  if (key === '__no_project__') return 'No Project';
  return items[0]?.projectTitle ?? 'Project';
}

function StatusDot({ status }: { status: string }) {
  let color = 'var(--color-text-tertiary)';
  if (status === 'completed') color = 'var(--color-status-completed)';
  else if (status === 'canceled') color = 'var(--color-status-canceled)';
  else if (status === 'open' || status === 'active') color = 'var(--color-accent)';
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function SearchPaletteBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setSidebarView = useUiStore((s) => s.setSidebarView);
  const setSelectedTaskId = useUiStore((s) => s.setSelectedTaskId);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search — 100ms after the user stops typing.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      const r = await searchAll(query);
      setResults(r);
      setActiveIndex(0);
    }, 100);
    return () => clearTimeout(timer);
  }, [query]);

  const flatResults = useMemo(() => {
    const flat: SearchResult[] = [];
    const grouped = groupByProject(results);
    for (const [, items] of grouped) {
      flat.push(...items);
    }
    return flat;
  }, [results]);

  const navigateToResult = (result: SearchResult) => {
    if (result.type === 'project') {
      setSidebarView({ type: 'project', projectId: result.id });
    } else {
      if (result.projectId) {
        setSidebarView({ type: 'project', projectId: result.projectId });
      } else {
        setSidebarView('inbox');
      }
      setSelectedTaskId(result.id);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[activeIndex]) {
      e.preventDefault();
      navigateToResult(flatResults[activeIndex]);
    }
  };

  // Scroll active item into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const grouped = groupByProject(results);

  let flatIndex = -1;

  return (
    <div data-testid="search-palette-dialog">
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          data-testid="search-palette-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search tasks and projects..."
          aria-label="Search tasks and projects"
          className="flex-1 text-base bg-transparent outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <kbd
          className="shrink-0 px-1.5 py-0.5 rounded text-xs font-mono"
          style={{
            backgroundColor: 'var(--color-surface-tertiary)',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border-primary)',
          }}
        >
          esc
        </kbd>
      </div>

      <div ref={listRef} className="max-h-80 overflow-y-auto" data-testid="search-results">
        {query.trim() && results.length === 0 && (
          <p
            className="px-4 py-6 text-sm text-center"
            style={{ color: 'var(--color-text-tertiary)' }}
            data-testid="search-no-results"
          >
            No results for "{query}"
          </p>
        )}

        {Array.from(grouped.entries()).map(([key, items]) => (
          <div key={key}>
            <div
              className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide sticky top-0"
              style={{
                color: 'var(--color-text-tertiary)',
                backgroundColor: 'var(--color-surface-primary)',
                borderBottom: '1px solid var(--color-border-primary)',
              }}
            >
              {groupLabel(key, items)}
            </div>
            {items.map((result) => {
              flatIndex++;
              const isActive = flatIndex === activeIndex;
              const idx = flatIndex;
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  data-active={isActive}
                  data-testid={`search-result-${result.type}-${result.id}`}
                  onClick={() => navigateToResult(result)}
                  className="w-full text-left px-4 py-2 flex items-center gap-3 cursor-pointer"
                  style={{
                    backgroundColor: isActive ? 'var(--color-surface-hover)' : 'transparent',
                    color: 'var(--color-text-primary)',
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <StatusDot status={result.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{result.title}</div>
                    {result.matchContext && (
                      <div
                        className="text-xs truncate mt-0.5"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {result.matchContext}
                      </div>
                    )}
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    {result.type === 'project' ? 'Project' : 'Task'}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPalette({ open, onClose }: SearchPaletteProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Search" maxWidthClass="max-w-lg" testId="search-palette-backdrop">
      <SearchPaletteBody onClose={onClose} />
    </Modal>
  );
}
