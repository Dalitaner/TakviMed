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

export async function requestEmailVerification({ username, email }) {
  const token = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const verificationLink = `${window.location.origin}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await fetch("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, verificationLink }),
    });
  } catch {
    // Backend-ready call; local development stores the token below.
  }
  localStorage.setItem(`takvimed:verify:${token}`, JSON.stringify({ username, email, createdAt: Date.now() }));
  return { token, verificationLink };
}

export async function requestPasswordReset({ username, email }) {
  const token = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const resetLink = `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await fetch("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, resetLink }),
    });
  } catch {
    // Backend-ready call; local development stores the token below.
  }
  localStorage.setItem(`takvimed:reset:${token}`, JSON.stringify({ username, email, createdAt: Date.now() }));
  return { token, resetLink };
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
  const users = readUsers();
  const key = username.toLocaleLowerCase("tr-TR");
  const pinCredential = await hashPin(pin);
  users[key] = {
    username,
    email,
    pinCredential,
    code,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };
  writeUsers(users);
  clearRateLimit(key);
  return { ok: true, user: users[key] };
}

export async function loginLocalUser({ username, pin }) {
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

export function verifyLocalEmail(username) {
  const users = readUsers();
  const key = username.toLocaleLowerCase("tr-TR");
  if (!users[key]) return null;
  users[key].emailVerified = true;
  writeUsers(users);
  return users[key];
}

export function updateLocalUserPinCredential(username, pinCredential) {
  const users = readUsers();
  const key = username.toLocaleLowerCase("tr-TR");
  if (!users[key]) return null;
  users[key].pinCredential = pinCredential;
  delete users[key].password;
  writeUsers(users);
  return users[key];
}

export async function resetLocalPassword({ username, email, pin }) {
  const validation = validatePin(pin);
  if (!validation.valid) return { ok: false, error: validation.message };
  const users = readUsers();
  const key = username.toLocaleLowerCase("tr-TR");
  if (!users[key] || users[key].email !== email) return { ok: false, error: "Kullanıcı adı/e-posta eşleşmedi." };
  users[key].pinCredential = await hashPin(pin);
  writeUsers(users);
  clearRateLimit(key);
  return { ok: true, user: users[key] };
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
