import { mkdir, writeFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const BASE = process.env.E2E_URL || "http://127.0.0.1:43147";
const OUT = process.env.E2E_OUT || "/opt/cursor/artifacts";
await mkdir(OUT, { recursive: true });

function luminance(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return 0;
  const lin = (n) => {
    const s = Number(n) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

async function clickByText(page, needle) {
  await page.waitForFunction(
    (text) =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent.replace(/\s+/g, " ").includes(text) && !b.disabled,
      ),
    { timeout: 10_000 },
    needle,
  );
  await page.evaluate((text) => {
    const b = [...document.querySelectorAll("button")].find(
      (el) => el.textContent.replace(/\s+/g, " ").includes(text) && !el.disabled,
    );
    b.click();
  }, needle);
  await page.waitForNetworkIdle({ idleTime: 250, timeout: 8000 }).catch(() => {});
}

const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});
const report = { banner: null, keyboard: [], contrast: [], screenshots: [], flow: [] };
const page = await browser.newPage();
page.setDefaultTimeout(20_000);

async function shot(name, w, h, dpr = 1) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await new Promise((r) => setTimeout(r, 200));
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push({ name, w, h, file });
}

await page.goto(BASE, { waitUntil: "networkidle0" });
report.banner = await page.$eval(".banner", (el) => el.textContent.trim());
if (!report.banner.includes("Simulação determinística — sem chamadas a modelos")) {
  throw new Error(`banner inesperado: ${report.banner}`);
}

const samples = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { sel, color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize };
  };
  return [
    pick("body"),
    pick(".banner"),
    pick("h1"),
    pick(".lede"),
    pick(".tabs button[aria-selected='true']"),
  ].filter(Boolean);
});
report.contrast = samples.map((s) => {
  const ratio = contrastRatio(s.color, s.background);
  return {
    ...s,
    ratio: Number(ratio.toFixed(2)),
    aa_normal_4_5: ratio >= 4.5,
    aa_large_3: ratio >= 3,
  };
});

await shot("ui-desktop-idle-1280x800", 1280, 800);
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await clickByText(page, "Reset");
await page.focus("select[aria-label='Cenário de simulação']");
report.keyboard.push("focus: select de cenário");
await page.select("select[aria-label='Cenário de simulação']", "success");
await clickByText(page, "Iniciar");
await page.waitForFunction(() => document.body.innerText.includes("spec-approval"));
report.flow.push("Iniciar → spec-approval");
await shot("ui-desktop-spec-gate-1280x800", 1280, 800);

await page.keyboard.press("Tab");
report.keyboard.push("Tab após spec-approval");

for (let i = 0; i < 10; i += 1) {
  const status = await page.evaluate(
    () => (document.querySelector(".status-pill")?.textContent.trim() ?? "").toLowerCase(),
  );
  if (status === "completed") {
    report.flow.push(`completed após ${i} iterações de UI`);
    break;
  }
  const enabled = await page.evaluate(() =>
    [...document.querySelectorAll("button")].map((b) => ({
      text: b.textContent.replace(/\s+/g, " ").trim(),
      disabled: b.disabled,
    })),
  );
  const approve = enabled.find((b) => b.text.includes("Aprovar gate") && !b.disabled);
  const until = enabled.find((b) => b.text.includes("Até o gate") && !b.disabled);
  if (approve) {
    await clickByText(page, "Aprovar gate");
    report.flow.push("click Aprovar gate");
    continue;
  }
  if (until) {
    await clickByText(page, "Até o gate");
    report.flow.push("click Até o gate");
    continue;
  }
  await new Promise((r) => setTimeout(r, 300));
}

await shot("ui-desktop-completed-1280x800", 1280, 800);
const body = await page.evaluate(() => document.body.innerText);
const pill = await page.evaluate(
  () => (document.querySelector(".status-pill")?.textContent ?? "").trim().toLowerCase(),
);
report.flow.push({
  hasVerifyRunner: body.toLowerCase().includes("verify-runner"),
  hasExitCode: /exitcode/i.test(body),
  hasCompleted: pill === "completed",
  hasBanner: body.includes("Simulação determinística — sem chamadas a modelos"),
  hasPassed: /passed\s*=\s*true/i.test(body),
});

await page.keyboard.press("2");
await page.waitForFunction(() => document.body.innerText.includes("Arquitetura"));
report.keyboard.push("tecla 2 → Arquitetura");
await shot("ui-desktop-arquitetura-1280x800", 1280, 800);

await page.keyboard.press("1");
await page.waitForFunction(() => document.body.innerText.includes("Iniciar"));
await shot("ui-mobile-painel-390", 390, 844, 2);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
);
report.flow.push({ mobileHorizontalOverflow: overflow });

await page.keyboard.press("3");
await page.waitForFunction(() => document.body.innerText.includes("Como executar"));
report.keyboard.push("tecla 3 → Como executar (390px)");
await shot("ui-mobile-como-executar-390", 390, 844, 2);

await page.keyboard.press("4");
await page.waitForFunction(() => document.body.innerText.includes("Limites"));
report.keyboard.push("tecla 4 → Limites (390px)");
await shot("ui-mobile-limites-390", 390, 844, 2);

const skip = await page.$eval(".skip", (el) => ({
  text: el.textContent.trim(),
  href: el.getAttribute("href"),
}));
report.keyboard.push({ skipLink: skip });

const outline = await page.evaluate(() => {
  const btn = document.querySelector(".tabs button");
  btn.focus();
  const cs = getComputedStyle(btn);
  return { outline: cs.outline, outlineOffset: cs.outlineOffset };
});
report.keyboard.push({ focusVisible: outline });

await writeFile(`${OUT}/e2e-ui-report.json`, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
const completed =
  report.flow.some((item) => item && typeof item === "object" && item.hasCompleted) ||
  report.flow.some(
    (item) => typeof item === "string" && item.toLowerCase().includes("completed"),
  );
if (!completed) {
  console.error(JSON.stringify(report, null, 2));
  throw new Error("E2E não observou status completed na UI");
}
console.log(JSON.stringify(report, null, 2));
