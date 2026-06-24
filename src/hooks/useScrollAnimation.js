import { useEffect, useRef, useState, useMemo } from 'react';

export default function useScrollAnimation(options) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const stableOptions = useMemo(() => options || {}, [JSON.stringify(options || {})]);

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
    }, { threshold: 0, rootMargin: '0px', ...stableOptions });

    observer.observe(el);

    if (el.getBoundingClientRect().top < window.innerHeight) {
      setVisible(true);
      observer.unobserve(el);
    }

    return () => observer.disconnect();
  }, [stableOptions]);

  return [ref, visible];
}
