/* Client-side Google Picker loader. Shows the native Drive folder picker. */

type PickedFolder = { id: string; name: string };

type TokenInfo = { token: string; apiKey: string | null; appId: string | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

let gapiScriptPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script load error")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => { script.setAttribute("data-loaded", "true"); resolve(); };
    script.onerror = () => reject(new Error("No se pudo cargar la librería de Google."));
    document.body.appendChild(script);
  });
}

async function ensurePickerLoaded(): Promise<void> {
  if (!gapiScriptPromise) gapiScriptPromise = loadScript("https://apis.google.com/js/api.js");
  await gapiScriptPromise;
  await new Promise<void>((resolve, reject) => {
    window.gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("No se pudo cargar Google Picker.")) });
  });
}

export async function pickDriveFolder(info: TokenInfo): Promise<PickedFolder | null> {
  await ensurePickerLoaded();
  const picker = window.google.picker;

  return new Promise<PickedFolder | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setMimeTypes("application/vnd.google-apps.folder");

    const builder = new picker.PickerBuilder()
      .setOAuthToken(info.token)
      .addView(view)
      .setTitle("Elegí una carpeta de Google Drive")
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      });

    if (info.apiKey) builder.setDeveloperKey(info.apiKey);
    if (info.appId) builder.setAppId(info.appId);

    builder.build().setVisible(true);
  });
}
