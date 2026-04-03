import { useJudgmentWorkbench } from "@/pages/judgment/useJudgmentWorkbench";
import {
  JudgmentHeader,
  JudgmentHistorySidebar,
  JudgmentDecisionCardsSection,
  JudgmentGoalPacingSection,
  JudgmentEmptyState,
  JudgmentEvidencePanel,
  JudgmentComposer,
  JudgmentWorkbenchBubble,
  UserBubble,
  JudgmentFocusStrip,
} from "@/pages/judgment/widgets";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { ExecutionGateDialog } from "@/components/ExecutionGateDialog";
import { ExternalMetaDriftBanner } from "@/components/sync/ExternalMetaDriftBanner";

export default function JudgmentPage() {
  const wb = useJudgmentWorkbench();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <JudgmentHeader
        historyOpen={wb.historyOpen}
        onToggleHistory={() => wb.setHistoryOpen((o) => !o)}
        rightPanelOpen={wb.rightPanelOpen}
        onToggleRightPanel={() => wb.setRightPanelOpen((o) => !o)}
        onExportFullReport={wb.handleExportFullReport}
        onNewChat={wb.handleNewChat}
        layoutMode={wb.layoutMode}
        onLayoutModeChange={wb.setLayoutMode}
      />

      <ExternalMetaDriftBanner surface="judgment" />

      <div className="flex flex-1 min-h-0">
        {wb.historyOpen && (
          <JudgmentHistorySidebar
            sessions={wb.sessionsList}
            loadingSessions={wb.loadingSessions}
            historySearch={wb.historySearch}
            onHistorySearchChange={wb.onHistorySearchChange}
            currentSessionId={wb.session?.id ?? null}
            onSelectSession={wb.handleSelectSession}
            uiMode={wb.uiMode}
            onModeChange={wb.handleModeChange}
            onQuickPrompt={wb.handleQuickPrompt}
            onTriggerFileSelect={() => wb.fileInputRef.current?.click()}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
          {wb.loadingSession && wb.sessionIdFromUrl ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 bg-gray-50">
                <div className="max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
                  {wb.layoutMode === "operator" && (
                    <div className="space-y-8" data-testid="judgment-operator-workbench-v8">
                      <div className="space-y-6" data-testid="judgment-operator-segment-cards">
                        <JudgmentDecisionCardsSection decisionCards={wb.decisionCards} />
                      </div>
                      <div
                        className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700"
                        data-testid="judgment-operator-segment-pacing"
                      >
                        <JudgmentGoalPacingSection goalPacingByProduct={wb.goalPacingByProduct} />
                      </div>
                    </div>
                  )}

                  {wb.layoutMode === "focus" && (
                    <JudgmentFocusStrip
                      decisionCards={wb.decisionCards}
                      goalPacingByProduct={wb.goalPacingByProduct}
                      onOpenOperatorBlocks={() => wb.setLayoutMode("operator")}
                    />
                  )}

                  {wb.messages.length === 0 && !wb.isSubmitting && (
                    <JudgmentEmptyState
                      workflow={wb.workflow}
                      setWorkflow={wb.setWorkflow}
                      selectedSubtype={wb.selectedSubtype}
                      setSelectedSubtype={wb.setSelectedSubtype}
                      setUiMode={wb.setUiMode}
                      onQuickPrompt={wb.handleQuickPrompt}
                      emptyVariant={wb.layoutMode === "focus" ? "focusMinimal" : "default"}
                    />
                  )}

                  {wb.messages.map((msg) =>
                    msg.role === "user" ? (
                      <UserBubble key={msg.id} message={msg} />
                    ) : (
                      <JudgmentWorkbenchBubble
                        key={msg.id}
                        message={msg}
                        judgmentContext={{
                          sessionId: wb.session?.id ?? null,
                          productName: wb.urlContext.productName,
                          creativeId: wb.urlContext.creativeId,
                          impactAmount: wb.urlContext.impactAmount,
                        }}
                        onCreateTask={wb.handleCreateTaskFromJudgment}
                        onExportReport={wb.handleExportSingleReport}
                        auditBlockId={`audit-${msg.id}`}
                      />
                    )
                  )}

                  {wb.isSubmitting && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white shadow-sm border border-gray-200 px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                        <span className="text-sm text-gray-700">總監審視中…</span>
                      </div>
                    </div>
                  )}

                  <div ref={wb.messagesEndRef} />
                </div>
              </ScrollArea>

              {wb.rightPanelOpen && (
                <JudgmentEvidencePanel
                  scopeAccountIds={wb.scope.selectedAccountIds ?? []}
                  attachments={wb.attachments}
                />
              )}

              <JudgmentComposer
                workflow={wb.workflow}
                setWorkflow={wb.setWorkflow}
                inputText={wb.inputText}
                setInputText={wb.setInputText}
                attachments={wb.attachments}
                removeAttachment={wb.removeAttachment}
                addFiles={wb.addFiles}
                canSubmit={wb.canSubmit}
                isSubmitting={wb.isSubmitting}
                submitError={wb.submitError}
                onSend={wb.handleSend}
                onKeyDown={wb.handleKeyDown}
                onQuickPrompt={wb.handleQuickPrompt}
                textareaRef={wb.textareaRef}
                fileInputRef={wb.fileInputRef}
                selectedSubtype={wb.selectedSubtype}
              />
            </>
          )}
        </main>
      </div>

      <ExecutionGateDialog
        open={wb.judgmentExecGateOpen}
        onOpenChange={wb.onJudgmentExecGateOpenChange}
        gate={wb.judgmentExecGate}
        onConfirm={async () => {
          await wb.confirmJudgmentTaskCreate();
        }}
        confirming={wb.judgmentExecGateConfirming}
        error={wb.judgmentExecConfirmError}
        intro="系統已記錄從審判官建立任務的 dry-run。勾選確認後將寫入 apply 稽核並建立任務。"
        checkboxLabel="我已閱讀預覽，確認要建立任務並接受稽核紀錄"
      />
    </div>
  );
}
