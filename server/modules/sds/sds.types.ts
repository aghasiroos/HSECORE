export type SdsStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'OBSOLETE';

export type SdsPhysicalState =
  | 'GAS'
  | 'LIQUID'
  | 'SOLID'
  | 'POWDER'
  | 'MIXTURE'
  | 'OTHER';

export type SdsSignalWord = 'DANGER' | 'WARNING' | 'NONE';

export type SdsAttachmentRole =
  | 'PRIMARY_SDS_PDF'
  | 'TECHNICAL_SPEC'
  | 'COA'
  | 'STORAGE_INSTRUCTION'
  | 'TRANSPORT_DOC'
  | 'OTHER';

export type GhsPictogramCode =
  | 'GHS01'
  | 'GHS02'
  | 'GHS03'
  | 'GHS04'
  | 'GHS05'
  | 'GHS06'
  | 'GHS07'
  | 'GHS08'
  | 'GHS09';

export interface SdsGhsData {
  hazardClasses: string[];
  pictograms: GhsPictogramCode[];
  signalWord: SdsSignalWord;
  hStatements: string[];
  pStatements: string[];
  exposureRoutes: string[];
  healthHazardsSummary?: string;
  physicalHazardsSummary?: string;
  environmentalHazardsSummary?: string;
}

export interface SdsCompositionRow {
  ingredientName: string;
  casNumber?: string;
  ecNumber?: string;
  concentration?: string;
  classification?: string;
}

export interface SdsSections16 {
  section1: {
    productIdentifier: string;
    synonyms?: string;
    recommendedUse?: string;
    restrictionsOnUse?: string;
    manufacturerDetails?: string;
    supplierDetails?: string;
    emergencyPhone?: string;
    complexEmergencyPhone?: string;
  };
  section2: {
    ghsClassificationText?: string;
    labelElementsNotes?: string;
    otherHazards?: string;
  };
  section3: {
    substanceOrMixture: 'SUBSTANCE' | 'MIXTURE';
    chemicalFormula?: string;
    molecularWeight?: string;
    ingredients: SdsCompositionRow[];
    notes?: string;
  };
  section4: {
    inhalation?: string;
    skinContact?: string;
    eyeContact?: string;
    ingestion?: string;
    acuteAndDelayedSymptoms?: string;
    medicalAttentionAndSpecialTreatment?: string;
  };
  section5: {
    suitableExtinguishingMedia?: string;
    unsuitableExtinguishingMedia?: string;
    specificHazardsFromChemical?: string;
    firefighterProtectiveEquipment?: string;
    firefightingInstructions?: string;
  };
  section6: {
    personalPrecautions?: string;
    environmentalPrecautions?: string;
    containmentAndCleanupMethods?: string;
    referenceToOtherSections?: string;
  };
  section7: {
    safeHandlingPrecautions?: string;
    safeStorageConditions?: string;
    incompatibleStorageMaterials?: string;
    specificEndUses?: string;
  };
  section8: {
    occupationalExposureLimits?: string;
    engineeringControls?: string;
    eyeFaceProtection?: string;
    handSkinProtection?: string;
    respiratoryProtection?: string;
    thermalHazardsAndHygiene?: string;
  };
  section9: {
    appearanceAndColor?: string;
    odor?: string;
    ph?: string;
    meltingFreezingPoint?: string;
    initialBoilingPoint?: string;
    flashPoint?: string;
    evaporationRate?: string;
    flammabilityUpperLower?: string;
    vaporPressure?: string;
    vaporDensity?: string;
    relativeDensity?: string;
    waterSolubility?: string;
    autoIgnitionTemp?: string;
    decompositionTemp?: string;
    viscosity?: string;
  };
  section10: {
    reactivity?: string;
    chemicalStability?: string;
    hazardousReactions?: string;
    conditionsToAvoid?: string;
    incompatibleMaterials?: string;
    hazardousDecompositionProducts?: string;
  };
  section11: {
    acuteToxicity?: string;
    skinCorrosionIrritation?: string;
    eyeDamageIrritation?: string;
    respiratorySkinSensitization?: string;
    germCellMutagenicity?: string;
    carcinogenicity?: string;
    reproductiveToxicity?: string;
    stotSingleRepeated?: string;
    aspirationHazard?: string;
  };
  section12: {
    ecotoxicity?: string;
    persistenceAndDegradability?: string;
    bioaccumulativePotential?: string;
    mobilityInSoil?: string;
    otherAdverseEffects?: string;
  };
  section13: {
    wasteTreatmentMethods?: string;
    contaminatedPackagingDisposal?: string;
    specialDisposalPrecautions?: string;
  };
  section14: {
    unNumber?: string;
    properShippingName?: string;
    transportHazardClass?: string;
    packingGroup?: string;
    environmentalHazardsMarinePollutant?: string;
    adrRidImdgIataNotes?: string;
  };
  section15: {
    safetyHealthEnvironmentalRegulations?: string;
    iranAndPetrochemicalStandards?: string;
    chemicalSafetyAssessmentStatus?: string;
  };
  section16: {
    preparationAndRevisionNotes?: string;
    abbreviationsAndAcronyms?: string;
    keyLiteratureReferences?: string;
    trainingAdvice?: string;
    disclaimer?: string;
  };
}

export interface SdsAiExtractionMetadata {
  extractionStatus?: 'NOT_RUN' | 'EXTRACTED_PENDING_CONFIRMATION' | 'CONFIRMED';
  sourceEngine?: string;
  confidenceScore?: number;
  extractedAt?: string;
  requiresUserConfirmation?: boolean;
  compatibilityTags?: string[];
  hazardSimilarityKeywords?: string[];
  riskIntegrationRefs?: {
    hazopIds?: string[];
    jsaIds?: string[];
    warehouseCodes?: string[];
    emergencyPlanIds?: string[];
  };
}

export interface SdsAttachmentDTO {
  id: number;
  sdsId: number;
  fileId: string;
  attachmentRole: SdsAttachmentRole;
  title: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  notes?: string;
  uploadedBy?: string;
  uploaderRole?: string;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface SdsRevisionDTO {
  id: number;
  sdsId: number;
  revisionNumber: number;
  statusAtSnapshot: SdsStatus;
  changeSummary: string;
  triggerReason: string;
  snapshot: any;
  createdBy: string;
  editorName: string;
  approverName?: string;
  approvedAt?: string | null;
  createdAt: string;
}

export interface SdsRecordDTO {
  id: number;
  sdsUid: string;
  documentNumber: string;
  materialNameFa: string;
  materialNameEn: string;
  tradeName: string;
  casNumber: string;
  unNumber: string;
  manufacturer: string;
  supplier: string;
  unitId: number | null;
  unitName: string;
  storageLocation: string;
  physicalState: SdsPhysicalState;
  revisionNumber: number;
  preparedDate: string;
  lastRevisionDate: string;
  revisionTriggerReason: string;
  needsRevision: boolean;
  reviewAlertMessage: string;
  status: SdsStatus;
  ghsData: SdsGhsData;
  sections: SdsSections16;
  primaryFileId: string | null;
  aiExtractionMetadata: SdsAiExtractionMetadata;
  linkedRiskRefs: Record<string, any>;
  createdBy: string;
  createdByRole: string;
  updatedBy: string;
  reviewedBy?: string;
  reviewedAt?: string | null;
  approvedBy?: string;
  approvedAt?: string | null;
  publishedBy?: string;
  publishedAt?: string | null;
  obsoleteReason?: string;
  createdAt: string;
  updatedAt: string;
  attachments: SdsAttachmentDTO[];
  revisions?: SdsRevisionDTO[];
  attachmentCount: number;
  hasPrimaryPdf: boolean;
}

export interface SdsDashboardStats {
  total: number;
  approvedOrPublished: number;
  pendingApproval: number;
  missingPrimaryPdf: number;
  needsRevision: number;
  hazardousCount: number;
  totalAttachments: number;
  obsoleteCount: number;
}

export function normalizeDigitsServer(input: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let out = String(input || '');
  for (let i = 0; i < 10; i++) {
    out = out.replace(new RegExp(persianDigits[i], 'g'), String(i));
    out = out.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  return out;
}

export function normalizeCasNumber(cas?: string | null): string {
  if (!cas) return '';
  return normalizeDigitsServer(cas)
    .trim()
    .replace(/[\s\u200c]+/g, '')
    .replace(/[–—]/g, '-')
    .toUpperCase();
}

export function normalizeMaterialName(name?: string | null): string {
  if (!name) return '';
  return normalizeDigitsServer(name)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function createEmptySections16(materialName = ''): SdsSections16 {
  return {
    section1: { productIdentifier: materialName },
    section2: {},
    section3: { substanceOrMixture: 'SUBSTANCE', ingredients: [] },
    section4: {},
    section5: {},
    section6: {},
    section7: {},
    section8: {},
    section9: {},
    section10: {},
    section11: {},
    section12: {},
    section13: {},
    section14: {},
    section15: {},
    section16: {},
  };
}

export function createDefaultGhsData(): SdsGhsData {
  return {
    hazardClasses: [],
    pictograms: [],
    signalWord: 'NONE',
    hStatements: [],
    pStatements: [],
    exposureRoutes: [],
    healthHazardsSummary: '',
    physicalHazardsSummary: '',
    environmentalHazardsSummary: '',
  };
}
