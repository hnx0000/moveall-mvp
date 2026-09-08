import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { validateCourse } from "./course-model.mjs";
import { defaultMapServices } from './map-services.mjs';

export function createCourseApi(directory, services = defaultMapServices()) {
  let queue = Promise.resolve();
  const file = new URL("courses.json", directory);
  const load = async () => {
    try {
      const saved = JSON.parse(await readFile(file, "utf8"));
      if (!Array.isArray(saved)) throw new Error("코스 저장 파일 형식을 확인해주세요.");
      return saved;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  };
  const modify = (mutator) => {
    const operation = queue.then(async () => {
      const saved = await load();
      const result = mutator(saved);
      await mkdir(directory, { recursive: true });
      const temporary = new URL(`courses-${randomUUID()}.tmp`, directory);
      await writeFile(temporary, JSON.stringify(saved));
      await rename(temporary, file);
      return result;
    });
    queue = operation.catch(() => {});
    return operation;
  };
  return async (request, response, url) => {
    if (!url.pathname.startsWith("/api/")) return false;
    const send = (status, value) => {
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(value));
    };
    try {
      // Local-only, same-origin mutations. Do not make the development data store public.
      const origin = request.headers.origin;
      if (origin && new URL(origin).host !== request.headers.host) {
        send(403, { error: "다른 사이트에서는 코스를 변경할 수 없습니다." });
        return true;
      }
      if(url.pathname === '/api/maps/capabilities' && request.method === 'GET') {
        send(200,services.capabilities()); return true;
      }
      if(['/api/maps/route','/api/maps/suggest','/api/maps/search'].includes(url.pathname) && request.method === 'POST') {
        const input=await readBody(request), controller=new AbortController();
        const abort=()=>controller.abort();
        response.on('close',abort);
        try {
          const method=url.pathname.split('/').at(-1);
          const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(method==='suggest'?150000:75000)]);
          const value=await services[method](method==='search'?input.query:input,signal);
          if(!response.destroyed)send(200,value);
        } finally {response.off('close',abort);}
        return true;
      }
      if (url.pathname === "/api/courses" && request.method === "GET") {
        await queue;
        send(200, { courses: await load() });
        return true;
      }
      if (url.pathname === "/api/courses" && request.method === "POST") {
        const course = validateCourse(await readBody(request));
        const result = await modify((saved) => {
          if (saved.length >= 100) throw new Error("최대 100개 코스까지 저장할 수 있습니다.");
          const item = {
            ...course,
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            schemaVersion: 1,
          };
          saved.unshift(item);
          return item;
        });
        send(201, result);
        return true;
      }
      if (/^\/api\/courses\/[a-f0-9-]{36}$/.test(url.pathname) && request.method === "DELETE") {
        const id = url.pathname.split("/").at(-1);
        await modify((saved) => {
          const i = saved.findIndex((item) => item.id === id);
          if (i !== -1) saved.splice(i, 1);
        });
        send(200, { deleted: true });
        return true;
      }
      send(404, { error: "요청을 찾을 수 없습니다." });
    } catch (error) {
      send(error.name === "TimeoutError" ? 504 : 400, {
        error:
          error.name === "TimeoutError"
            ? "경로 계산이 지연되었습니다. 핀을 유지했으니 다시 시도해주세요."
            : error.message || "코스를 처리하지 못했습니다.",
      });
    }
    return true;
  };
}

async function readBody(request) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 3000000) throw new Error("코스 데이터가 너무 큽니다.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("코스 데이터를 읽을 수 없습니다.");
  }
}
