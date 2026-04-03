/**
 * 投放草稿建立／編輯對話框：三步驟 wizard + footer
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "../publish-constants";
import type { PublishWorkbench } from "../usePublishWorkbench";
import { PublishWizardStep1 } from "./PublishWizardStep1";
import { PublishWizardStep2 } from "./PublishWizardStep2";
import { PublishWizardStep3 } from "./PublishWizardStep3";
import { PublishExecutionGateDialog } from "./PublishExecutionGateDialog";

export function PublishWizardDialog({ wb }: { wb: PublishWorkbench }) {
  const {
    formOpen,
    setFormOpen,
    wizardStep,
    setWizardStep,
    editingId,
    submitError,
    submitErrors,
    isSubmitting,
    preflight,
    selectedPageHasNoIg,
    handleSubmit,
    confirmPublishExecution,
    execGateOpen,
    onExecGateOpenChange,
    execGate,
    execConfirmError,
    execApplyMode,
    form,
    packages,
  } = wb;

  return (
    <>
    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "編輯投放草稿" : "建立投放草稿"}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 py-2 border-b text-sm">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.step} className="flex items-center gap-2">
              <span
                className={cn(
                  "font-medium",
                  wizardStep === s.step ? "text-primary" : "text-muted-foreground"
                )}
              >
                {s.step}. {s.label}
              </span>
              {i < WIZARD_STEPS.length - 1 && (
                <span className="text-muted-foreground">→</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {WIZARD_STEPS[wizardStep - 1]?.short}
        </p>

        <div className="grid gap-6 py-4">
          {submitError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {submitError}
              {submitErrors != null &&
                typeof submitErrors === "object" &&
                "fieldErrors" in (submitErrors as object) && (
                  <pre className="mt-2 text-xs overflow-auto max-h-24">
                    {JSON.stringify(
                      (submitErrors as { fieldErrors?: unknown }).fieldErrors,
                      null,
                      2
                    )}
                  </pre>
                )}
            </div>
          )}

          {wizardStep === 1 && <PublishWizardStep1 wb={wb} />}
          {wizardStep === 2 && <PublishWizardStep2 wb={wb} />}
          {wizardStep === 3 && <PublishWizardStep3 wb={wb} />}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setFormOpen(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          {wizardStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setWizardStep((s) => (s - 1) as 1 | 2 | 3)}
              disabled={isSubmitting}
            >
              上一步
            </Button>
          )}
          {wizardStep < 3 ? (
            <Button
              onClick={() => setWizardStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={
                wizardStep === 1 &&
                (!preflight.hasPage ||
                  !preflight.hasIgWhenRequired ||
                  selectedPageHasNoIg)
              }
            >
              下一步
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                packages.length === 0 ||
                !form.assetPackageId ||
                form.selectedVersionIds.length === 0 ||
                !preflight.canSubmit ||
                selectedPageHasNoIg
              }
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingId ? "儲存" : "建立"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <PublishExecutionGateDialog
      open={execGateOpen}
      onOpenChange={onExecGateOpenChange}
      gate={execGate}
      onConfirm={confirmPublishExecution}
      confirming={isSubmitting && execGateOpen}
      error={execConfirmError}
      gateMode={execApplyMode}
    />
    </>
  );
}
