const DEVICE_KEY = 'vn_dashboard_report_notes_device_v1';
const CLOUD_PREFIX = 'vn_dashboard_report_notes_cloud_v1:';

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
