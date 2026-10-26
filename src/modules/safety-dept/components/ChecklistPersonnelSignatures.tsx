import React from 'react';
import { OperationalSafetyInspection } from '../types';
import Checklist3TierSignatures from '../../../components/common/Checklist3TierSignatures';

interface ChecklistPersonnelSignaturesProps {
  formData: Partial<OperationalSafetyInspection>;
  onChange: (updated: Partial<OperationalSafetyInspection>) => void;
  isFa: boolean;
  readOnly?: boolean;
}

/**
 * ChecklistPersonnelSignatures:
 * Unified 3-Tier Official Signatures Section for Safety Checklists:
 * 1. کارشناس / نماینده واحد (Unit Expert / Representative)
 * 2. سرپرست / مسئول واحد (Unit Supervisor / In-Charge)
 * 3. رئیس مرکز HSE (Head of HSE Center)
 */
export default function ChecklistPersonnelSignatures({
  formData,
  onChange,
  isFa,
  readOnly = false
}: ChecklistPersonnelSignaturesProps) {
  return (
    <Checklist3TierSignatures
      formData={formData}
      onChange={onChange}
      isFa={isFa}
      readOnly={readOnly}
    />
  );
}
