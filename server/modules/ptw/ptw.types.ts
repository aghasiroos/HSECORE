export interface GasTestRecord {
  gasType: 'O2' | 'LEL' | 'CO' | 'H2S' | 'OTHER';
  value: string;
  unit: string;
  isAcceptable: boolean;
  testedAt: string;
  testedBy: string;
}

export interface PTWCreateRequest {
  title: string;
  permitType: 'HOT_WORK' | 'COLD_WORK' | 'CONFINED_SPACE' | 'ELECTRICAL' | 'EXCAVATION' | 'RADIATION' | 'WORKING_AT_HEIGHT';
  location: string;
  unitId?: number;
  companyId?: number;
  departmentId?: number;
  startDate: string;
  endDate: string;
  hazards?: string[];
  precautions?: string[];
  requiredPPE?: string[];
  gasTests?: GasTestRecord[];
  applicantName?: string;
  applicantPersonnelCode?: string;
  contractorName?: string;
  authorizedGasTester?: string;
  isolationRequired?: boolean;
  isolationDetails?: string;
  weatherRestrictions?: string;
  permitData?: any;
}
