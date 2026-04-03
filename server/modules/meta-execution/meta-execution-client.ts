/**
 * Meta Graph API 執行：pause / resume / update_budget（需 EXECUTION_ALLOW_META_WRITES）
 */
export type MetaRollbackSnapshot = {
  targetId: string;
  previousStatus?: string;
  previousBudget?: number;
  requestedNext?: string | number;
  actionTimestamp: string;
  apiResultId?: string;
  apiMessage?: string;
};

export async function pauseCampaign(
  accessToken: string,
  campaignId: string
): Promise<{ success: boolean; message?: string; rollbackSnapshot?: MetaRollbackSnapshot }> {
  const id = campaignId.startsWith("act_") ? campaignId : campaignId;
  const url = `https://graph.facebook.com/v19.0/${id}?access_token=${encodeURIComponent(accessToken)}`;
  const getRes = await fetch(url);
  const getData = (await getRes.json()) as { status?: string; error?: { message?: string } };
  if (getData.error) {
    return { success: false, message: getData.error.message ?? "取得 campaign 失敗" };
  }
  const previousStatus = getData.status;

  const updateUrl = `https://graph.facebook.com/v19.0/${id}`;
  const updateRes = await fetch(updateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken, status: "PAUSED" }).toString(),
  });
  const updateData = (await updateRes.json()) as { success?: boolean; error?: { message?: string } };
  if (updateData.error) {
    return {
      success: false,
      message: updateData.error.message ?? "pause 失敗",
      rollbackSnapshot: {
        targetId: campaignId,
        previousStatus,
        requestedNext: "PAUSED",
        actionTimestamp: new Date().toISOString(),
        apiMessage: updateData.error.message,
      },
    };
  }
  return {
    success: true,
    message: "已暫停",
    rollbackSnapshot: {
      targetId: campaignId,
      previousStatus,
      requestedNext: "PAUSED",
      actionTimestamp: new Date().toISOString(),
    },
  };
}

export async function resumeCampaign(
  accessToken: string,
  campaignId: string
): Promise<{ success: boolean; message?: string; rollbackSnapshot?: MetaRollbackSnapshot }> {
  const id = campaignId.startsWith("act_") ? campaignId : campaignId;
  const url = `https://graph.facebook.com/v19.0/${id}?access_token=${encodeURIComponent(accessToken)}`;
  const getRes = await fetch(url);
  const getData = (await getRes.json()) as { status?: string; error?: { message?: string } };
  if (getData.error) {
    return { success: false, message: getData.error.message ?? "取得 campaign 失敗" };
  }
  const previousStatus = getData.status;

  const updateUrl = `https://graph.facebook.com/v19.0/${id}`;
  const updateRes = await fetch(updateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: accessToken, status: "ACTIVE" }).toString(),
  });
  const updateData = (await updateRes.json()) as { success?: boolean; error?: { message?: string } };
  if (updateData.error) {
    return {
      success: false,
      message: updateData.error.message ?? "resume 失敗",
      rollbackSnapshot: {
        targetId: campaignId,
        previousStatus,
        requestedNext: "ACTIVE",
        actionTimestamp: new Date().toISOString(),
        apiMessage: updateData.error.message,
      },
    };
  }
  return {
    success: true,
    message: "已啟動",
    rollbackSnapshot: {
      targetId: campaignId,
      previousStatus,
      requestedNext: "ACTIVE",
      actionTimestamp: new Date().toISOString(),
    },
  };
}

export async function updateCampaignBudget(
  accessToken: string,
  campaignId: string,
  budgetDaily?: number,
  budgetTotal?: number
): Promise<{ success: boolean; message?: string; rollbackSnapshot?: MetaRollbackSnapshot }> {
  const id = campaignId.startsWith("act_") ? campaignId : campaignId;
  const getUrl = `https://graph.facebook.com/v19.0/${id}?fields=daily_budget,lifetime_budget&access_token=${encodeURIComponent(accessToken)}`;
  const getRes = await fetch(getUrl);
  const getData = (await getRes.json()) as {
    daily_budget?: string;
    lifetime_budget?: string;
    error?: { message?: string };
  };
  if (getData.error) {
    return { success: false, message: getData.error.message ?? "取得 campaign 失敗" };
  }
  const prevDaily = getData.daily_budget != null ? parseInt(getData.daily_budget, 10) : undefined;
  const prevTotal = getData.lifetime_budget != null ? parseInt(getData.lifetime_budget, 10) : undefined;

  const params: Record<string, string> = { access_token: accessToken };
  if (budgetDaily != null && Number.isFinite(budgetDaily)) {
    params.daily_budget = String(Math.round(budgetDaily * 100) / 100);
  }
  if (budgetTotal != null && Number.isFinite(budgetTotal)) {
    params.lifetime_budget = String(Math.round(budgetTotal * 100) / 100);
  }
  if (Object.keys(params).length <= 1) {
    return { success: false, message: "請填寫 budgetDaily 或 budgetTotal" };
  }

  const updateUrl = `https://graph.facebook.com/v19.0/${id}`;
  const updateRes = await fetch(updateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const updateData = (await updateRes.json()) as { success?: boolean; error?: { message?: string } };
  const requestedNext = budgetDaily != null ? budgetDaily : budgetTotal;
  if (updateData.error) {
    return {
      success: false,
      message: updateData.error.message ?? "更新預算失敗",
      rollbackSnapshot: {
        targetId: campaignId,
        previousBudget: prevDaily ?? prevTotal,
        requestedNext: requestedNext ?? 0,
        actionTimestamp: new Date().toISOString(),
        apiMessage: updateData.error.message,
      },
    };
  }
  return {
    success: true,
    message: "已更新預算",
    rollbackSnapshot: {
      targetId: campaignId,
      previousBudget: prevDaily ?? prevTotal,
      requestedNext: requestedNext ?? 0,
      actionTimestamp: new Date().toISOString(),
    },
  };
}
