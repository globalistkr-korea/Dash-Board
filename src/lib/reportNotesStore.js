const DEVICE_KEY = 'vn_dashboard_report_notes_device_v1';
const CLOUD_PREFIX = 'vn_dashboard_report_notes_cloud_v1:';
export const DEFAULT_ALLOWED_REPORT_EMAILS = ['globalistkr@gmail.com'];

function safeId(value) {
  return encodeURIComponent(value).replace(/\./g, '%2E');
}

export function deviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const random = crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, random);
    return random;
  } catch {
    return 'local-device';
  }
}

export function isAllowedReportUser(user, allowedEmails = DEFAULT_ALLOWED_REPORT_EMAILS) {
  return Boolean(user?.email && allowedEmails.includes(user.email));
}

async function currentCloudUser() {
  const { auth } = await import('./firebase');
  return auth.currentUser;
}

async function cloudDocRef(noteKey) {
  const [{ doc }, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ]);
  const user = await currentCloudUser();
  if (!user?.uid) throw new Error('Cloud notes require Google sign-in.');
  return doc(db, 'reportBriefingNotes', user.uid, 'items', safeId(noteKey));
}

function parseNoteHistoryDoc(data, currentKey) {
  const notes = data?.notes || {};
  const confirmed = Object.values(notes).filter((note) => String(note || '').trim()).length;
  const [by, bm, cy, cm, region, clff, subtype] = String(data?.noteKey || '').split(':');
  return {
    noteKey: data?.noteKey || '',
    current: data?.noteKey === currentKey,
    confirmed,
    label: `${cy || '-'}년 ${cm || '-'}월 · ${region || '-'} · ${clff || '-'} · ${subtype || '-'}`,
    compare: `${by || '-'}년 ${bm || '-'}월 대비`,
    updatedAtLocal: data?.updatedAtLocal || '',
    source: 'cloud',
    notes,
  };
}

export async function loadAllowedReportEmails() {
  try {
    const [{ doc, getDoc }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('./firebase'),
    ]);
    const snap = await getDoc(doc(db, 'appConfig', 'reportNotes'));
    const emails = snap.data()?.allowedEmails;
    return Array.isArray(emails) && emails.length > 0
      ? emails.filter((email) => typeof email === 'string')
      : DEFAULT_ALLOWED_REPORT_EMAILS;
  } catch (error) {
    console.warn('Allowed report email config load failed; using default list.', error);
    return DEFAULT_ALLOWED_REPORT_EMAILS;
  }
}

export function loadCloudStatus(noteKey) {
  try {
    return localStorage.getItem(CLOUD_PREFIX + noteKey) || 'local';
  } catch {
    return 'local';
  }
}

function saveCloudStatus(noteKey, status) {
  try {
    localStorage.setItem(CLOUD_PREFIX + noteKey, status);
  } catch {
    // 상태 저장 실패는 앱 동작에 영향이 없으므로 무시한다.
  }
}

export async function loadReportNotesFromCloud(noteKey) {
  try {
    const [{ getDoc }, ref] = await Promise.all([
      import('firebase/firestore'),
      cloudDocRef(noteKey),
    ]);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      saveCloudStatus(noteKey, 'ready');
      return null;
    }
    saveCloudStatus(noteKey, 'synced');
    return snap.data()?.notes || null;
  } catch (error) {
    saveCloudStatus(noteKey, 'local');
    console.warn('Report notes cloud load failed; using local notes.', error);
    return null;
  }
}

export async function saveReportNotesToCloud(noteKey, notes) {
  try {
    const [{ serverTimestamp, setDoc }, ref] = await Promise.all([
      import('firebase/firestore'),
      cloudDocRef(noteKey),
    ]);
    await setDoc(ref, {
      notes,
      noteKey,
      lastDeviceId: deviceId(),
      ownerUid: (await currentCloudUser())?.uid || null,
      ownerEmail: (await currentCloudUser())?.email || null,
      updatedAt: serverTimestamp(),
      updatedAtLocal: new Date().toISOString(),
    }, { merge: true });
    saveCloudStatus(noteKey, 'synced');
    return true;
  } catch (error) {
    saveCloudStatus(noteKey, 'local');
    console.warn('Report notes cloud save failed; keeping local notes.', error);
    return false;
  }
}

export async function loadReportNotesHistoryFromCloud(currentKey) {
  try {
    const user = await currentCloudUser();
    if (!user?.uid) return [];
    const [{ collection, getDocs, limit, orderBy, query }, { db }] = await Promise.all([
      import('firebase/firestore'),
      import('./firebase'),
    ]);
    const historyQuery = query(
      collection(db, 'reportBriefingNotes', user.uid, 'items'),
      orderBy('updatedAtLocal', 'desc'),
      limit(20),
    );
    const snap = await getDocs(historyQuery);
    return snap.docs
      .map((docSnap) => parseNoteHistoryDoc(docSnap.data(), currentKey))
      .filter((item) => item.confirmed > 0);
  } catch (error) {
    console.warn('Report notes cloud history load failed; using local history.', error);
    return [];
  }
}
