const consoleOrigin = "https://console.firebase.google.com";

/** Firebase Console link for the signed-in project, e.g. `overview`. */
export const firebaseConsole = (project: string, path = "overview") =>
  `${consoleOrigin}/project/${encodeURIComponent(project)}/${path}`;
