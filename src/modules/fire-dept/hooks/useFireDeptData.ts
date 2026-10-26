import { useState, useEffect, useCallback } from 'react';
import { FireEquipment } from '../types';
import { apiDb } from '../../../services/apiDatabaseClient';

export function useFireDeptData() {
  const [equipment, setEquipment] = useState<FireEquipment[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const normalizeEquip = (list: FireEquipment[]) => {
    return list.map(item => {
      const itemAny = item as any;
      if (itemAny.type && typeof itemAny.type === 'string') {
        const updatedType = itemAny.type
          .replace(/خاموشکننده|خاموش‌کننده/g, 'خاموش كننده')
          .replace(/دیاکسید/g, 'دی‌اکسید');
        return { ...item, type: updatedType } as FireEquipment;
      }
      return item;
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

  const addEquipment = async (item: FireEquipment) => {
    setEquipment(prev => [item, ...prev]);
    try {
      await apiDb.saveFireEquipment(item);
    } catch (e) {
      console.error('Failed to save fire equipment to پایگاه داده:', e);
      loadData();
    }
  };

  const updateEquipment = async (id: string, updates: Partial<FireEquipment>) => {
    setEquipment(prev => prev.map(item => item.id === id ? { ...item, ...updates } as FireEquipment : item));
    try {
      const current = equipment.find(item => item.id === id);
      if (current) {
        await apiDb.saveFireEquipment({ ...current, ...updates });
      }
    } catch (e) {
      console.error('Failed to update fire equipment in پایگاه داده:', e);
      loadData();
    }
  };

  const deleteEquipment = async (id: string) => {
    setEquipment(prev => prev.filter(item => item.id !== id));
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
    reload: loadData
  };
}
