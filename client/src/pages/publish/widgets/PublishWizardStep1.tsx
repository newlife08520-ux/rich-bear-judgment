import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Link } from "wouter";
import { ChevronDown } from "lucide-react";
import { OBJECTIVE_TO_PREFIX } from "../publish-constants";
import {
  audienceStrategies,
  audienceStrategyLabels,
  placementStrategies,
  placementStrategyLabels,
  type AudienceStrategy,
  type PlacementStrategy,
} from "@shared/schema";
import type { PublishWorkbench } from "../usePublishWorkbench";

export function PublishWizardStep1({ wb }: { wb: PublishWorkbench }) {
  const {
    form,
    setForm,
    accounts,
    accountPopoverOpen,
    setAccountPopoverOpen,
    pagePopoverOpen,
    setPagePopoverOpen,
    igPopoverOpen,
    setIgPopoverOpen,
    metaPages,
    metaIgAccounts,
    metaPagesByAccountFetched,
    metaPagesData,
    metaPagesNoFilter,
    igAccountsForSelectedPage,
    placementIncludesIg,
    selectedPageHasNoIg,
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    loadTemplate,
  } = wb;
  return (
<>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">投放設定</h3>
                  {templates.length > 0 && (
                    <Select value={selectedTemplateId || "_none"} onValueChange={(v) => v === "_none" ? setSelectedTemplateId(null) : loadTemplate(templates.find((t) => t.id === v)!)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="從範本載入" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— 不套用範本 —</SelectItem>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>廣告帳號 *</Label>
                    {accounts.length > 0 ? (
                      <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {form.accountId
                              ? (() => {
                                  const a = accounts.find((x) => x.accountId === form.accountId);
                                  return a ? `${a.accountName} (${a.accountId})` : form.accountId;
                                })()
                              : "請選擇廣告帳號"}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="搜尋帳號名稱或 ID..." />
                            <CommandList>
                              <CommandEmpty>找不到符合的帳號</CommandEmpty>
                              <CommandGroup>
                                {accounts.map((a) => (
                                  <CommandItem
                                    key={a.id}
                                    value={`${a.accountName} ${a.accountId}`}
                                    onSelect={() => {
                                      setForm((f) => ({ ...f, accountId: a.accountId, pageId: "", igAccountId: "" }));
                                      setAccountPopoverOpen(false);
                                    }}
                                  >
                                    {a.accountName} ({a.accountId})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-white border-l-4 border-l-amber-500 px-3 py-2 text-sm text-amber-900 dark:border-border dark:bg-card dark:text-amber-100">
                        請先至設定中心綁定 Meta 並點「立即同步帳號」，同步後此處會出現可選廣告帳號。
                        <Link href="/settings" className="ml-2 font-medium underline">前往設定</Link>
                      </div>
                    )}
                  </div>
                  {form.accountId && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Facebook 粉專 *</Label>
                          {metaPages.length > 0 ? (
                            <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                  {form.pageId ? (metaPages.find((p) => p.id === form.pageId)?.name ?? form.pageId) : "請選擇粉專"}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="搜尋粉專..." />
                                  <CommandList>
                                    <CommandEmpty>找不到粉專</CommandEmpty>
                                    <CommandGroup>
                                      {metaPages.map((p) => (
                                        <CommandItem
                                          key={p.id}
                                          value={`${p.name} ${p.id}`}
                                          onSelect={() => {
                                            const pageIgIds = metaIgAccounts.filter((ig) => ig.pageId === p.id).map((ig) => ig.id);
                                            setForm((f) => ({
                                              ...f,
                                              pageId: p.id,
                                              igAccountId: pageIgIds.includes(f.igAccountId) ? f.igAccountId : "",
                                            }));
                                            setPagePopoverOpen(false);
                                          }}
                                        >
                                          {p.name} ({p.id})
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                              {metaPagesByAccountFetched ? "此廣告帳號無可用粉專，請至 Meta 商業管理員綁定粉專" : "載入粉專列表中…"}
                            </div>
                          )}
                          {form.accountId && metaPagesByAccountFetched && metaPages.length === 0 && (
                            <p className="text-xs text-amber-600">
                              {metaPagesData?.message || "此廣告帳號無可用粉專，請至 Meta 商業管理員綁定粉專後重試，或確認 Token 具 pages_show_list / pages_manage_ads 權限。"}
                            </p>
                          )}
                          {metaPagesNoFilter && metaPages.length > 0 && (
                            <p className="text-xs text-amber-600">無法依廣告帳號過濾，顯示 Token 下全部粉專，請自行確認對應關係。</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Instagram 帳號 {placementIncludesIg ? "*" : "（選填，placement 含 IG 時必填）"}</Label>
                          {igAccountsForSelectedPage.length > 0 ? (
                            <Popover open={igPopoverOpen} onOpenChange={setIgPopoverOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                  {form.igAccountId ? (igAccountsForSelectedPage.find((i) => i.id === form.igAccountId)?.username ?? form.igAccountId) : placementIncludesIg ? "請選擇 IG" : "— 不選 —"}
                                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="搜尋 IG..." />
                                  <CommandList>
                                    <CommandEmpty>找不到 IG</CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem value="_clear" onSelect={() => { setForm((f) => ({ ...f, igAccountId: "" })); setIgPopoverOpen(false); }}>— 不選 —</CommandItem>
                                      {igAccountsForSelectedPage.map((ig) => (
                                        <CommandItem key={ig.id} value={`${ig.username} ${ig.id}`} onSelect={() => { setForm((f) => ({ ...f, igAccountId: ig.id })); setIgPopoverOpen(false); }}>@{ig.username} ({ig.id})</CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                              {form.pageId ? "此粉專未綁定 IG" : "請先選擇粉專"}
                            </div>
                          )}
                          {selectedPageHasNoIg && (
                            <p className="text-xs text-destructive">此粉專未綁定 IG，無法投放 Reels/Stories。請改選「僅動態牆」或先至 Meta 綁定 IG。</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                    <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Campaign 目標</Label>
                      <Select value={form.campaignObjective || "轉換"} onValueChange={(v) => setForm((f) => ({ ...f, campaignObjective: v, objectivePrefix: OBJECTIVE_TO_PREFIX[v] ?? f.objectivePrefix }))}>
                        <SelectTrigger><SelectValue placeholder="選擇目標" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="轉換">轉換</SelectItem>
                          <SelectItem value="觸及">觸及</SelectItem>
                          <SelectItem value="互動">互動</SelectItem>
                          <SelectItem value="品牌知名度">品牌知名度</SelectItem>
                          <SelectItem value="訊息">訊息</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Campaign 名稱 *</Label>
                      <Input value={form.campaignName} onChange={(e) => setForm((f) => ({ ...f, campaignName: e.target.value }))} placeholder="選素材組後自動帶入，或手動填" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ad Set 名稱 *</Label>
                      <Input value={form.adSetName} onChange={(e) => setForm((f) => ({ ...f, adSetName: e.target.value }))} placeholder="選素材組後自動帶入" />
                    </div>
                    <div className="space-y-2">
                      <Label>Ad 名稱 *</Label>
                      <Input value={form.adName} onChange={(e) => setForm((f) => ({ ...f, adName: e.target.value }))} placeholder="選素材組後自動帶入" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>每日預算（與總預算二選一）</Label>
                      <Select value={form.budgetDaily !== undefined && form.budgetDaily !== "" ? form.budgetDaily : "0"} onValueChange={(v) => setForm((f) => ({ ...f, budgetDaily: v, budgetTotal: v !== "0" ? "" : f.budgetTotal }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">不設（改用總預算）</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="300">300</SelectItem>
                          <SelectItem value="500">500</SelectItem>
                          <SelectItem value="1000">1000</SelectItem>
                          <SelectItem value="2000">2000</SelectItem>
                          <SelectItem value="5000">5000</SelectItem>
                          <SelectItem value="10000">10000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>總預算（與每日預算二選一）</Label>
                      <Select value={form.budgetTotal !== undefined && form.budgetTotal !== "" ? form.budgetTotal : "0"} onValueChange={(v) => setForm((f) => ({ ...f, budgetTotal: v, budgetDaily: v !== "0" ? "" : f.budgetDaily }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">不設（改用每日預算）</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="300">300</SelectItem>
                          <SelectItem value="500">500</SelectItem>
                          <SelectItem value="1000">1000</SelectItem>
                          <SelectItem value="2000">2000</SelectItem>
                          <SelectItem value="5000">5000</SelectItem>
                          <SelectItem value="10000">10000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>受眾策略</Label>
                      <Select value={form.audienceStrategy} onValueChange={(v) => setForm((f) => ({ ...f, audienceStrategy: v as AudienceStrategy }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {audienceStrategies.map((k) => (
                            <SelectItem key={k} value={k}>{audienceStrategyLabels[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Placement 策略</Label>
                      <Select value={form.placementStrategy} onValueChange={(v) => setForm((f) => ({ ...f, placementStrategy: v as PlacementStrategy }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {placementStrategies.map((k) => (
                            <SelectItem key={k} value={k}>{placementStrategyLabels[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>排程</Label>
                      <Select value={form.scheduleType} onValueChange={(v: "immediate" | "custom") => setForm((f) => ({ ...f, scheduleType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">立即開始</SelectItem>
                          <SelectItem value="custom">自訂開始／結束時間</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.scheduleType === "custom" && (
                      <>
                        <div className="space-y-2">
                          <Label>排程開始</Label>
                          <Input value={form.scheduleStart} onChange={(e) => setForm((f) => ({ ...f, scheduleStart: e.target.value }))} placeholder="ISO 或日期字串" />
                        </div>
                        <div className="space-y-2">
                          <Label>排程結束</Label>
                          <Input value={form.scheduleEnd} onChange={(e) => setForm((f) => ({ ...f, scheduleEnd: e.target.value }))} placeholder="ISO 或日期字串" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SOP 命名（矩陣建稿用） */}
            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">SOP 命名（矩陣建稿用）</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  公式：Campaign/Ad Set = [活動目標](原始)[MMDD]-[產品名]-[素材策略]+[文案簡稱]-[受眾代碼]。受眾代碼逗號分隔，有幾組就產生幾組 Ad Set。
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>活動目標前綴</Label>
                    <Input
                      value={form.objectivePrefix}
                      onChange={(e) => setForm((f) => ({ ...f, objectivePrefix: e.target.value }))}
                      placeholder="例：轉換次數(原始)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>產品名</Label>
                    <Input
                      value={form.productName}
                      onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                      placeholder="例：小淨靈（選素材包會自動帶入）"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>素材策略</Label>
                    <Input
                      value={form.materialStrategy}
                      onChange={(e) => setForm((f) => ({ ...f, materialStrategy: e.target.value }))}
                      placeholder="例：3影K、2圖1影"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>文案簡稱</Label>
                    <Input
                      value={form.headlineSnippet}
                      onChange={(e) => setForm((f) => ({ ...f, headlineSnippet: e.target.value }))}
                      placeholder="例：抓住文、痛點文"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>受眾代碼（逗號分隔 = 幾組 Ad Set）</Label>
                    <Input
                      value={form.audienceCodesComma}
                      onChange={(e) => setForm((f) => ({ ...f, audienceCodesComma: e.target.value }))}
                      placeholder="例：T, BUNA, 廣泛（3 個代碼 = 3 組廣告組合）"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
</>
  );
}
