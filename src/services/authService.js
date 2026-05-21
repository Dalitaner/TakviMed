import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";

const deleteAccountCallable = httpsCallable(functions, "deleteAccount");

const usersKey = "takvimed:users";
const hashIterations = 120000;
const rateLimitBaseKey = "takvimed:auth-rate";

const weakPins = new Set([
  "000000",
  "000001",
  "111111",
  "112233",
  "121212",
  "123123",
  "123456",
  "654321",
]);

function readUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(usersKey) || "{}");
    let changed = false;
    Object.values(users).forEach((user) => {
      if (user?.password) {
        delete user.password;
        changed = true;
      }
    });
    if (changed) localStorage.setItem(usersKey, JSON.stringify(users));
    return users;
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(usersKey, JSON.stringify(users));
}

export async function requestEmailVerification() {
  if (!auth.currentUser) return { ok: false, error: "Oturum bulunamadı." };
  await sendEmailVerification(auth.currentUser);
  return { ok: true };
}

export async function requestPasswordReset({ email }) {
  await sendPasswordResetEmail(auth, email);
  return { ok: true };
}

export function sanitizePin(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export function validatePin(pin) {
  const value = String(pin || "");
  if (!/^\d{6}$/.test(value)) return { valid: false, message: "PIN tam olarak 6 rakamdan oluşmalı." };
  if (/^(\d)\1{5}$/.test(value)) return { valid: false, message: "Aynı rakamdan oluşan PIN kullanılamaz." };
  if (weakPins.has(value)) return { valid: false, message: "Bu PIN çok yaygın veya tahmin edilebilir." };
  if (isSequential(value, 1) || isSequential(value, -1)) return { valid: false, message: "Sıralı rakamlardan oluşan PIN kullanılamaz." };
  if (value.slice(0, 2).repeat(3) === value || value.slice(0, 3).repeat(2) === value) {
    return { valid: false, message: "Tekrarlı kalıplardan oluşan PIN kullanılamaz." };
  }
  return { valid: true, message: "" };
}

export async function registerLocalUser({ username, email, pin, code }) {
  const validation = validatePin(pin);
  if (!validation.valid) return { ok: false, error: validation.message };
  try {
    const pinCredential = await hashPin(pin);
    const credential = await createUserWithEmailAndPassword(auth, email, pin);
    const user = {
      uid: credential.user.uid,
      username,
      email,
      pinCredential,
      code,
      emailVerified: credential.user.emailVerified,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "users", credential.user.uid), {
      username,
      usernameKey: username.toLocaleLowerCase("tr-TR"),
      email,
      familyCode: code,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "familyCodes", code), {
      ownerUid: credential.user.uid,
      username,
      createdAt: serverTimestamp(),
    });
    await sendEmailVerification(credential.user);
    cacheUser(user);
    clearRateLimit(email.toLocaleLowerCase("tr-TR"));
    return { ok: true, user };
  } catch (error) {
    return { ok: false, error: firebaseAuthMessage(error) };
  }
}

function cacheUser(user) {
  const users = readUsers();
  users[user.email.toLocaleLowerCase("tr-TR")] = {
    ...user,
    emailVerified: Boolean(auth.currentUser?.emailVerified || user.emailVerified),
  };
  writeUsers(users);
}

function profileFromFirebase(firebaseUser, firestoreProfile, cachedUser = {}) {
  return {
    uid: firebaseUser.uid,
    username: firestoreProfile?.username || cachedUser.username || firebaseUser.email,
    email: firebaseUser.email,
    pinCredential: cachedUser.pinCredential,
    code: firestoreProfile?.familyCode || cachedUser.code,
    emailVerified: firebaseUser.emailVerified,
    createdAt: cachedUser.createdAt || new Date().toISOString(),
  };
}

export async function loginLocalUser({ username, pin }) {
  const email = username.trim().toLocaleLowerCase("tr-TR");
  const limit = getRateLimit(email);
  if (limit.cooldownUntil > Date.now()) {
    return { ok: false, error: formatCooldown(limit.cooldownUntil), cooldownUntil: limit.cooldownUntil };
  }
  try {
    const credential = await signInWithEmailAndPassword(auth, email, pin);
    const snap = await getDoc(doc(db, "users", credential.user.uid));
    const cached = readUsers()[email] || {};
    const pinCredential = await hashPin(pin);
    const user = profileFromFirebase(credential.user, snap.data(), { ...cached, pinCredential });
    cacheUser(user);
    clearRateLimit(email);
    return { ok: true, user };
  } catch (error) {
    const nextLimit = recordFailedAttempt(email);
    return { ok: false, error: `${firebaseAuthMessage(error)} ${nextLimit.cooldownUntil ? nextLimit.message : ""}`.trim(), cooldownUntil: nextLimit.cooldownUntil };
  }
}

export async function signOutUser() {
  await signOut(auth);
}

export async function deleteAccount() {
  if (!auth.currentUser) {
    return { ok: false, error: "Oturum bulunamadı. Lütfen yeniden giriş yapıp tekrar deneyin." };
  }
  try {
    await deleteAccountCallable();
    // Yereldeki kullanıcı önbelleğini temizle.
    const email = auth.currentUser?.email?.toLocaleLowerCase("tr-TR");
    if (email) {
      const users = readUsers();
      delete users[email];
      writeUsers(users);
      clearRateLimit(email);
    }
    await signOut(auth).catch(() => {});
    return { ok: true };
  } catch (error) {
    return { ok: false, error: deleteAccountMessage(error) };
  }
}

function deleteAccountMessage(error) {
  const code = error?.code || "";
  if (code === "functions/unauthenticated") {
    return "Hesabı silmek için yeniden giriş yapmanız gerekiyor.";
  }
  if (code === "functions/unavailable" || code.includes("network")) {
    return "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  }
  return error?.message || "Hesap silinemedi. Lütfen biraz sonra tekrar deneyin.";
}

export function verifyLocalEmail(username) {
  const users = readUsers();
  const key = username.toLocaleLowerCase("tr-TR");
  if (!users[key]) return null;
  users[key].emailVerified = true;
  writeUsers(users);
  return users[key];
}

export async function updateLocalUserPinCredential(username, pinCredential) {
  const users = readUsers();
  const email = auth.currentUser?.email?.toLocaleLowerCase("tr-TR") || username.toLocaleLowerCase("tr-TR");
  if (users[email]) {
    users[email].pinCredential = pinCredential;
    delete users[email].password;
    writeUsers(users);
  }
  if (auth.currentUser) {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { pinUpdatedAt: serverTimestamp() }).catch(() => {});
  }
  return users[email] || null;
}

export async function resetLocalPassword({ email }) {
  try {
    await requestPasswordReset({ email });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: firebaseAuthMessage(error) };
  }
}

export async function legacyLoginLocalUser({ username, pin }) {
  const key = username.toLocaleLowerCase("tr-TR");
  const limit = getRateLimit(key);
  if (limit.cooldownUntil > Date.now()) {
    return { ok: false, error: formatCooldown(limit.cooldownUntil), cooldownUntil: limit.cooldownUntil };
  }
  const user = readUsers()[key];
  if (!user || !(await verifyPin(pin, user.pinCredential))) {
    const nextLimit = recordFailedAttempt(key);
    return { ok: false, error: nextLimit.message, cooldownUntil: nextLimit.cooldownUntil };
  }
  clearRateLimit(key);
  return { ok: true, user };
}

export async function verifyPin(pin, pinCredential) {
  if (!pinCredential?.salt || !pinCredential?.hash) return false;
  const next = await hashPin(pin, pinCredential.salt);
  return timingSafeEqual(next.hash, pinCredential.hash);
}

export async function createPinCredential(pin) {
  const validation = validatePin(pin);
  if (!validation.valid) return { ok: false, error: validation.message };
  return { ok: true, pinCredential: await hashPin(pin) };
}

function isSequential(pin, direction) {
  return pin.split("").every((digit, index, digits) => {
    if (index === 0) return true;
    return Number(digit) - Number(digits[index - 1]) === direction;
  });
}

async function hashPin(pin, salt = randomSalt()) {
  const encodedPin = new TextEncoder().encode(pin);
  const key = await crypto.subtle.importKey("raw", encodedPin, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: hashIterations },
    key,
    256,
  );
  return {
    algorithm: "PBKDF2-SHA256",
    iterations: hashIterations,
    salt,
    hash: bytesToBase64(new Uint8Array(bits)),
  };
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export function getRateLimit(id) {
  try {
    return JSON.parse(localStorage.getItem(`${rateLimitBaseKey}:${id}`) || "{}");
  } catch {
    return {};
  }
}

export function recordFailedAttempt(id) {
  const current = getRateLimit(id);
  const attempts = Number(current.attempts || 0) + 1;
  let cooldownUntil = 0;
  if (attempts >= 10) cooldownUntil = Date.now() + 10 * 60 * 1000;
  else if (attempts >= 5) cooldownUntil = Date.now() + 60 * 1000;
  const next = { attempts, cooldownUntil };
  localStorage.setItem(`${rateLimitBaseKey}:${id}`, JSON.stringify(next));
  return {
    ...next,
    message: cooldownUntil ? formatCooldown(cooldownUntil) : `PIN hatalı. Kalan deneme: ${Math.max(0, 5 - attempts)}`,
  };
}

export function clearRateLimit(id) {
  localStorage.removeItem(`${rateLimitBaseKey}:${id}`);
}

function formatCooldown(cooldownUntil) {
  const seconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
  if (seconds >= 60) return `Çok fazla hatalı deneme. ${Math.ceil(seconds / 60)} dakika sonra tekrar deneyin.`;
  return `Çok fazla hatalı deneme. ${seconds} saniye sonra tekrar deneyin.`;
}

function firebaseAuthMessage(error) {
  const code = error?.code || "";
  if (code.includes("email-already-in-use")) return "Bu e-posta adresi zaten kayıtlı.";
  if (code.includes("invalid-email")) return "Geçerli bir e-posta adresi girin.";
  if (code.includes("weak-password")) return "PIN Firebase şifresi için çok zayıf görünüyor.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "E-posta veya PIN hatalı.";
  }
  if (code.includes("network-request-failed")) return "Firebase bağlantısı kurulamadı. İnternet bağlantısını kontrol edin.";
  return error?.message || "Firebase işlemi tamamlanamadı.";
}
