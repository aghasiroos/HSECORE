import { PermitSignatures4Tier } from '../../../types';
import { 
  ComplexPersonnel, 
  getComplexPersonnelList, 
  isPersonnelPtwAuthorized, 
  PTW_UNAUTHORIZED_ERROR_MESSAGE 
} from '../../../utils/personnelHelper';
import { getSystemUsers, ensureUserAndPersonnelInSync } from '../../../utils/authHelper';

export interface SuppFormProps {
  signatures?: PermitSignatures4Tier;
  onSignaturesChange?: (signatures: PermitSignatures4Tier) => void;
  isReadOnly?: boolean;
  permitCategory?: string;
}

export type SuppSignatureTierKey = 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit';

export function useSupplementarySignatureHelpers(
  signatures?: PermitSignatures4Tier,
  onSignaturesChange?: (signatures: PermitSignatures4Tier) => void,
  permitCategory?: string
) {
  const resolvePersonByTypedName = (typedName: string, fallbackJobTitle?: string, fallbackCode = '', fallbackUserId?: string) => {
    const clean = typedName.trim();
    const cleanNorm = clean.toLowerCase();
    let pCode = fallbackCode;
    let jobTitle = fallbackJobTitle;
    let userId = fallbackUserId;

    if (clean) {
      try {
        const list = getComplexPersonnelList();
        const found = list.find(p =>
          (p.fullName && p.fullName.trim().toLowerCase() === cleanNorm) ||
          (p.personnelCode && p.personnelCode.trim() === clean) ||
          (p.effectiveCode && p.effectiveCode.trim() === clean)
        );
        if (found) {
          pCode = found.personnelCode || found.effectiveCode || pCode;
          jobTitle = found.jobTitle || found.position || jobTitle;
          userId = found.id || userId;
          ensureUserAndPersonnelInSync({
            id: found.id,
            fullName: found.fullName,
            personnelCode: found.personnelCode,
            jobTitle: found.jobTitle,
            department: found.unit || found.department
          });
        } else {
          const users = getSystemUsers();
          const foundU = users.find(u =>
            (u.fullName && u.fullName.trim().toLowerCase() === cleanNorm) ||
            (u.username && u.username.trim().toLowerCase() === cleanNorm) ||
            (u.personnelNumber && u.personnelNumber.trim() === clean)
          );
          if (foundU) {
            pCode = foundU.personnelNumber || pCode;
            jobTitle = foundU.jobTitle || foundU.role || jobTitle;
            userId = String(foundU.id || (foundU as any).uid || userId || '');
            ensureUserAndPersonnelInSync({
              id: userId,
              fullName: foundU.fullName,
              personnelCode: pCode,
              jobTitle,
              department: foundU.departmentIds?.[0]
            });
          }
        }
      } catch {}
    }

    return { pCode, jobTitle, userId };
  };

  const updateTierName = (tierKey: SuppSignatureTierKey, typedName: string) => {
    if (!onSignaturesChange || !signatures) return;
    const { pCode, jobTitle, userId } = resolvePersonByTypedName(
      typedName,
      signatures[tierKey]?.userJobTitle || signatures[tierKey]?.roleTitle,
      signatures[tierKey]?.personnelCode || '',
      signatures[tierKey]?.userId
    );

    onSignaturesChange({
      ...signatures,
      [tierKey]: {
        ...signatures[tierKey],
        name: typedName,
        personnelCode: pCode,
        userJobTitle: jobTitle,
        userId
      }
    });
  };

  const selectTierPerson = (tierKey: SuppSignatureTierKey, person: ComplexPersonnel): { success: boolean; error?: string } => {
    if (!onSignaturesChange || !signatures) return { success: false, error: 'عدم وجود امضاها' };

    if (permitCategory) {
      const ptwCheck = isPersonnelPtwAuthorized(person, {
        roleKey: tierKey,
        permitCategory,
        allowExemptAdmins: false
      });
      if (!ptwCheck.isAuthorized) {
        return { success: false, error: ptwCheck.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE };
      }
    }

    const fullName = person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim();
    const pCode = person.personnelCode || person.effectiveCode || '';
    const jobTitle = person.jobTitle || person.position || signatures[tierKey]?.roleTitle;
    onSignaturesChange({
      ...signatures,
      [tierKey]: {
        ...signatures[tierKey],
        name: fullName,
        personnelCode: pCode,
        userJobTitle: jobTitle,
        userId: person.id
      }
    });
    ensureUserAndPersonnelInSync({
      id: person.id,
      fullName,
      personnelCode: pCode,
      jobTitle,
      department: person.unit || person.department
    });
    return { success: true };
  };

  const updateCoordinationSigner = (roleKey: string, roleTitle: string, typedName: string) => {
    if (!onSignaturesChange || !signatures) return;
    const currentList = Array.isArray(signatures.coordinationSigners) ? [...signatures.coordinationSigners] : [];
    const { pCode, jobTitle, userId } = resolvePersonByTypedName(typedName, roleTitle, '', '');

    const existingIdx = currentList.findIndex(c => c.roleKey === roleKey);
    const updatedItem = {
      roleKey,
      roleTitle,
      name: typedName,
      userJobTitle: jobTitle || roleTitle,
      personnelCode: pCode,
      userId: userId || '',
      declarationText: `هماهنگی و بازرسی فنی ${roleTitle} انجام گردید.`
    };

    if (existingIdx >= 0) {
      currentList[existingIdx] = { ...currentList[existingIdx], ...updatedItem };
    } else {
      currentList.push(updatedItem);
    }

    onSignaturesChange({
      ...signatures,
      coordinationSigners: currentList
    });
  };

  const selectCoordinationPerson = (roleKey: string, roleTitle: string, person: ComplexPersonnel) => {
    if (!onSignaturesChange || !signatures) return;
    const currentList = Array.isArray(signatures.coordinationSigners) ? [...signatures.coordinationSigners] : [];
    const fullName = person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim();
    const pCode = person.personnelCode || person.effectiveCode || '';
    const jobTitle = person.jobTitle || person.position || roleTitle;
    const userId = person.id || '';

    const existingIdx = currentList.findIndex(c => c.roleKey === roleKey);
    const updatedItem = {
      roleKey,
      roleTitle,
      name: fullName,
      userJobTitle: jobTitle,
      personnelCode: pCode,
      userId,
      declarationText: `هماهنگی و بازرسی فنی ${roleTitle} انجام گردید.`
    };

    if (existingIdx >= 0) {
      currentList[existingIdx] = { ...currentList[existingIdx], ...updatedItem };
    } else {
      currentList.push(updatedItem);
    }

    onSignaturesChange({
      ...signatures,
      coordinationSigners: currentList
    });
    ensureUserAndPersonnelInSync({
      id: userId,
      fullName,
      personnelCode: pCode,
      jobTitle,
      department: person.unit || person.department
    });
  };

  return {
    updateTierName,
    selectTierPerson,
    updateCoordinationSigner,
    selectCoordinationPerson
  };
}

export * from './SuppElectricalIsolation';
export * from './SuppProcessMechanical';
export * from './SuppExcavation';
export * from './SuppRadiation';
export * from './SuppConfinedSpace';
export * from './SuppVehicleCrane';


