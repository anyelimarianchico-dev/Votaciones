export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}
