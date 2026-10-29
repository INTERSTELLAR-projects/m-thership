import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const getValue = (item, key, firstKey) => {
  if (typeof item === 'string') return key === firstKey ? item : '';
  return (item && item[key]) || '';
};

const setValue = (item, key, value) => {
  if (typeof item === 'string') return value;
  return { ...(item || {}), [key]: value };
};

export default function RowListEditor({ fields, items, onChange, max = 6, addLabel = 'Add item' }) {
  const list = Array.isArray(items) ? items : [];
  const firstKey = fields[0].key;

  return (
    <div className="space-y-2.5">
      {list.map((item, index) => (
        <div key={index} className="rounded-none border border-border/80 bg-secondary/40 p-2.5">
          <div className="space-y-2">
            {fields.map((field) =>
              field.type === 'textarea' ? (
                <Textarea
                  key={field.key}
                  value={getValue(item, field.key, firstKey)}
                  onChange={(event) => {
                    const next = list.map((entry, i) => (i === index ? setValue(entry, field.key, event.target.value) : entry));
                    onChange(next);
                  }}
                  placeholder={field.placeholder || field.label}
                  rows={2}
                  className="resize-none bg-card text-sm"
                />
              ) : (
                <Input
                  key={field.key}
                  value={getValue(item, field.key, firstKey)}
                  onChange={(event) => {
                    const next = list.map((entry, i) => (i === index ? setValue(entry, field.key, event.target.value) : entry));
                    onChange(next);
                  }}
                  placeholder={field.placeholder || field.label}
                  className="h-9 bg-card text-sm"
                />
              )
            )}
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-[11px] text-muted-foreground"
              onClick={() => onChange(list.filter((entry, i) => i !== index))}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ))}

      {list.length < max ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed text-xs"
          onClick={() => {
            const blank = fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {});
            onChange([...list, fields.length === 1 ? '' : blank]);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  );
}
