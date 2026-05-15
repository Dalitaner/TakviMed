import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMedication,
  getDayItems,
  migrateLegacyData,
  persistAll,
  syncReminderWorker,
  todayKey,
  updateMedication,
} from "../services/medicationService";

export function useMedications() {
  const [state, setState] = useState(() => migrateLegacyData());

  useEffect(() => {
    persistAll(state);
    syncReminderWorker(state.medications, state.checked);
  }, [state]);

  const addMedication = useCallback((payload) => {
    const med = createMedication(payload);
    setState((current) => ({ ...current, medications: [med, ...current.medications] }));
    return med;
  }, []);

  const editMedication = useCallback((id, patch) => {
    setState((current) => ({
      ...current,
      medications: current.medications.map((med) => (med.id === id ? updateMedication(med, patch) : med)),
    }));
  }, []);

  const deleteMedication = useCallback((id) => {
    setState((current) => {
      const deleted = current.medications.find((med) => med.id === id);
      return {
        ...current,
        medications: current.medications.filter((med) => med.id !== id),
        archive: deleted ? [{ ...deleted, archivedAt: new Date().toISOString() }, ...current.archive] : current.archive,
      };
    });
  }, []);

  const restoreMedication = useCallback((id) => {
    setState((current) => {
      const restored = current.archive.find((med) => med.id === id);
      if (!restored) return current;
      const { archivedAt, ...med } = restored;
      return {
        ...current,
        medications: [med, ...current.medications],
        archive: current.archive.filter((item) => item.id !== id),
      };
    });
  }, []);

  const toggleTaken = useCallback((date, key) => {
    setState((current) => {
      const day = current.checked[date] || {};
      const isTaken = !day[key];
      const nextChecked = { ...current.checked, [date]: { ...day, [key]: isTaken } };
      const medId = key.slice(0, key.lastIndexOf("_"));
      const medications = current.medications.map((med) => {
        if (med.id !== medId || med.stock === "" || med.stock === null) return med;
        const nextStock = Math.max(0, Number(med.stock) + (isTaken ? -1 : 1));
        return { ...med, stock: nextStock, updatedAt: new Date().toISOString() };
      });
      return { ...current, checked: nextChecked, medications };
    });
  }, []);

  const updateStock = useCallback((id, stock) => {
    editMedication(id, { stock: stock === "" ? "" : Number(stock), initialStock: stock === "" ? "" : Number(stock) });
  }, [editMedication]);

  const updateExpiry = useCallback((id, expiryDate) => {
    editMedication(id, { expiryDate });
  }, [editMedication]);

  const todayItems = useMemo(() => getDayItems(state.medications, todayKey()), [state.medications]);

  return {
    ...state,
    todayItems,
    addMedication,
    editMedication,
    deleteMedication,
    restoreMedication,
    toggleTaken,
    updateStock,
    updateExpiry,
  };
}
