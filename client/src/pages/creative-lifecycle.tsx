/**
 * 第三層：流程管理引擎 — 素材生命週期中心
 * 規格見 shared/lifecycle-spec.ts。支援 /creative-lifecycle?creativeId= 深連結。
 */
import { useCreativeLifecycleWorkbench } from "./creative-lifecycle/useCreativeLifecycleWorkbench";
import { CreativeLifecyclePageView } from "./creative-lifecycle/CreativeLifecyclePageView";

export default function CreativeLifecyclePage() {
  const wb = useCreativeLifecycleWorkbench();
  return <CreativeLifecyclePageView wb={wb} />;
}
