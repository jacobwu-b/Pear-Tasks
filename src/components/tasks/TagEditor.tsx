import { useState } from 'react';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagEditor({ tags, onChange }: TagEditorProps) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const tag = input.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setInput('');
      return;
    }
    onChange([...tags, tag]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    // Remove last tag on backspace when input is empty
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleRemove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div data-testid="tag-editor">
      <span
        className="text-xs font-semibold uppercase tracking-wide block mb-2"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        Tags
      </span>
      <div
        className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-md min-h-[32px]"
        style={{
          border: '1px solid var(--color-border-primary)',
          backgroundColor: 'var(--color-surface-primary)',
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
          >
            {tag}
            <button
              onClick={() => handleRemove(tag)}
              data-testid={`tag-remove-${tag}`}
              className="cursor-pointer hover:opacity-70"
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                <path d="M3.97 3.03a.75.75 0 00-1.06 1.06L4.94 6 2.91 8.03a.75.75 0 101.06 1.06L6 7.06l2.03 2.03a.75.75 0 001.06-1.06L7.06 6l2.03-2.03a.75.75 0 00-1.06-1.06L6 4.94 3.97 3.03z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAdd}
          placeholder={tags.length === 0 ? 'Add tag...' : ''}
          data-testid="tag-input"
          className="flex-1 min-w-[60px] text-xs bg-transparent outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
      </div>
    </div>
  );
}
