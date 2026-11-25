import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PinCodeInput({
  idPrefix = 'pin',
  label,
  value = '',
  onChange,
  error = '',
  masked = true,
  allowVisibilityToggle = true,
  autoComplete = 'off',
  autoFocus = false,
  disabled = false,
}) {
  const [isVisible, setIsVisible] = useState(!masked);
  const inputRefs = useRef([]);

  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '');

  const updateAt = (nextChars) => {
    onChange(nextChars.join('').slice(0, 6));
  };

  const focusSlot = (index) => {
    const target = inputRefs.current[index];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const handleChange = (index, rawVal) => {
    const onlyDigits = rawVal.replace(/\D/g, '');
    if (!onlyDigits) {
      const next = [...digits];
      next[index] = '';
      updateAt(next);
      return;
    }

    // Handle multi-digit input (e.g. mobile SMS autofill or quick typing)
    if (onlyDigits.length > 1) {
      const next = [...digits];
      for (let i = 0; i < onlyDigits.length && index + i < 6; i += 1) {
        next[index + i] = onlyDigits[i];
      }
      updateAt(next);
      const nextFocus = Math.min(5, index + onlyDigits.length);
      focusSlot(nextFocus);
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits;
    updateAt(next);
    if (index < 5) {
      focusSlot(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        updateAt(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        updateAt(next);
        focusSlot(index - 1);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusSlot(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      focusSlot(index + 1);
    }
  };

  const handlePaste = (e) => {
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
    if (!pasted) return;
    e.preventDefault();
    const sliced = pasted.slice(0, 6).split('');
    const next = Array.from({ length: 6 }, (_, i) => sliced[i] || '');
    updateAt(next);
    focusSlot(Math.min(5, sliced.length));
  };

  const inputType = isVisible ? 'text' : 'password';

  return (
    <div className="field-group">
      <div className="pin-header-row">
        <label className="field-label" htmlFor={`${idPrefix}-slot-0`}>
          {label}
        </label>
        {allowVisibilityToggle ? (
          <button
            type="button"
            className="pin-visibility-btn"
            onClick={() => setIsVisible((v) => !v)}
            aria-label={isVisible ? 'Hide digits' : 'Show digits'}
          >
            {isVisible ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            <span>{isVisible ? 'Hide' : 'Show'}</span>
          </button>
        ) : null}
      </div>

      <div className="pin-slots" role="group" aria-label={label}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            id={`${idPrefix}-slot-${index}`}
            type={inputType}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete={index === 0 ? autoComplete : 'off'}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            value={digit}
            aria-label={`${label} digit ${index + 1}`}
            aria-invalid={Boolean(error) || undefined}
            className={`pin-slot ${digit ? 'is-filled' : ''} ${error ? 'is-invalid' : ''}`}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
