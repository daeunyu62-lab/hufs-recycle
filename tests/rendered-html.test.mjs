import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

async function render(pathname) {
  const moduleUrl = new URL(workerUrl);
  moduleUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(moduleUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the HUFS ECO MILE landing page", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /HUFS ECO MILE/);
  assert.match(html, /버리는 순간이/);
  assert.match(html, /check-in\?spotId=HUFS-GLOBAL-001(?:&amp;|&)geo=verified/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("serves check-in, QR, and my page routes", async () => {
  for (const pathname of [
    "/check-in?spotId=HUFS-GLOBAL-001&geo=verified&lat=37.337739&lng=127.268589&radius=100",
    "/beta-qr",
    "/mypage",
  ]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  }
});
