// Guards the simplified navigation (docs/cleanup-2026-11-12.md):
// every hub tab opens a real route, every old route still has a home, and the sidebar stays short.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HUBS, MORE_HUBS, MORE_HUB, ALL_NAV, hubFor, activeKey } from "@/lib/nav";

const app = fs.readFileSync(path.resolve(__dirname, "../../src/App.jsx"), "utf8");
const ROUTES = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
const routeExists = (pathname) =>
  ROUTES.some((r) => {
    const re = new RegExp("^" + r.replace(/:[^/]+/g, "[^/]+") + "$");
    return re.test(pathname);
  });
const loc = (url) => {
  const [pathname, search = ""] = url.split("?");
  return { pathname, search: search ? "?" + search : "" };
};

describe("navigation", () => {
  it("keeps the sidebar short: three screens, everything else under More", () => {
    expect(HUBS.map((h) => h.id)).toEqual(["command", "clients", "claude"]);
    expect(MORE_HUBS.map((h) => h.id)).toEqual(["work", "marketing", "sales", "money", "agents"]);
    for (const h of [...HUBS, ...MORE_HUBS, MORE_HUB]) expect(h.tabs.length).toBeLessThanOrEqual(8);
  });

  it("every nav item opens a defined route", () => {
    for (const i of ALL_NAV) expect(routeExists(i.path.split("?")[0]), i.path).toBe(true);
    for (const h of [...HUBS, ...MORE_HUBS, MORE_HUB]) expect(routeExists(h.path.split("?")[0]), h.path).toBe(true);
  });

  it("nav keys are unique", () => {
    const keys = ALL_NAV.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every older page still has a hub home", () => {
    const expected = {
      "/": "command", "/launch": "command", "/launch?tab=approvals": "command", "/agents?ceo=1": "command", "/output-analytics": "command", "/classic": "command", "/brain": "command",
      "/crm": "clients", "/clients/abc": "clients", "/brands": "clients", "/brands/diald": "clients", "/flight-plan": "clients", "/requests": "clients", "/comms": "clients", "/settings?tab=portal": "clients", "/pipeline": "clients",
      "/claude": "claude", "/playbooks": "claude",
      "/tasks": "work", "/tasks/patterns": "work", "/tasks/sops": "work", "/projects": "work", "/projects/x": "work",
      "/packages/gravitycare": "work", "/packages/orbit-seo/abc": "work", "/orbit-seo/manage": "work", "/share-images": "work",
      "/performance": "marketing", "/content-plans": "marketing", "/backlinks": "marketing", "/reviews": "marketing", "/security": "marketing",
      "/social": "marketing", "/social/p1": "marketing", "/email": "marketing", "/ads": "marketing",
      "/calls": "sales", "/studios/smpl": "sales", "/calls/abc": "sales", "/prestige": "sales", "/upgrades": "sales", "/presentations/projects": "sales", "/presentations/deck/1": "sales",
      "/financial": "money", "/client-usage": "money", "/fuel-economics": "money", "/growth/hiring": "money",
      "/agents": "agents", "/intelligence": "agents", "/intelligence/topic": "agents", "/idea-vault": "agents", "/automations": "agents",
      "/more": "more", "/documents": "more", "/legal": "more", "/training": "more", "/signatures": "more", "/signatures/new": "more",
      "/qr": "more", "/qr/1": "more", "/tools/chrome-workspace": "more", "/more/usage": "more",
    };
    for (const [url, hub] of Object.entries(expected)) expect(hubFor(loc(url))?.hub.id, url).toBe(hub);
  });

  it("Settings and the approvals query resolve to the right place", () => {
    expect(hubFor(loc("/settings"))).toBe(null);
    expect(hubFor(loc("/settings?tab=team"))).toBe(null);
    expect(hubFor(loc("/launch?tab=approvals")).tab.label).toBe("Approvals");
    expect(hubFor(loc("/launch")).tab.label).toBe("Road to Dec 31");
    expect(hubFor(loc("/agents?ceo=1")).tab.label).toBe("Commander brief");
    expect(activeKey(loc("/settings"))).toBe("/settings");
  });

  it("old shortcut and hub URLs are routed", () => {
    for (const p of ["/tasks/inbox", "/todo", "/orbit-seo", "/packages", "/growth", "/studios/simple-social", "/today", "/clients", "/work", "/marketing", "/sales", "/money"]) {
      expect(routeExists(p), p).toBe(true);
    }
  });
});
