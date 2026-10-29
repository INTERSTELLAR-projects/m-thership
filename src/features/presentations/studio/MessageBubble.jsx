import React from 'react';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={
          isUser
            ? 'max-w-[94%] rounded-none rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground'
            : 'max-w-[94%] rounded-none rounded-bl-md border border-border/80 bg-card/85 px-4 py-2.5 text-sm leading-relaxed'
        }
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
