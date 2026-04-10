import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const webOpsForm = {
      title: "WebOps Website Update Request",
      subtitle: "Submit a structured request for website updates, edits, or improvements.",
      category: "Web Øps",
      published: true,
      publishedDate: new Date().toISOString(),
      fields: [
        {
          id: "primary_objective",
          name: "primaryObjective",
          label: "What is the single most important outcome you want from this update?",
          type: "textarea",
          required: true,
          placeholder: "Describe the main goal...",
        },
        {
          id: "update_type",
          name: "updateType",
          label: "What type of update is this? (Select all that apply)",
          type: "multiselect",
          required: true,
          options: [
            "Content Edit",
            "Text Changes",
            "Design Update",
            "Layout / Spacing",
            "Visual Updates",
            "New Section Added",
            "New Page Added",
            "Image or Video Update",
            "Link or Navigation Change",
            "Form or CTA Update",
            "General Site Update",
            "Other",
          ],
        },
        {
          id: "pages_to_update",
          name: "pagesToUpdate",
          label: "Which pages need to be updated? (Example: homepage, services, about, contact, etc.)",
          type: "text",
          required: true,
          placeholder: "List the pages...",
        },
        {
          id: "detailed_request",
          name: "detailedRequest",
          label: "Describe exactly what you want changed",
          type: "textarea",
          required: true,
          helperText: "Be specific. If replacing text, paste the new text. If removing something, state what should be removed. If adding something, explain where it should go.",
          placeholder: "Detailed description...",
        },
        {
          id: "content_assets",
          name: "contentAssets",
          label: "Are you providing new content or assets?",
          type: "select",
          required: true,
          options: ["Yes", "No"],
        },
        {
          id: "file_upload",
          name: "fileUpload",
          label: "Upload your files or assets here",
          type: "file",
          required: false,
          conditionalOn: { field: "contentAssets", value: "Yes" },
          acceptedTypes: ["images", "videos", "documents", "pdf"],
          multiple: true,
        },
        {
          id: "urgency",
          name: "urgency",
          label: "How urgent is this request?",
          type: "select",
          required: true,
          options: ["Standard", "High Priority"],
        },
        {
          id: "deadline",
          name: "deadline",
          label: "Is there a deadline or reason for urgency?",
          type: "text",
          required: true,
          placeholder: "Deadline or context...",
        },
        {
          id: "approval",
          name: "approval",
          label: "I confirm this request is approved and ready to be implemented",
          type: "checkbox",
          required: true,
        },
        {
          id: "additional_notes",
          name: "additionalNotes",
          label: "Anything else we should know? (Context, references, examples, concerns)",
          type: "textarea",
          required: true,
          placeholder: "Additional notes...",
        },
      ],
    };

    const existing = await base44.entities.FormTemplate.filter({ title: "WebOps Website Update Request" });
    if (existing.length > 0) {
      return Response.json({ message: "Form already exists", form: existing[0] });
    }

    const created = await base44.entities.FormTemplate.create(webOpsForm);
    return Response.json({ success: true, form: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});