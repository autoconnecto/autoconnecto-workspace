import { decode as atob, encode as btoa } from "base-64";

export function utf8ToBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

export function base64ToUtf8(value: string): string {
  return decodeURIComponent(escape(atob(value)));
}
