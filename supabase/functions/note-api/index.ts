import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function safeEqual(a: string, b: string) {
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let diff = left.length ^ right.length;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

const allowedPatchFields = new Set([
  'title', 'content', 'is_pinned', 'is_archived', 'deleted_at',
]);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expectedKey = Deno.env.get('NOTE_ADMIN_KEY') || '';
  const suppliedKey = request.headers.get('x-admin-key') || '';
  if (!expectedKey) return json({ error: 'Máy chủ chưa cấu hình NOTE_ADMIN_KEY.' }, 500);
  if (!suppliedKey || !(await safeEqual(suppliedKey, expectedKey))) {
    return json({ error: 'Admin Key không hợp lệ.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  let serviceRoleKey = '';
  try {
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    serviceRoleKey = secretKeys.default || '';
  } catch { /* Dùng biến legacy bên dưới nếu project chưa có key dictionary. */ }
  serviceRoleKey = serviceRoleKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Máy chủ thiếu Secret API Key của Supabase.' }, 500);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400); }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const action = body.action;
  if (action === 'list') {
    const { data, error } = await db.from('notes').select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) return json({ error: error.message }, 400);
    return json({ notes: data || [] });
  }

  if (action === 'create') {
    const title = typeof body.title === 'string' ? body.title.slice(0, 500) : '';
    const content = typeof body.content === 'string' ? body.content.slice(0, 200000) : '';
    const { data, error } = await db.from('notes').insert({ title, content })
      .select('*').single();
    if (error) return json({ error: error.message }, 400);
    return json({ note: data });
  }

  if (action === 'update') {
    const id = typeof body.id === 'string' ? body.id : '';
    const rawPatch = body.patch && typeof body.patch === 'object' ? body.patch as Record<string, unknown> : {};
    if (!id) return json({ error: 'Thiếu mã ghi chú.' }, 400);
    const patch: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(rawPatch)) {
      if (!allowedPatchFields.has(field)) continue;
      if ((field === 'title' || field === 'content') && typeof value === 'string') {
        patch[field] = value.slice(0, field === 'title' ? 500 : 200000);
      } else if ((field === 'is_pinned' || field === 'is_archived') && typeof value === 'boolean') {
        patch[field] = value;
      } else if (field === 'deleted_at' && (value === null || typeof value === 'string')) {
        patch[field] = value;
      }
    }
    if (Object.keys(patch).length === 0) return json({ error: 'Không có nội dung hợp lệ để cập nhật.' }, 400);
    const { data, error } = await db.from('notes').update(patch).eq('id', id)
      .select('*').maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: 'Không tìm thấy ghi chú.' }, 404);
    return json({ note: data });
  }

  if (action === 'delete') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return json({ error: 'Thiếu mã ghi chú.' }, 400);
    const { data, error } = await db.from('notes').delete().eq('id', id).select('id');
    if (error) return json({ error: error.message }, 400);
    if (!data?.length) return json({ error: 'Không tìm thấy ghi chú.' }, 404);
    return json({ ok: true });
  }

  return json({ error: 'Thao tác không được hỗ trợ.' }, 400);
});
