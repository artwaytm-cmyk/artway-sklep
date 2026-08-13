import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policyPath = new URL("../ops/ssh/00-artway-access.conf", import.meta.url);
const cloudInitPath = new URL("../ops/ssh/99-artway-security.cfg", import.meta.url);
const installerPath = new URL("../ops/ssh/install.sh", import.meta.url);

function directives(source) {
  return new Map(
    source
      .split(/\r?\n/u)
      .map((line) => line.replace(/\s+#.*$/u, "").trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [key, ...value] = line.split(/\s+/u);
        return [key.toLowerCase(), value.join(" ").toLowerCase()];
      }),
  );
}

test("kanoniczna polityka SSH wyłącza root, hasła i interaktywną autoryzację", async () => {
  const policy = directives(await readFile(policyPath, "utf8"));

  assert.equal(policy.get("permitrootlogin"), "no");
  assert.equal(policy.get("passwordauthentication"), "no");
  assert.equal(policy.get("kbdinteractiveauthentication"), "no");
  assert.equal(policy.get("permitemptypasswords"), "no");
  assert.equal(policy.get("pubkeyauthentication"), "yes");
  assert.equal(policy.get("authenticationmethods"), "publickey");
  assert.equal(policy.get("allowusers"), "artway");
});

test("polityka zachowuje lokalne tunele, ale wyłącza niepotrzebne przekierowania", async () => {
  const policy = directives(await readFile(policyPath, "utf8"));

  assert.equal(policy.get("allowtcpforwarding"), "local");
  assert.equal(policy.get("gatewayports"), "no");
  assert.equal(policy.get("allowagentforwarding"), "no");
  assert.equal(policy.get("x11forwarding"), "no");
});

test("cloud-init nie może ponownie włączyć hasła SSH", async () => {
  const cloudInit = await readFile(cloudInitPath, "utf8");
  assert.match(cloudInit, /^ssh_pwauth:\s*false$/mu);
  assert.match(cloudInit, /^disable_root:\s*true$/mu);
});

test("instalator sprawdza konfigurację przed reloadem i ponownie po nim", async () => {
  const installer = await readFile(installerPath, "utf8");
  const syntaxCheck = installer.indexOf("/usr/sbin/sshd -t");
  const preflight = installer.indexOf('verify.sh\" --before-reload');
  const reload = installer.indexOf("systemctl reload ssh.service");
  const liveCheck = installer.lastIndexOf('verify.sh\"');

  assert.ok(syntaxCheck >= 0);
  assert.ok(preflight > syntaxCheck);
  assert.ok(reload > preflight);
  assert.ok(liveCheck > reload);
});
