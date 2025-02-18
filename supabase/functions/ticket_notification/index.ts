// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createClient } from 'npm:@supabase/supabase-js@2'
import { JWT } from 'npm:google-auth-library@9'
import serviceAccount from '../service-account.json' with { type: 'json' }

// Supabaseの設定
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// FCMの設定
const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
const authClient = new JWT({
  email: serviceAccount.client_email,
  key: serviceAccount.private_key,
  scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
});

// POSTを受け取る
Deno.serve(async (req) => {
  try {
    // 今の時間を取得
    const now = new Date();
    
    // 30分後の時間を計算
    const futureTime = new Date(now.getTime() + 30 * 60 * 1000);

    // ±5分の範囲を計算
    const minTime = new Date(futureTime.getTime() - 5 * 60 * 1000);
    const maxTime = new Date(futureTime.getTime() + 5 * 60 * 1000);

    // 30分後(±5分)の範囲でイベントを取得
    const { data: events, error: eventError } = await supabase
      .from("events")
      .select("id, max_people_number")
      .gte("event_start_date", minTime.toISOString())
      .lte("event_start_date", maxTime.toISOString())
      .eq("is_lottery_processed", false);

    
    // イベントが見つからなかった時のエラーハンドリング
    if (eventError) throw eventError;
    if (!events || events.length === 0) {
      return new Response("No upcoming events", { status: 200 });
    }

    // イベントごとに当選者をきめる
    for (const event of events) {
      const eventId = event.id;
      const maxPeople = event.max_people_number;

      // イベントに申し込んだ人を取得
      const { data: applicants, error: applicantsError } = await supabase
        .from("lottery")
        .select("id, device_id, people_number, fcm_token")
        .eq("event_id", eventId)
        .eq("is_win", false);

      // 応募者がいなかった時のエラーハンドリング
      if (applicantsError) throw applicantsError;
      if (!applicants || applicants.length === 0) continue;

      // 当選者数をカウントする変数
      let totalSelected = 0;
      // 当選者の配列
      let winners: any[] = [];
      // 応募者を配列に入れる
      let remainingApplicants = [...applicants];

      // 応募者をランダムにシャッフル
      // ソートと言って順番をランダムに
      remainingApplicants.sort(() => Math.random() - 0.5);

      // 応募者から当選者を選ぶ
      for (const applicant of remainingApplicants) {
        if (totalSelected + applicant.people_number <= maxPeople) {
          winners.push(applicant);
          totalSelected += applicant.people_number;
        }
        // 応募者が最大人数を超えたら終了
        if (totalSelected >= maxPeople) break;
      }

      // 当選者がいたらテーブルを更新する
      if (winners.length > 0) {
        // map関数で当選者のidを取得
        const winnerIds = winners.map(w => w.id);

        // 当選者のis_winをtrueに更新する
        const { error: updateIsWinError } = await supabase
          .from("lottery")
          .update({ is_win: true })
          .in("id", winnerIds);

        // 更新が失敗した時のエラーハンドリング
        if (updateIsWinError) throw updateIsWinError;
      }

      // 全ての応募者に通知を送信
      for (const applicant of applicants) {
        // プッシュ通知送信
        await sendPushNotification(applicant.fcm_token, "当選結果", "アプリをご覧ください。");
      }

      // イベントのis_lottery_processedをtrueに更新する
      const {error: updateIsProcessedError } = await supabase
        .from("events")
        .update({ is_lottery_processed: true })
        .eq("id", event.id);

      // 更新が失敗した時のエラーハンドリング
      if (updateIsProcessedError) throw updateIsProcessedError;
    }
    // 抽選が成功
    return new Response("Lottery success", { status: 200 });

  } catch (error) {
    // エラーハンドリング
    console.error("Error:", error);
    return new Response("Lottery Error", { status: 500 });
  }
});

// 通知を送る関数
async function sendPushNotification(token: string, title: string, body: string) {
  const message = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body,
      },
    },
  };

  const client = await authClient.authorize();
  const response = await fetch(fcmUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${client.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error("FCM Error:", await response.text());
  }
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/ticket_notification' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
