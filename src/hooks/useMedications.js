import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "../services/firebase";
import {
  createMedication,
  deleteMedicationRecord,
  getDayItems,
  migrateLegacyData,
  persistAll,
  saveMedication,
  saveTakenLog,
  seedMedicationState,
  subscribeMedicationState,
  syncReminderWorker,
  todayKey,
  updateMedication,
} from "../services/medicationService";

export function useMedications(uid) {
  const [state, setState] = useState(() => migrateLegacyData());
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    persistAll(state);
    syncReminderWorker(state.medications, state.checked);
  }, [state]);

  useEffect(() => {
    setRemoteReady(false);
    if (!uid) return undefined;
    let cancelled = false;
    let unsubscribe = null;
    (async () => {
      if (typeof auth.authStateReady === "function") {
        try { await auth.authStateReady(); } catch { /* ignore */ }
      }
      if (cancelled || auth.currentUser?.uid !== uid) return;
      const localSnapshot = migrateLegacyData();
      seedMedicationState(uid, localSnapshot).catch((err) => console.error("[useMedications]", err));
      unsubscribe = subscribeMedicationState(
        uid,
        (remoteState) => {
          setRemoteReady(true);
          setState(remoteState);
        },
        (err) => console.error("[useMedications.subscribe]", err),
      );
    })();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [uid]);

  const persistMedication = useCallback((med) => {
    if (uid) saveMedication(uid, med).catch((err) => console.error("[useMedications]", err));
  }, [uid]);

  const addMedication = useCallback((payload) => {
    const med = createMedication(payload);
    setState((current) => ({ ...current, medications: [med, ...current.medications] }));
    persistMedication(med);
    return med;
  }, [persistMedication]);

  const editMedication = useCallback((id, patch) => {
    let nextMed = null;
    setState((current) => ({
      ...current,
      medications: current.medications.map((med) => {
        if (med.id !== id) return med;
        nextMed = updateMedication(med, patch);
        return nextMed;
      }),
    }));
    window.setTimeout(() => {
      if (nextMed) persistMedication(nextMed);
    }, 0);
  }, [persistMedication]);

  const deleteMedication = useCallback((id) => {
    let archivedMedication = null;
    setState((current) => {
      const deleted = current.medications.find((med) => med.id === id);
      archivedMedication = deleted ? { ...deleted, archivedAt: new Date().toISOString() } : null;
      return {
        ...current,
        medications: current.medications.filter((med) => med.id !== id),
        archive: archivedMedication ? [archivedMedication, ...current.archive] : current.archive,
      };
    });
    window.setTimeout(() => {
      if (uid && archivedMedication) saveMedication(uid, archivedMedication).catch((err) => console.error("[useMedications]", err));
    }, 0);
  }, [uid]);

  const archiveMedications = useCallback((ids) => {
    let archivedMeds = [];
    setState((current) => {
      const idSet = new Set(ids);
      const archived = current.medications.filter((med) => idSet.has(med.id)).map((med) => ({ ...med, archivedAt: new Date().toISOString() }));
      archivedMeds = archived;
      return {
        ...current,
        medications: current.medications.filter((med) => !idSet.has(med.id)),
        archive: [...archived, ...current.archive],
      };
    });
    window.setTimeout(() => {
      if (uid) archivedMeds.forEach((med) => saveMedication(uid, med).catch(() => {}));
    }, 0);
  }, [uid]);

  const removeMedications = useCallback((ids) => {
    setState((current) => {
      const idSet = new Set(ids);
      return {
        ...current,
        medications: current.medications.filter((med) => !idSet.has(med.id)),
      };
    });
    if (uid) ids.forEach((id) => deleteMedicationRecord(uid, id).catch(() => {}));
  }, [uid]);

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
    if (uid) {
      const archived = state.archive.find((med) => med.id === id);
      if (archived) {
        const { archivedAt, ...med } = archived;
        saveMedication(uid, med).catch((err) => console.error("[useMedications]", err));
      }
    }
  }, [state.archive, uid]);

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
      if (uid) {
        const updatedMed = medications.find((med) => med.id === medId);
        if (updatedMed) saveMedication(uid, updatedMed).catch((err) => console.error("[useMedications]", err));
        saveTakenLog(uid, { date, key, taken: isTaken }).catch((err) => console.error("[useMedications]", err));
      }
      return { ...current, checked: nextChecked, medications };
    });
  }, [uid]);

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
    archiveMedications,
    removeMedications,
    restoreMedication,
    toggleTaken,
    updateStock,
    updateExpiry,
    remoteReady,
  };
}
