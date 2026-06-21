import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open = true,
  onClose,
  labelledBy,
  className = 'modal',
  overlayClassName = 'modal-overlay open',
  overlayStyle,
  closeOnBackdrop = true,
  closeOnEsc = true,
  children,
}) {
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const el = modalRef.current;
      if (!el) return;
      const focusables = el.querySelectorAll(FOCUSABLE);
      const first = focusables[0];
      if (first) first.focus();
      else el.focus();
    };
    const t = setTimeout(focusFirst, 0);

    const handleKey = (e) => {
      if (e.key === 'Escape' && closeOnEsc && onClose) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = modalRef.current;
      if (!el) return;
      const focusables = Array.from(el.querySelectorAll(FOCUSABLE)).filter(n => !n.hasAttribute('disabled'));
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKey, true);
      document.body.style.overflow = prevOverflow;
      if (lastFocusRef.current && typeof lastFocusRef.current.focus === 'function') {
        lastFocusRef.current.focus();
      }
    };
  }, [open, onClose, closeOnEsc]);

  if (!open) return null;

  const handleBackdrop = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      ref={overlayRef}
      className={overlayClassName}
      onClick={handleBackdrop}
      style={overlayStyle}
    >
      <div
        ref={modalRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title = 'Confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmTone = 'primary', onConfirm, onClose }) {
  const titleId = 'confirm-dialog-title';
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="modal-header">
        <div id={titleId} className="modal-title">{title}</div>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="modal-body">
        <p style={{ margin: 0 }}>{message}</p>
      </div>
      <div className="modal-footer">
        <button className="btn btn-outline" onClick={onClose}>{cancelLabel}</button>
        <button
          className={'btn btn-' + confirmTone}
          onClick={() => { onConfirm?.(); }}
          style={confirmTone === 'danger' ? { background: 'var(--color-error)', borderColor: 'var(--color-error)', color: 'white' } : undefined}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
