import { useContext } from 'react';
import { ToastContext } from '../App';

export function useToast() { return useContext(ToastContext); }

export default function Toast({ message, type, onClose }) {
  return (
    <div className={'toast ' + type} style={{ opacity: 1, transform: 'translateX(0)' }}>
      <span>{type === 'success' ? '✅' : '⚠️'}</span>
      <span>{message}</span>
    </div>
  );
}
