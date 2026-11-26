export async function recordAuditLog(client, { adminId, action, entityType, entityId = null, details = {}, req = null }) {
  const ipAddress = req
    ? req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || null
    : null;
  const userAgent = req ? req.headers['user-agent'] || null : null;

  const res = await client.query(
    `INSERT INTO admin_audit_logs (admin_id, action, entity_type, entity_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING id, admin_id, action, entity_type, entity_id, details, created_at`,
    [adminId, action, entityType, entityId ? String(entityId) : null, JSON.stringify(details), ipAddress, userAgent]
  );
  return res.rows[0];
}
