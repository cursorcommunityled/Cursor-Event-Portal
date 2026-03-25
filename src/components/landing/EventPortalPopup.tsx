'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface EventPortalPopupProps {
  isOpen: boolean;
  onClose: () => void;
  activeEventSlug: string;
}

export default function EventPortalPopup({ isOpen, onClose, activeEventSlug }: EventPortalPopupProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-md text-center space-y-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="space-y-6">
              <div className="relative w-full max-w-[280px] mx-auto">
                <Image
                  src="/cursor-calgary.avif"
                  alt="Cursor Calgary"
                  width={280}
                  height={140}
                  className="w-full h-auto rounded-2xl shadow-[0_0_60px_rgba(255,255,255,0.1)]"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-light text-white tracking-tight">
                  Calgary Meetup
                </h2>
                <p className="text-gray-500 text-sm font-light tracking-widest uppercase opacity-50">
                  Community Builder Event
                </p>
              </div>
            </div>

            <div className="glass rounded-[40px] p-8 space-y-4">
              <Link
                href={`/${activeEventSlug}`}
                className="block w-full h-16 rounded-[24px] bg-white text-black flex items-center justify-center font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-gray-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-[0.98]"
              >
                Event Dashboard
              </Link>
              <p className="text-[10px] text-gray-700 uppercase tracking-[0.3em] font-light pt-4">
                Authorized Access Only
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
