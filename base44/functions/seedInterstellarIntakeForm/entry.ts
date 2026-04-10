import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const intakeForm = {
      title: "Interstellar",
      subtitle: "Customer intake form",
      category: "Other",
      formType: "intake",
      published: false,
      fields: [
        {
          id: "full_name",
          name: "fullName",
          label: "Full Name",
          type: "short_text",
          required: true,
          placeholder: "John Doe",
        },
        {
          id: "email",
          name: "email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "john@example.com",
        },
        {
          id: "phone",
          name: "phone",
          label: "Phone Number",
          type: "phone",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          id: "company",
          name: "company",
          label: "Company / Business Name",
          type: "short_text",
          required: true,
          placeholder: "Acme Corp",
        },
        {
          id: "industry",
          name: "industry",
          label: "Industry",
          type: "dropdown",
          required: true,
          options: [
            "Technology",
            "E-commerce",
            "Healthcare",
            "Finance",
            "Real Estate",
            "Manufacturing",
            "Retail",
            "Services",
            "Other",
          ],
        },
        {
          id: "website",
          name: "website",
          label: "Website (if available)",
          type: "website",
          required: false,
          placeholder: "https://example.com",
        },
        {
          id: "services_interested",
          name: "servicesInterested",
          label: "What services are you interested in?",
          type: "long_text",
          required: true,
          placeholder: "Describe the services you need...",
        },
        {
          id: "timeline",
          name: "timeline",
          label: "Project Timeline",
          type: "dropdown",
          required: true,
          options: [
            "Immediate (within 1 week)",
            "Soon (within 1 month)",
            "3-6 months",
            "6-12 months",
            "Just exploring",
          ],
        },
        {
          id: "budget",
          name: "budget",
          label: "Budget Range",
          type: "dropdown",
          required: false,
          options: [
            "Under $5,000",
            "$5,000 - $10,000",
            "$10,000 - $25,000",
            "$25,000 - $50,000",
            "$50,000+",
          ],
        },
        {
          id: "additional_notes",
          name: "additionalNotes",
          label: "Additional Information",
          type: "long_text",
          required: false,
          placeholder: "Anything else we should know...",
        },
      ],
    };

    const existing = await base44.entities.FormTemplate.filter({ title: "Interstellar", formType: "intake" });
    if (existing.length > 0) {
      return Response.json({ message: "Form already exists", form: existing[0] });
    }

    const created = await base44.entities.FormTemplate.create(intakeForm);
    return Response.json({ success: true, form: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});