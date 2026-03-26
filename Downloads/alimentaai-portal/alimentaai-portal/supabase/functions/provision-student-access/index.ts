import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth) return null
  const [type, token] = auth.split(' ')
  if (!token || type?.toLowerCase() !== 'bearer') return null
  return token
}

function generateTemporaryPassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i += 1) out += chars[bytes[i] % chars.length]
  return `${out}Aa1!`
}

serve(async (req) => {
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
    }

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const anonKey = requireEnv('SUPABASE_ANON_KEY')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const token = bearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: authData, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Token invalido' }), { status: 401, headers })
    }
    const actorId = authData.user.id
    const actorEmail = String(authData.user.email ?? '').trim().toLowerCase()

    let { data: actorProfile } = await userClient
      .from('personais')
      .select('id, role, auth_user_id')
      .eq('auth_user_id', actorId)
      .maybeSingle()

    // Self-healing: if the personal already exists by email but is not linked yet,
    // attach auth_user_id automatically to avoid false 403 on first use.
    if (!actorProfile && actorEmail) {
      const { data: byEmail } = await admin
        .from('personais')
        .select('id, role, auth_user_id, email')
        .eq('email', actorEmail)
        .maybeSingle()
      if (byEmail) {
        if (!byEmail.auth_user_id) {
          await admin.from('personais').update({ auth_user_id: actorId }).eq('id', byEmail.id)
          byEmail.auth_user_id = actorId
        }
        actorProfile = byEmail
      }
    }

    if (!actorProfile || !['gestor', 'personal'].includes(String(actorProfile.role ?? ''))) {
      return new Response(
        JSON.stringify({
          error: 'Sem permissao para provisionar aluno',
          detail: 'Vincule seu usuario autenticado a public.personais.auth_user_id e role gestor/personal.',
        }),
        { status: 403, headers },
      )
    }

    const body = await req.json().catch(() => ({}))
    const usuarioId = String(body?.usuario_id ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const nome = String(body?.nome ?? '').trim()
    if (!usuarioId || !email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Dados invalidos' }), { status: 400, headers })
    }

    const { data: aluno, error: alunoErr } = await admin
      .from('usuarios')
      .select('id, email, auth_user_id')
      .eq('id', usuarioId)
      .maybeSingle()
    if (alunoErr || !aluno) {
      return new Response(JSON.stringify({ error: 'Aluno nao encontrado' }), { status: 404, headers })
    }
    if (aluno.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Aluno ja possui acesso provisionado' }), { status: 409, headers })
    }

    const temporaryPassword = generateTemporaryPassword()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: nome ? { display_name: nome } : undefined,
    })
    if (createErr || !created?.user?.id) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? 'Falha ao criar usuario de autenticacao' }),
        { status: 400, headers },
      )
    }

    const authUserId = created.user.id
    const { error: linkErr } = await admin
      .from('usuarios')
      .update({
        auth_user_id: authUserId,
        must_change_password: true,
        password_provisioned_at: new Date().toISOString(),
      })
      .eq('id', usuarioId)

    if (linkErr) {
      await admin.auth.admin.deleteUser(authUserId)
      return new Response(JSON.stringify({ error: `Falha ao vincular aluno: ${linkErr.message}` }), {
        status: 500,
        headers,
      })
    }

    console.log(
      JSON.stringify({
        event: 'student_access_provisioned',
        actor_auth_user_id: actorId,
        usuario_id: usuarioId,
        aluno_email: email,
      }),
    )

    return new Response(
      JSON.stringify({
        ok: true,
        usuario_id: usuarioId,
        auth_user_id: authUserId,
        senha_temporaria: temporaryPassword,
        must_change_password: true,
      }),
      { status: 200, headers },
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro inesperado' }), { status: 500, headers })
  }
})
