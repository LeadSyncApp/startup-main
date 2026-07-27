import { createContext, useContext, useState, ReactNode } from 'react';

export type WizardStep = 'list' | 'intake' | 'confirm';

interface WizardContextValue {
  step: WizardStep | null;
  setStep: (step: WizardStep | null) => void;
}

const WizardContext = createContext<WizardContextValue>({
  step: null,
  setStep: () => {},
});

export const useWizardStep = () => useContext(WizardContext);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<WizardStep | null>(null);
  return (
    <WizardContext.Provider value={{ step, setStep }}>
      {children}
    </WizardContext.Provider>
  );
}
