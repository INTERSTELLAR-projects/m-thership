import { X, Upload } from "lucide-react";
import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";

export default function FormPreview({ form, onClose, clientId }) {
  const [uploadingField, setUploadingField] = useState(null);
  const fileInputRef = useRef({});
  const FIELD_TYPE_LABELS = {
    short_text: "Short Text",
    long_text: "Long Text",
    email: "Email",
    phone: "Phone",
    number: "Number",
    date: "Date",
    address: "Address",
    website: "Website",
    multiple_choice: "Multiple Choice",
    dropdown: "Dropdown",
    yes_no: "Yes / No",
    picture_choice: "Picture Choice",
    rating: "Rating",
    opinion_scale: "Opinion Scale",
    checkbox: "Legal Checkbox",
    signature: "Signature",
    file_upload: "File Upload",
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
      <div className="bg-card border border-ink/[0.13] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-ink/[0.13] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-ink font-bold text-sm">{form.title}</h3>
            {form.subtitle && <p className="text-ink/[0.58] text-xs mt-1">{form.subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-ink/[0.48] hover:text-ink/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {form.fields && form.fields.length > 0 ? (
            form.fields.map((field, idx) => (
              <div key={field.id} className="space-y-2">
                <label className="text-ink/80 text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-600 ml-1">*</span>}
                </label>

                {field.type === "short_text" && (
                  <input
                    type="text"
                    placeholder={field.placeholder || "Enter text..."}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "long_text" && (
                  <textarea
                    placeholder={field.placeholder || "Enter your response..."}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none resize-none min-h-[100px] disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "email" && (
                  <input
                    type="email"
                    placeholder={field.placeholder || "your@email.com"}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "phone" && (
                  <input
                    type="tel"
                    placeholder={field.placeholder || "(123) 456-7890"}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "number" && (
                  <input
                    type="number"
                    placeholder={field.placeholder || "0"}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "date" && (
                  <input
                    type="date"
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "address" && (
                  <input
                    type="text"
                    placeholder={field.placeholder || "123 Main St, City, State 12345"}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "website" && (
                  <input
                    type="url"
                    placeholder={field.placeholder || "https://example.com"}
                    disabled
                    className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed"
                  />
                )}

                {field.type === "multiple_choice" && (
                  <div className="space-y-2">
                    {(field.options || []).map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 cursor-not-allowed">
                        <input type="radio" disabled className="w-4 h-4" />
                        <span className="text-ink/50 text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {field.type === "dropdown" && (
                  <select disabled className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink/50 outline-none disabled:cursor-not-allowed">
                    <option>Select an option...</option>
                    {(field.options || []).map((opt, i) => (
                      <option key={i}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === "yes_no" && (
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 cursor-not-allowed">
                      <input type="radio" disabled className="w-4 h-4" />
                      <span className="text-ink/50 text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-not-allowed">
                      <input type="radio" disabled className="w-4 h-4" />
                      <span className="text-ink/50 text-sm">No</span>
                    </label>
                  </div>
                )}

                {field.type === "picture_choice" && (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-full h-24 bg-ink/[0.03] border border-ink/[0.13] rounded-lg flex items-center justify-center text-ink/[0.38] text-xs cursor-not-allowed"
                      >
                        Image {i + 1}
                      </div>
                    ))}
                  </div>
                )}

                {field.type === "rating" && (
                  <div className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button key={i} disabled className="text-ink/[0.38] cursor-not-allowed">
                        ⭐
                      </button>
                    ))}
                  </div>
                )}

                {field.type === "opinion_scale" && (
                  <div className="flex justify-between">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <label key={i} className="flex flex-col items-center gap-1 cursor-not-allowed">
                        <input type="radio" disabled className="w-4 h-4" />
                        <span className="text-ink/[0.48] text-xs">{i + 1}</span>
                      </label>
                    ))}
                  </div>
                )}

                {field.type === "checkbox" && (
                  <label className="flex items-start gap-2 cursor-not-allowed">
                    <input type="checkbox" disabled className="w-4 h-4 mt-1" />
                    <span className="text-ink/50 text-sm">{field.placeholder || "I agree to the terms"}</span>
                  </label>
                )}

                {field.type === "signature" && (
                  <div className="w-full h-32 bg-ink/[0.03] border border-ink/[0.13] rounded-lg border-dashed flex items-center justify-center text-ink/[0.38] text-sm">
                    [Signature area]
                  </div>
                )}

                {field.type === "file_upload" && (
                  <div className="space-y-2">
                    <input
                      ref={(el) => (fileInputRef.current[field.id] = el)}
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(e) => handleFileUpload(e, field.id)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current[field.id]?.click()}
                      disabled={uploadingField === field.id}
                      className="w-full border-2 border-dashed border-orange-500/30 rounded-lg p-4 text-center text-orange-400/70 text-sm hover:border-orange-500/60 hover:bg-orange-500/5 transition-all disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {uploadingField === field.id ? "Uploading..." : "Click to upload or drag files"}
                    </button>
                  </div>
                )}

                <p className="text-ink/[0.43] text-[10px]">{FIELD_TYPE_LABELS[field.type] || field.type}</p>
              </div>
            ))
          ) : (
            <p className="text-ink/[0.43] text-sm text-center py-8">No fields in this form yet.</p>
          )}

          <button disabled className="w-full mt-8 px-4 py-2.5 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium cursor-not-allowed">
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  const handleFileUpload = async (e, fieldId) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingField(fieldId);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (clientId) {
          const client = await base44.entities.CRMClient.get(clientId);
          const documents = client.documents || [];
          documents.push({
            id: Date.now() + Math.random(),
            name: file.name,
            url: file_url,
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          });
          await base44.entities.CRMClient.update(clientId, { documents });
        }
      }
      e.target.value = "";
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploadingField(null);
    }
  };
}