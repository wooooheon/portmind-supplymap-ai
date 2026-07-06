import { ApiKeySettingsForm } from "@/components/ApiKeySettingsForm";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { KEY_ENV_NAMES, listApiKeyStatuses } from "@/lib/api-key-vault/vault";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const statuses = await listApiKeyStatuses();

  return (
    <>
      <PageHeader
        title="API Keys"
        description="서버에서 쓰는 키는 클라이언트 번들에 노출하지 않습니다. Settings UI는 입력값의 masked reference만 DB에 저장하고, 실제 호출은 .env 값을 우선 사용합니다."
      />
      <div className="mb-5">
        <ApiKeySettingsForm envKeyNames={[...KEY_ENV_NAMES]} />
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Env Key</th>
              <th className="px-4 py-3">.env</th>
              <th className="px-4 py-3">Stored Mask</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {statuses.map((status) => (
              <tr key={status.envKeyName}>
                <td className="px-4 py-3 font-medium">{status.envKeyName}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={status.envPresent ? "present" : "missing"} />
                </td>
                <td className="px-4 py-3 text-muted">{status.storedMaskedValue ?? "none"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
