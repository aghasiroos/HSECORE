import React from 'react';
import { UserProfile } from '../types';
import RiskAssessmentModule from '../modules/risk-assessment/RiskAssessmentModule';

interface RiskAssessmentProps {
  currentUser: UserProfile;
  isFa: boolean;
}

export default function RiskAssessment({ currentUser, isFa }: RiskAssessmentProps) {
  return <RiskAssessmentModule currentUser={currentUser} isFa={isFa} />;
}
