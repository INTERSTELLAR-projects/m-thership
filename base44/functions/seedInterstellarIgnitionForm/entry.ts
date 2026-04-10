import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const intakeForm = {
      title: "Interstellar Ignition Form",
      subtitle: "New client intake",
      category: "Other",
      formType: "intake",
      published: false,
      fields: [
        {
          id: "business_name",
          label: "Business Name",
          type: "short_text",
          required: true,
          placeholder: "Enter your business name",
        },
        {
          id: "contact_name",
          label: "Contact Name",
          type: "short_text",
          required: true,
          placeholder: "Enter your name",
        },
        {
          id: "contact_phone",
          label: "Contact Phone Number",
          type: "phone",
          required: true,
          placeholder: "(555) 123-4567",
        },
        {
          id: "contact_email",
          label: "Email Address",
          type: "email",
          required: true,
          placeholder: "your@email.com",
        },
        {
          id: "website",
          label: "Website",
          type: "website",
          required: true,
          placeholder: "https://example.com",
        },
        {
          id: "brand_tagline",
          label: "Brand Tagline",
          type: "short_text",
          required: false,
          placeholder: "Your brand's tagline or motto",
        },
        {
          id: "brand_summary",
          label: "Brand Summary",
          type: "long_text",
          required: false,
          placeholder: "Brief description of your brand and business",
        },
        {
          id: "brand_colors",
          label: "Primary Brand Colors (hex codes)",
          type: "short_text",
          required: false,
          placeholder: "#FF6A00, #000000, etc.",
        },
        {
          id: "typography",
          label: "Typography Preferences",
          type: "long_text",
          required: false,
          placeholder: "Describe your preferred fonts and typography style",
        },
        {
          id: "brand_voice",
          label: "Brand Voice & Tone",
          type: "long_text",
          required: false,
          placeholder: "How do you want your brand to sound and communicate?",
        },
        {
          id: "visual_identity",
          label: "Visual Identity & Style",
          type: "long_text",
          required: false,
          placeholder: "Describe your visual style, photography style, and design direction",
        },
        {
          id: "brand_personality",
          label: "Brand Personality",
          type: "long_text",
          required: false,
          placeholder: "Describe your brand's personality traits and positioning",
        },
        {
          id: "iconography",
          label: "Iconography & Imagery Style",
          type: "long_text",
          required: false,
          placeholder: "Describe your preferred icon and illustration style",
        },
        {
          id: "social_content_style",
          label: "Social Media & Content Style",
          type: "long_text",
          required: false,
          placeholder: "How do you want to present yourself on social media?",
        },
        {
          id: "brand_rules",
          label: "Brand Rules & Guidelines",
          type: "long_text",
          required: false,
          placeholder: "Any specific rules or things to avoid in your branding?",
        },
      ],
    };

    const existing = await base44.entities.FormTemplate.filter({ title: "Interstellar Ignition Form", formType: "intake" });
    if (existing.length > 0) {
      return Response.json({ message: "Form already exists", form: existing[0] });
    }

    const created = await base44.entities.FormTemplate.create(intakeForm);
    return Response.json({ success: true, form: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});