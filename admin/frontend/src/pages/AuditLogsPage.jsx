import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi('/api/admin/audit-logs?limit=100')
      .then((d) => setLogs(d.auditLogs))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <FileText className="h-6 w-6 text-rose-400" /> Administrator Audit Logs
        </h1>
        <p className="text-sm text-zinc-400">
          Immutable PostgreSQL record of sensitive administrator actions, entity IDs, and timestamps.
        </p>
      </div>

      {error && <div className="text-rose-400">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-800 bg-zinc-900/70 uppercase text-zinc-400">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Administrator</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-zinc-900/40">
                <td className="px-4 py-3 font-mono text-zinc-400">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-white">
                  {log.admin_email} <span className="block font-mono text-[10px] text-zinc-500">{log.admin_id}</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-rose-300">{log.action}</td>
                <td className="px-4 py-3 font-mono text-indigo-300">
                  {log.entity_type}
                  {log.entity_id ? ` · ${log.entity_id}` : ''}
                </td>
                <td className="px-4 py-3 font-mono text-zinc-400">{JSON.stringify(log.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
