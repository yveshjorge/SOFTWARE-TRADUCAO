let token = "";
export function setToken(value: string) {
  token = value;
}
export class ApiError extends Error {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.fields = fields;
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  signal?: AbortSignal,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method,
      signal,
      headers: { "Content-Type": "application/json", "X-Lexica-Token": token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(
      "Sem conexão com a aplicação. Verifique o servidor e tente novamente.",
    );
  }
  const data = await r.json();
  if (!r.ok) throw new ApiError(data.error, data.fields);
  return data;
}
export async function download(path: string, name: string) {
  const r = await fetch("/api" + path);
  if (!r.ok) {
    const d = await r.json();
    throw new ApiError(d.error);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function upload<T>(
  body: unknown,
  onProgress: (v: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/import/preview");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("X-Lexica-Token", token);
    xhr.timeout = 60000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () =>
      reject(
        new ApiError(
          "Falha na conexão. O arquivo não foi importado. Tente novamente.",
        ),
      );
    xhr.ontimeout = () =>
      reject(
        new ApiError(
          "O processamento excedeu o tempo limite. Tente um arquivo menor.",
        ),
      );
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        xhr.status < 300 ? resolve(d) : reject(new ApiError(d.error, d.fields));
      } catch {
        reject(new ApiError("Resposta inválida do servidor."));
      }
    };
    xhr.send(JSON.stringify(body));
  });
}
