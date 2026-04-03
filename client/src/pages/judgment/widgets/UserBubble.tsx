import type { ChatMessage } from "@shared/schema";

export function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 shadow-sm">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
