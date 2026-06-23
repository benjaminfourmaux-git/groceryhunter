// ============================================================================
//  Edge Function : go-shopping
//  Déclenchée quand un membre appuie sur « Je pars faire les courses ».
//  1) archive la liste courante dans l'historique
//  2) vide la liste
//  3) envoie une notification Web Push aux autres membres du foyer
//
//  Déploiement :  supabase functions deploy go-shopping
//  Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//  (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY sont fournis
//   automatiquement par Supabase.)
// ============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1) Identifier l'appelant à partir de son jeton.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()

    if (userErr || !user) {
      return json({ error: 'Non authentifié' }, 401)
    }

    // 2) Client admin (service role) pour les opérations privilégiées.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: member, error: mErr } = await admin
      .from('members')
      .select('id, household_id, display_name')
      .eq('id', user.id)
      .single()

    if (mErr || !member) {
      return json({ error: 'Membre introuvable' }, 400)
    }

    const householdId = member.household_id

    // Articles réellement achetés (cochés dans la fenêtre de confirmation).
    // Si la liste n'est pas fournie (anciens clients), on considère tout acheté.
    let boughtIds: string[] | null = null
    try {
      const body = await req.json()
      if (Array.isArray(body?.boughtIds)) boughtIds = body.boughtIds as string[]
    } catch {
      // Pas de corps JSON : on garde le comportement « tout a été acheté ».
    }

    // 3) Récupérer la liste courante.
    const { data: items, error: iErr } = await admin
      .from('items')
      .select('id, name, quantity')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })

    if (iErr) return json({ error: iErr.message }, 500)

    type Item = { id: string; name: string; quantity: string | null }
    const all = (items ?? []) as Item[]
    const wasBought = (it: Item) => (boughtIds === null ? true : boughtIds.includes(it.id))
    const bought = all.filter(wasBought)
    const kept = all.filter((it) => !wasBought(it))

    const itemNames = bought.map((it) => (it.quantity ? `${it.name} (${it.quantity})` : it.name))

    // 4) Historique : uniquement les articles achetés (rien si aucun).
    if (bought.length > 0) {
      const { error: tErr } = await admin.from('shopping_trips').insert({
        household_id: householdId,
        shopper_id: member.id,
        shopper_name: member.display_name,
        items: itemNames,
        item_count: itemNames.length,
      })
      if (tErr) return json({ error: tErr.message }, 500)

      // 5) Retirer de la liste les articles achetés.
      const { error: dErr } = await admin
        .from('items')
        .delete()
        .eq('household_id', householdId)
        .in('id', bought.map((it) => it.id))
      if (dErr) return json({ error: dErr.message }, 500)
    }

    // 5b) Les articles non achetés restent dans la liste (remis à « à acheter »),
    //     et ne figurent donc pas dans l'historique.
    if (kept.length > 0) {
      await admin
        .from('items')
        .update({ checked: false })
        .eq('household_id', householdId)
        .in('id', kept.map((it) => it.id))
    }

    // 6) Notifier les autres membres.
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:exemple@exemple.com'

    let notified = 0
    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

      // On récupère aussi la langue de chaque destinataire (jointure members).
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('id, subscription, members(lang)')
        .eq('household_id', householdId)
        .neq('member_id', member.id)

      const keptCount = kept.length
      const name = member.display_name

      // Texte de la notification dans la langue du destinataire.
      const buildPayload = (lang: string) => {
        const fr = {
          title: 'Courses faites',
          body:
            bought.length === 0
              ? `${name} est rentré·e des courses.`
              : keptCount > 0
                ? `${name} a fait les courses. ${keptCount} article${keptCount > 1 ? 's' : ''} reste${keptCount > 1 ? 'nt' : ''} à acheter.`
                : `${name} a fait les courses. La liste a été vidée.`,
        }
        const en = {
          title: 'Shopping done',
          body:
            bought.length === 0
              ? `${name} is back from shopping.`
              : keptCount > 0
                ? `${name} did the shopping. ${keptCount} item${keptCount > 1 ? 's' : ''} left to buy.`
                : `${name} did the shopping. The list has been cleared.`,
        }
        const m = lang === 'en' ? en : fr
        return JSON.stringify({ title: m.title, body: m.body, url: '/', tag: 'courses-trip' })
      }

      for (const s of subs ?? []) {
        const rel = (s as { members?: { lang?: string } | { lang?: string }[] }).members
        const lang = (Array.isArray(rel) ? rel[0]?.lang : rel?.lang) ?? 'fr'
        try {
          await webpush.sendNotification(s.subscription, buildPayload(lang))
          notified++
        } catch (e) {
          const status = (e as { statusCode?: number; status?: number })?.statusCode ??
            (e as { statusCode?: number; status?: number })?.status
          // Abonnement expiré/invalide : on le supprime.
          if (status === 404 || status === 410) {
            await admin.from('push_subscriptions').delete().eq('id', s.id)
          }
        }
      }
    }

    return json({ ok: true, archived: itemNames.length, kept: kept.length, notified })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
