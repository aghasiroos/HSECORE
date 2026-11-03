import { useState, useEffect, useCallback } from 'react';
import { FireEquipment } from '../types';
import { apiDb } from '../../../services/apiDatabaseClient';
import { composeStructuredLocation, extractEquipmentUniqueCode } from '../config/columns';

export function useFireDeptData() {
  const [equipment, setEquipment] = useState<FireEquipment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const normalizeEquip = (list: FireEquipment[]): FireEquipment[] => {
    return list.map((item) => {
      const itemAny = item as any;
      let updatedType = itemAny.type;
      if (updatedType && typeof updatedType === 'string') {
        updatedType = updatedType
          .replace(/خاموشکننده|خاموش‌کننده/g, 'خاموش كننده')
          .replace(/دیاکسید/g, 'دی‌اکسید');
      }

      const locDetails = {
        complex: String(itemAny.locationDetails?.complex ?? itemAny.complex ?? '').trim(),
        unit: String(itemAny.locationDetails?.unit ?? itemAny.unit ?? '').trim(),
        direction: String(itemAny.locationDetails?.direction ?? itemAny.direction ?? '').trim(),
        floor: String(itemAny.locationDetails?.floor ?? itemAny.floor ?? '').trim(),
        exactLocation: String(itemAny.locationDetails?.exactLocation ?? itemAny.exactLocation ?? '').trim(),
      };

      const composedLocation =
        composeStructuredLocation({
          ...locDetails,
          fallbackLocation: itemAny.location,
        }) || itemAny.location || '';

      const operationalStatus = itemAny.operationalStatus || 'فعال';
      const isTemporaryOut =
        operationalStatus === 'انتقال جهت شارژ' || operationalStatus === 'انتقال جهت تست';

      return {
        ...item,
        ...(updatedType ? { type: updatedType } : {}),
        code: extractEquipmentUniqueCode(itemAny),
        location: composedLocation,
        complex: locDetails.complex,
        unit: locDetails.unit,
        direction: locDetails.direction,
        floor: locDetails.floor,
        exactLocation: locDetails.exactLocation,
        locationDetails: locDetails,
        primaryLocation: itemAny.primaryLocation || composedLocation,
        primaryLocationDetails: itemAny.primaryLocationDetails || locDetails,
        operationalStatus,
        isTemporaryOut,
        statusHistory: Array.isArray(itemAny.statusHistory) ? itemAny.statusHistory : [],
        inspections: Array.isArray(itemAny.inspections) ? itemAny.inspections : [],
        defects: Array.isArray(itemAny.defects) ? itemAny.defects : [],
      } as FireEquipment;
    });
  };

  const loadData = useCallback(async () => {
    try {
      const fromDb = await apiDb.getFireEquipment();
      if (Array.isArray(fromDb)) {
        setEquipment(normalizeEquip(fromDb));
      }
    } catch (e) {
      console.error('Failed to load fire equipment from پایگاه داده:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleRemoteMutation = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || e?.detail?.key || '').toLowerCase();
      if (!entity || entity.includes('fire') || entity.includes('equipment')) {
        loadData();
      }
    };

    window.addEventListener('app_data_mutated', handleRemoteMutation);
    window.addEventListener('hse_data_mutated', handleRemoteMutation);
    return () => {
      window.removeEventListener('app_data_mutated', handleRemoteMutation);
      window.removeEventListener('hse_data_mutated', handleRemoteMutation);
    };
  }, [loadData]);

  const addEquipment = async (item: FireEquipment): Promise<FireEquipment> => {
    const saved = await apiDb.saveFireEquipment({ ...item, __isCreate: true });
    const normalized = normalizeEquip([saved || item])[0];
    setEquipment((prev) => {
      const withoutDup = prev.filter(
        (p) => p.id !== normalized.id && extractEquipmentUniqueCode(p) !== extractEquipmentUniqueCode(normalized)
      );
      return [normalized, ...withoutDup];
    });
    return normalized;
  };

  const updateEquipment = async (id: string, updates: Partial<FireEquipment>): Promise<FireEquipment | null> => {
    const current = equipment.find((item) => item.id === id || item.code === id);
    const mergedPayload = {
      ...(current || {}),
      ...updates,
      id: updates.id || current?.id || id,
      __isCreate: false,
      __editingId: id,
    };

    const saved = await apiDb.saveFireEquipment(mergedPayload);
    const normalized = normalizeEquip([saved || mergedPayload])[0];
    setEquipment((prev) =>
      prev.map((item) => (item.id === id || item.id === normalized.id ? normalized : item))
    );
    return normalized;
  };

  const deleteEquipment = async (id: string) => {
    setEquipment((prev) => prev.filter((item) => item.id !== id));
    try {
      await apiDb.deleteFireEquipment(id);
    } catch (e) {
      console.error('Failed to delete fire equipment from پایگاه داده:', e);
      loadData();
    }
  };

  return {
    equipment,
    isLoaded,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    reload: loadData,
  };
}
