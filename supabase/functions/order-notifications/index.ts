import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

    const { order_id } = await req.json();
    if (!order_id) return Response.json({ error: "order_id is required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(url, serviceKey);
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,order_number,user_id,customer_email,customer_name,customer_phone,delivery_method,customer_comment,total,items_count,created_at,order_items(plant_name,article_code,size_label,quantity,unit_price,line_total)")
      .eq("id", order_id).single();
    if (orderError || !order || order.user_id !== authData.user.id) {
      return Response.json({ error: "Order not found" }, { status: 404, headers: corsHeaders });
    }

    const lines = (order.order_items || []).map((item: any) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #e5e9e2">${esc(item.plant_name)}<br><small>${esc(item.size_label)} · Артикул: ${esc(item.article_code || "—")}</small></td><td style="padding:8px;text-align:center;border-bottom:1px solid #e5e9e2">${item.quantity}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #e5e9e2">${Number(item.line_total).toLocaleString("ru-RU")} ₽</td></tr>`
    ).join("");
    const delivery = order.delivery_method === "pickup" ? "Самовывоз" : "Доставка курьером (стоимость и время согласуем отдельно)";
    const details = [
      `Заказ №${order.order_number}`,
      `Клиент: ${order.customer_name || "не указано"}`,
      `Телефон: ${order.customer_phone}`,
      `Email: ${order.customer_email}`,
      `Получение: ${delivery}`,
      `Комментарий: ${order.customer_comment || "нет"}`,
      "",
      ...(order.order_items || []).map((i: any) => `• ${i.plant_name} / ${i.size_label}: ${i.quantity} × ${i.unit_price} ₽ = ${i.line_total} ₽`),
      "",
      `Итого: ${Number(order.total).toLocaleString("ru-RU")} ₽`,
    ].join("\n");

    const emailKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("ORDER_EMAIL_FROM");
    const adminEmail = Deno.env.get("ORDER_ADMIN_EMAIL");
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChat = Deno.env.get("TELEGRAM_CHAT_ID");
    const results: Record<string, string> = {};

    if (emailKey && from && order.customer_email) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#263a2b"><h1 style="color:#405c43">Спасибо за заказ в Kind of Green!</h1><p>Заказ №<b>${order.order_number}</b> принят. Я свяжусь с вами, чтобы подтвердить наличие и согласовать получение.</p><p><b>Способ получения:</b> ${esc(delivery)}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Растение</th><th>Кол-во</th><th align="right">Сумма</th></tr></thead><tbody>${lines}</tbody></table><h2 style="text-align:right">Итого: ${Number(order.total).toLocaleString("ru-RU")} ₽</h2><p>Телефон для связи: ${esc(order.customer_phone)}</p><p>Оплата на сайте не производится. Оплату и детали передачи согласуем отдельно.</p><p>Kind of Green</p></div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${emailKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [order.customer_email], subject: `Заказ №${order.order_number} — Kind of Green`, html }),
      });
      results.customer_email = res.ok ? "sent" : `failed: ${await res.text()}`;
      if (res.ok && adminEmail) {
        const adminRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${emailKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [adminEmail], subject: `Новый заказ №${order.order_number}`, text: details }),
        });
        results.admin_email = adminRes.ok ? "sent" : `failed: ${await adminRes.text()}`;
      }
    } else {
      results.customer_email = "not_configured";
    }

    if (telegramToken && telegramChat) {
      const tg = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChat, text: details }),
      });
      results.telegram = tg.ok ? "sent" : `failed: ${await tg.text()}`;
    } else {
      results.telegram = "not_configured";
    }

    const allConfiguredSent = [results.customer_email, results.telegram].every(v => v === "sent" || v === "not_configured")
      && results.customer_email !== "not_configured";
    if (allConfiguredSent) await admin.from("orders").update({ notification_sent_at: new Date().toISOString() }).eq("id", order.id);

    return Response.json({ ok: true, results }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500, headers: corsHeaders });
  }
});
