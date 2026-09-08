const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
export const embedded = params.get('embedded') === '1';
const channel = params.get('channel');
let state = {}, receiver = () => {};
const pending = new Map();
export const appState = () => state;
export function sendApp(type, payload = {}) {
  if (!embedded || !channel) return;
  const message = { source:'groov-map', channel, type, payload };
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  else window.parent.postMessage(message, location.origin);
}
function receive(message) {
  if (!embedded || message?.source !== 'groov-app' || message.channel !== channel) return;
  if (message.type === 'state') { state = message.payload || {}; receiver(state); }
  if (message.type === 'reply') {
    const operation = pending.get(message.payload?.id);
    if (!operation) return;
    pending.delete(message.payload.id); clearTimeout(operation.timer);
    if (message.payload.error) operation.reject(new Error(message.payload.error));
    else operation.resolve(message.payload.value);
  }
}
globalThis.window?.addEventListener('message', event => {
  if (event.source === window.parent && event.origin === location.origin) receive(event.data);
});
// Native host injects only serialized protocol messages, never executable payloads.
if (globalThis.window) window.groovReceive = receive;
export function connectApp(callback) { receiver = callback; callback(state); sendApp('ready'); }
export function requestApp(type, payload = {}) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('앱 연결이 지연됐습니다. 지도를 닫고 다시 열어주세요.')); }, 15000);
    pending.set(id, {resolve,reject,timer}); sendApp(type, {...payload,id});
  });
}
if (embedded) {
  document.documentElement.dataset.embedded = params.get('kind') || 'course';
  document.documentElement.dataset.compact = params.get('compact') === '1' ? 'true' : 'false';
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = 'app-host.css'; document.head.append(style);
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a');
    if (!link || link.origin !== location.origin) return;
    event.preventDefault();
    sendApp('navigate', {kind:link.pathname.endsWith('detail.html')?'course':'ranking'});
  });
}
