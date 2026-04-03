/**
 * 投放中心：草稿建立／編輯、批次建組、深連結 ?draftId=
 * （檔名避免 *-placeholder 誤解為未實作；UI 為 PublishPageView。）
 */
import { usePublishWorkbench } from "./publish/usePublishWorkbench";
import { PublishPageView } from "./publish/PublishPageView";

export default function PublishCenterPage() {
  const wb = usePublishWorkbench();
  return <PublishPageView wb={wb} />;
}
