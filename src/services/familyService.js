import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

export async function followFamilyByCode({ myUid, myName, code }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, error: "Geçerli bir yakın kodu girin." };
  if (!myUid) return { ok: false, error: "Bu işlem için oturum açmanız gerekir." };

  const codeSnap = await getDoc(doc(db, "familyCodes", normalized));
  if (!codeSnap.exists()) return { ok: false, error: "Kod bulunamadı." };

  const codeData = codeSnap.data();
  const theirUid = codeData.ownerUid;
  const theirName = codeData.username || "Yakın";
  if (!theirUid) return { ok: false, error: "Kod geçersiz." };
  if (theirUid === myUid) return { ok: false, error: "Kendinizi takip edemezsiniz." };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "users", theirUid, "followers", myUid), {
      followerUid: myUid,
      followerName: myName || "Yakın",
      addedAt: serverTimestamp(),
    });
    batch.set(doc(db, "users", myUid, "following", theirUid), {
      followedUid: theirUid,
      followedName: theirName,
      followedCode: normalized,
      addedAt: serverTimestamp(),
    });
    await batch.commit();
    return { ok: true, followedUid: theirUid, followedName: theirName };
  } catch (error) {
    console.error("[familyService.followFamilyByCode]", error);
    return { ok: false, error: error?.code === "permission-denied" ? "İzin reddedildi. Firestore kurallarını kontrol edin." : (error?.message || "Takip eklenemedi.") };
  }
}

export async function unfollowFamilyMember({ myUid, theirUid }) {
  if (!myUid || !theirUid) return;
  await deleteDoc(doc(db, "users", myUid, "following", theirUid)).catch(() => {});
  await deleteDoc(doc(db, "users", theirUid, "followers", myUid)).catch(() => {});
}

export async function removeFollower({ myUid, followerUid }) {
  if (!myUid || !followerUid) return;
  await deleteDoc(doc(db, "users", myUid, "followers", followerUid)).catch(() => {});
  await deleteDoc(doc(db, "users", followerUid, "following", myUid)).catch(() => {});
}

export function subscribeFollowing(myUid, onChange, onError) {
  if (!myUid) return () => {};
  return onSnapshot(
    collection(db, "users", myUid, "following"),
    (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      onChange(list);
    },
    (error) => {
      console.error("[familyService.subscribe]", error);
      if (onError) onError(error);
    },
  );
}

export function subscribeFollowers(myUid, onChange, onError) {
  if (!myUid) return () => {};
  return onSnapshot(
    collection(db, "users", myUid, "followers"),
    (snap) => {
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      onChange(list);
    },
    (error) => {
      console.error("[familyService.subscribe]", error);
      if (onError) onError(error);
    },
  );
}

export function subscribeMemberMedications(memberUid, onChange, onError) {
  if (!memberUid) return () => {};
  return onSnapshot(
    collection(db, "users", memberUid, "medications"),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onChange(list);
    },
    (error) => {
      console.error("[familyService.subscribe]", error);
      if (onError) onError(error);
    },
  );
}

export function subscribeMemberTakenLogs(memberUid, onChange, onError) {
  if (!memberUid) return () => {};
  return onSnapshot(
    collection(db, "users", memberUid, "takenLogs"),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (!data?.date || !data?.key) return;
        if (!map[data.date]) map[data.date] = {};
        map[data.date][data.key] = Boolean(data.taken);
      });
      onChange(map);
    },
    (error) => {
      console.error("[familyService.subscribe]", error);
      if (onError) onError(error);
    },
  );
}

export async function sendReminderToMember({ targetUid, fromUid, fromName, message }) {
  if (!targetUid || !fromUid) return { ok: false, error: "Eksik bilgi." };
  const reminderRef = doc(collection(db, "users", targetUid, "reminders"));
  await setDoc(reminderRef, {
    fromUid,
    fromName: fromName || "Yakın",
    message: message || "İlacınızı almayı unutmayın.",
    createdAt: serverTimestamp(),
    read: false,
  });
  return { ok: true };
}

export function subscribeReminders(myUid, onChange, onError) {
  if (!myUid) return () => {};
  return onSnapshot(
    collection(db, "users", myUid, "reminders"),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
      onChange(list);
    },
    (error) => {
      console.error("[familyService.subscribe]", error);
      if (onError) onError(error);
    },
  );
}

export async function dismissReminder({ myUid, reminderId }) {
  if (!myUid || !reminderId) return;
  await deleteDoc(doc(db, "users", myUid, "reminders", reminderId)).catch(() => {});
}
