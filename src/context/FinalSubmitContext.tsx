import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  FinalSubmitConfirmModal,
  FinalSubmitOptions,
  DEFAULT_FINAL_SUBMIT_MESSAGE_FA,
  DEFAULT_CONFIRM_TEXT_FA,
  DEFAULT_CANCEL_TEXT_FA
} from '../components/common/FinalSubmitConfirmModal';
import { showConfirmDialog } from '../components/common/ConfirmDialogModal';

interface FinalSubmitContextType {
  confirmFinalSubmit: (options: FinalSubmitOptions) => Promise<boolean>;
  closeFinalSubmitModal: () => void;
  isOpen: boolean;
}

const FinalSubmitContext = createContext<FinalSubmitContextType | null>(null);

export const FinalSubmitProvider: React.FC<{ children: React.ReactNode; defaultLanguage?: string }> = ({
  children,
  defaultLanguage = 'fa'
}) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    options: FinalSubmitOptions | null;
    resolver: ((confirmed: boolean) => void) | null;
  }>({
    isOpen: false,
    options: null,
    resolver: null
  });

  const closeFinalSubmitModal = useCallback(() => {
    if (modalState.resolver) {
      modalState.resolver(false);
    }
    setModalState({
      isOpen: false,
      options: null,
      resolver: null
    });
  }, [modalState.resolver]);

  const confirmFinalSubmit = useCallback((userOptions: FinalSubmitOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const mergedOptions: FinalSubmitOptions = {
        isFa: userOptions.isFa !== undefined ? userOptions.isFa : defaultLanguage === 'fa',
        message: userOptions.message || DEFAULT_FINAL_SUBMIT_MESSAGE_FA,
        confirmText: userOptions.confirmText || DEFAULT_CONFIRM_TEXT_FA,
        cancelText: userOptions.cancelText || DEFAULT_CANCEL_TEXT_FA,
        ...userOptions,
        onConfirm: async () => {
          try {
            await userOptions.onConfirm();
            resolve(true);
          } catch (err) {
            console.error('Final submit execution failed:', err);
            resolve(false);
            throw err;
          }
        },
        onCancel: () => {
          if (userOptions.onCancel) userOptions.onCancel();
          resolve(false);
        }
      };

      setModalState({
        isOpen: true,
        options: mergedOptions,
        resolver: resolve
      });
    });
  }, [defaultLanguage]);

  const contextValue = useMemo(() => ({
    confirmFinalSubmit,
    closeFinalSubmitModal,
    isOpen: modalState.isOpen
  }), [confirmFinalSubmit, closeFinalSubmitModal, modalState.isOpen]);

  return (
    <FinalSubmitContext.Provider value={contextValue}>
      {children}
      <FinalSubmitConfirmModal
        isOpen={modalState.isOpen}
        onClose={closeFinalSubmitModal}
        options={modalState.options}
      />
    </FinalSubmitContext.Provider>
  );
};

export const useFinalSubmit = (): FinalSubmitContextType => {
  const context = useContext(FinalSubmitContext);
  if (!context) {
    // Return a fallback handler that creates a temporary promise/alert or silent execution if provider is missing
    return {
      confirmFinalSubmit: async (opts) => {
        const msg = opts.message || DEFAULT_FINAL_SUBMIT_MESSAGE_FA;
        const ok = await showConfirmDialog(msg, {
          isFa: opts.isFa !== false,
          confirmText: opts.confirmText || DEFAULT_CONFIRM_TEXT_FA,
          cancelText: opts.cancelText || DEFAULT_CANCEL_TEXT_FA,
          variant: 'warning',
        });
        if (ok) {
          await opts.onConfirm();
          return true;
        } else {
          if (opts.onCancel) opts.onCancel();
          return false;
        }
      },
      closeFinalSubmitModal: () => {},
      isOpen: false
    };
  }
  return context;
};

/**
 * Standalone hook for components needing dedicated local modal instance
 */
export function useFinalSubmitModal(defaultIsFa: boolean = true) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<FinalSubmitOptions | null>(null);

  const requestFinalSubmit = useCallback((options: FinalSubmitOptions) => {
    setModalOptions({
      isFa: options.isFa !== undefined ? options.isFa : defaultIsFa,
      message: options.message || DEFAULT_FINAL_SUBMIT_MESSAGE_FA,
      confirmText: options.confirmText || DEFAULT_CONFIRM_TEXT_FA,
      cancelText: options.cancelText || DEFAULT_CANCEL_TEXT_FA,
      ...options
    });
    setIsOpen(true);
  }, [defaultIsFa]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setModalOptions(null);
  }, []);

  const FinalSubmitModalElement = (
    <FinalSubmitConfirmModal
      isOpen={isOpen}
      onClose={closeModal}
      options={modalOptions}
    />
  );

  return {
    requestFinalSubmit,
    closeModal,
    isModalOpen: isOpen,
    FinalSubmitModalElement
  };
}
