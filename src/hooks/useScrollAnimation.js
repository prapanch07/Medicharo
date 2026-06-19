import { useEffect, useRef, useState } from 'react';

export default function useScrollAnimation(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.unobserve(el);
      }
    }, { threshold: 0, rootMargin: '0px', ...options });

    observer.observe(el);

    if (el.getBoundingClientRect().top < window.innerHeight) {
      setVisible(true);
      observer.unobserve(el);
    }

    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}
