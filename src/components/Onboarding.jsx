import { useState, useEffect } from 'react';

const STEPS = [
  {
    icon: '✨',
    title: 'Welcome to Medicharo',
    desc: 'A community where dreams meet kindness. Share your wishes and let people contribute directly via UPI.'
  },
  {
    icon: '🙋',
    title: 'Create a Wishlist',
    desc: 'Post what you\'re saving up for — a gadget, a course, a dream experience. Tell your story and set a goal.'
  },
  {
    icon: '❤️',
    title: 'Contribute to Others',
    desc: 'Browse wishes and contribute directly to someone\'s dream via UPI. Every contribution brings them closer.'
  },
  {
    icon: '✅',
    title: 'Confirm & Celebrate',
    desc: 'Creators confirm payments. If something goes wrong, you can report it and our team will help resolve it.'
  }
];

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem('mc-onboarding');
    if (!seen) {
      setTimeout(() => setOpen(true), 600);
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      localStorage.setItem('mc-onboarding', '1');
      setOpen(false);
      setStep(0);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('mc-onboarding', '1');
    setOpen(false);
    setStep(0);
  };

  if (!open) return null;

  const s = STEPS[step];

  return (
    <div className="modal-overlay open" style={{ zIndex: 500, backdropFilter: 'blur(6px)' }}>
      <div className="onboarding-modal">
        <button className="onboarding-skip" onClick={handleSkip}>Skip →</button>
        <div className="onboarding-icon">{s.icon}</div>
        <div className="onboarding-title">{s.title}</div>
        <div className="onboarding-desc">{s.desc}</div>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={'onboarding-dot' + (i === step ? ' active' : '')} />
          ))}
        </div>
        <button className="btn btn-primary btn-lg btn-full" onClick={handleNext} style={{ fontSize: 'var(--text-base)' }}>
          {step < STEPS.length - 1 ? 'Next →' : '✨ Get Started'}
        </button>
      </div>
    </div>
  );
}
