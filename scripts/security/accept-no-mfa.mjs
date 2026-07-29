import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("../..", import.meta.url).pathname);
const documentPath = resolve(root, "docs/audit-remediation/NO_MFA_SECURITY_ACCEPTANCE.md");
const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? String(args[index + 1] || "").trim() : "";
};
const approvedBy = value("--approved-by");
const role = value("--role");
const reviewDate = value("--review-date");
const incidentOwner = value("--incident-owner");
const confirmation = value("--confirm");
const requiredConfirmation = "Tôi hiểu và chấp nhận rủi ro còn lại khi tài khoản HR vận hành không có MFA/2FA. Tôi xác nhận đây là quyết định có chủ đích của chủ dự án, đồng thời chấp nhận áp dụng các biện pháp bù trừ gồm mật khẩu mạnh, refresh-token rotation, session revocation, rate limiting, audit logging, giám sát sự cố và quy trình khóa tài khoản.";
if (!approvedBy || !role || !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate) || !incidentOwner || confirmation !== requiredConfirmation) {
  console.error(`NO_MFA_ACCEPTANCE_REFUSED: provide --approved-by, --role, --review-date YYYY-MM-DD, --incident-owner and --confirm "${requiredConfirmation}"`);
  process.exit(2);
}
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout.trim();
const gitName = git(["config", "user.name"]) || "<not configured>";
const gitEmail = git(["config", "user.email"]) || "<not configured>";
const head = git(["rev-parse", "HEAD"]);
const now = new Date();
const localParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
}).formatToParts(now).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
const approvalDate = `${localParts.year}-${localParts.month}-${localParts.day}`;
const timestamp = `${approvalDate}T${localParts.hour}:${localParts.minute}:${localParts.second}+07:00`;
let source = readFileSync(documentPath, "utf8");
source = source.replace(/Status: \*\*(Pending|Rejected|Accepted)\*\*/, "Status: **Accepted**");
source = source.replace(/- Incident response owner: .*/, `- Incident response owner: ${incidentOwner}`);
source = source.replace(/- Review date: .*/, `- Review date: ${reviewDate}`);
source = source.replace(/- Approver: .*/, `- Approver: ${approvedBy} (${role})`);
source = source.replace(/- Approval record\/reference: .*/, `- Approval record/reference: owner signoff ${timestamp}`);
source = source.replace(/- Approval date: .*/, `- Approval date: ${approvalDate}`);
if (!source.includes("- Approval date:")) source = source.replace("- Review date: Pending assignment", `- Approval date: ${approvalDate}\n- Review date: Pending assignment`);
source = source.replace(/\n## Recorded owner acceptance[\s\S]*$/, "");
source += `\n## Recorded owner acceptance\n\n- Approved at: ${timestamp}\n- Approval date (Asia/Ho_Chi_Minh): ${approvalDate}\n- Approved by: ${approvedBy}\n- Authority role: ${role}\n- Incident response owner: ${incidentOwner}\n- Review date: ${reviewDate}\n- Command executor Git identity: name=${gitName}; email=${gitEmail}\n- Commit SHA: ${head}\n- Confirmation: ${requiredConfirmation}\n`;
writeFileSync(documentPath, source);
console.log("NO_MFA_OWNER_ACCEPTANCE_RECORDED");
