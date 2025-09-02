import React, { useMemo, useCallback } from 'react';

// Strapi Admin passes many props to custom field inputs. We'll type them loosely to avoid version coupling.
// The important ones we use are: name, value, onChange, attribute (for options), placeholder, disabled, required, error

type InputProps = {
  name: string;
  value?: string | null;
  onChange: (e: { target: { name: string; value: string; type?: string } }) => void;
  attribute?: any;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  intlLabel?: { id?: string; defaultMessage?: string };
  description?: { id?: string; defaultMessage?: string };
};

function containsCJK(text: string): boolean {
  // CJK Unified Ideographs, Extended, Hiragana, Katakana, Hangul
  return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/.test(text);
}

function countWords(text: string): number {
  // Count words by splitting on whitespace; filters empty strings
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function countCharsGraphemes(text: string): number {
  // Count by Unicode code points (safer for emoji/surrogate pairs)
  return Array.from(text).length;
}

const Input: React.FC<InputProps> = (props) => {
  const { name, value, onChange, attribute, disabled, placeholder: propPlaceholder, required } = props;
  const str = typeof value === 'string' ? value : '';

  // Options can be provided from schema: options: { maxWords: number, maxChars: number, placeholder: string }
  const options = attribute?.options || {};
  const maxWords: number | undefined = options.maxWords;
  const maxChars: number | undefined = options.maxChars ?? attribute?.maxLength;
  const placeholder: string | undefined = options.placeholder ?? propPlaceholder;

  // Prefer words when explicitly configured, otherwise characters
  const preferredMode: 'words' | 'chars' = typeof maxWords === 'number' ? 'words' : 'chars';

  const hasCJK = useMemo(() => containsCJK(str), [str]);
  // If text contains CJK, words are not separated by spaces; fall back to character counting for better UX
  const effectiveMode: 'words' | 'chars' = preferredMode === 'words' && hasCJK ? 'chars' : preferredMode;

  const currentCount = useMemo(() => {
    if (effectiveMode === 'words') {
      return countWords(str);
    }
    return countCharsGraphemes(str);
  }, [str, effectiveMode]);

  const resolvedMaxChars = typeof maxChars === 'number' ? maxChars : 600;
  // If mode is chars due to fallback but only maxWords provided, honor maxWords as character cap for CJK text
  const maxCount = effectiveMode === 'words' ? (maxWords as number) : (typeof maxChars === 'number' ? maxChars : (typeof maxWords === 'number' ? maxWords : resolvedMaxChars));

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let next = e.target.value || '';

      if (effectiveMode === 'words' && typeof maxWords === 'number') {
        // Enforce max words by truncating to first N words
        const words = next.trim().split(/\s+/).filter(Boolean);
        if (words.length > maxWords) {
          next = words.slice(0, maxWords).join(' ');
        }
      } else {
        // Character limit (grapheme-aware)
        if (typeof maxCount === 'number') {
          const chars = Array.from(next);
          if (chars.length > maxCount) {
            next = chars.slice(0, maxCount).join('');
          }
        }
      }

      onChange({ target: { name, value: next, type: 'text' } });
    },
    [name, onChange, effectiveMode, maxWords, maxCount]
  );

  const overLimit = currentCount > (maxCount as number);

  const labelText = props?.intlLabel?.defaultMessage || attribute?.label || name;
  const hintText = props?.description?.defaultMessage || attribute?.description || '';

  return (
    <div style={{ position: 'relative' }}>
      {/* Label */}
      <label
        htmlFor={name}
        style={{
          display: 'block',
          marginBottom: 6,
          fontWeight: 600,
          fontSize: 12,
          color: 'var(--neutral800, #32324d)',
        }}
      >
        {labelText}{required ? ' *' : ''}
      </label>

      {/* Textarea */}
      <textarea
        id={name}
        name={name}
        value={str}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 72px 12px 12px',
          border: '1px solid var(--neutral150, #DCDCE4)',
          borderRadius: 8,
          outline: 'none',
          fontSize: 14,
          lineHeight: '20px',
        }}
      />

      {/* Counter */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 8,
          fontSize: 12,
          color: overLimit ? '#D72D2D' : 'rgb(73, 69, 255)',
          background: 'transparent',
          padding: '2px 6px',
          borderRadius: 4,
        }}
      >
        {currentCount}/{maxCount}
      </div>

      {/* Hint / description */}
      {hintText ? (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--neutral600, #666687)' }}>{hintText}</div>
      ) : null}
    </div>
  );
};

export default Input;