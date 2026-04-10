import { useState } from "react";
import { Plus, Trash2, GripVertical, Edit2, Check, X } from "lucide-react";
import { Droppable, Draggable, DragDropContext } from "@hello-pangea/dnd";

const FIELD_TYPES = [
  { id: "short_text", label: "Short Text", icon: "📝" },
  { id: "long_text", label: "Long Text", icon: "📄" },
  { id: "email", label: "Email", icon: "✉️" },
  { id: "phone", label: "Phone", icon: "📱" },
  { id: "number", label: "Number", icon: "🔢" },
  { id: "date", label: "Date", icon: "📅" },
  { id: "address", label: "Address", icon: "📍" },
  { id: "website", label: "Website", icon: "🌐" },
  { id: "multiple_choice", label: "Multiple Choice", icon: "☑️" },
  { id: "dropdown", label: "Dropdown", icon: "▼" },
  { id: "yes_no", label: "Yes / No", icon: "✓✗" },
  { id: "picture_choice", label: "Picture Choice", icon: "🖼️" },
  { id: "rating", label: "Rating", icon: "⭐" },
  { id: "opinion_scale", label: "Opinion Scale", icon: "📊" },
  { id: "checkbox", label: "Legal Checkbox", icon: "☑️" },
  { id: "signature", label: "Signature", icon: "✍️" },
  { id: "file_upload", label: "File Upload", icon: "📎" },
];

export default function FormEditor({ fields, setFields, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showFieldMenu, setShowFieldMenu] = useState(false);

  const addField = (typeId) => {
    const type = FIELD_TYPES.find((t) => t.id === typeId);
    const newField = {
      id: Date.now().toString(),
      type: typeId,
      label: type.label,
      required: false,
      placeholder: "",
      options: typeId === "multiple_choice" || typeId === "dropdown" ? ["Option 1", "Option 2"] : [],
    };
    setFields([...fields, newField]);
    setShowFieldMenu(false);
  };

  const deleteField = (id) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const startEdit = (field) => {
    setEditingId(field.id);
    setEditForm({ ...field });
  };

  const saveEdit = () => {
    setFields(fields.map((f) => (f.id === editingId ? editForm : f)));
    setEditingId(null);
  };

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const newFields = Array.from(fields);
    const [movedField] = newFields.splice(source.index, 1);
    newFields.splice(destination.index, 0, movedField);
    setFields(newFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-sm">Form Fields</h3>
        <button
          onClick={() => setShowFieldMenu(!showFieldMenu)}
          className="flex items-center gap-1.5 text-orange-500/60 hover:text-orange-500 text-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Field
        </button>
      </div>

      {showFieldMenu && (
        <div className="grid grid-cols-3 gap-1.5 bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
          {FIELD_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => addField(type.id)}
              className="px-2 py-1.5 rounded-lg text-xs text-white/60 hover:bg-white/[0.08] hover:text-white transition-all border border-white/[0.06]"
            >
              <div className="text-lg mb-0.5">{type.icon}</div>
              <div className="text-[10px]">{type.label}</div>
            </button>
          ))}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="fields">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`space-y-2 ${snapshot.isDraggingOver ? "bg-white/[0.02] rounded-lg p-3" : ""}`}
            >
              {fields.length === 0 ? (
                <p className="text-white/25 text-xs py-4 text-center">No fields yet. Add one to get started.</p>
              ) : (
                fields.map((field, idx) => (
                  <Draggable key={field.id} draggableId={field.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white/[0.02] rounded-lg border border-white/[0.06] p-3 transition-all ${
                          snapshot.isDragging ? "bg-white/[0.08] border-orange-500/30" : ""
                        }`}
                      >
                        {editingId === field.id ? (
                          <FieldEditor field={editForm} setField={setEditForm} onSave={saveEdit} onCancel={() => setEditingId(null)} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div {...provided.dragHandleProps} className="text-white/20 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/70 text-xs font-medium">{field.label}</p>
                              <p className="text-white/30 text-[10px]">{FIELD_TYPES.find((t) => t.id === field.type)?.label}</p>
                            </div>
                            <button
                              onClick={() => startEdit(field)}
                              className="p-1.5 text-white/20 hover:text-white/50 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteField(field.id)}
                              className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

function FieldEditor({ field, setField, onSave, onCancel }) {
  return (
    <div className="space-y-2">
      <input
        autoFocus
        value={field.label}
        onChange={(e) => setField({ ...field, label: e.target.value })}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white outline-none"
        placeholder="Field label"
      />
      {["multiple_choice", "dropdown"].includes(field.type) && (
        <textarea
          value={field.options?.join("\n") || ""}
          onChange={(e) => setField({ ...field, options: e.target.value.split("\n").filter(Boolean) })}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white outline-none resize-none"
          placeholder="One option per line"
          rows="3"
        />
      )}
      <input
        value={field.placeholder || ""}
        onChange={(e) => setField({ ...field, placeholder: e.target.value })}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-white outline-none"
        placeholder="Placeholder text (optional)"
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => setField({ ...field, required: e.target.checked })}
          className="w-3 h-3"
        />
        <span className="text-white/50 text-xs">Required</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} className="flex-1 px-2 py-1.5 bg-green-500/10 text-green-400/70 hover:bg-green-500/20 rounded text-xs font-semibold flex items-center justify-center gap-1">
          <Check className="w-3 h-3" /> Save
        </button>
        <button onClick={onCancel} className="flex-1 px-2 py-1.5 bg-white/[0.04] text-white/30 hover:bg-white/[0.08] rounded text-xs flex items-center justify-center gap-1">
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  );
}