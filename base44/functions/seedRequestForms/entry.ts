import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const forgeRequest = {
      title: "Førge Request",
      subtitle: "Request a build or deployment task",
      category: "Førge",
      formType: "request",
      published: true,
      publishedDate: new Date().toISOString(),
      fields: [
        {
          id: "project_name",
          label: "Project Name",
          type: "short_text",
          required: true,
          placeholder: "What is this project called?",
        },
        {
          id: "project_type",
          label: "What type of project is this?",
          type: "dropdown",
          required: true,
          options: ["New Build", "Feature Addition", "Bug Fix", "Deployment", "Other"],
        },
        {
          id: "description",
          label: "Project Description",
          type: "long_text",
          required: true,
          placeholder: "Describe what you need built or deployed...",
        },
        {
          id: "requirements",
          label: "Specific Requirements",
          type: "long_text",
          required: false,
          placeholder: "Any specific tech stack, libraries, or requirements?",
        },
        {
          id: "timeline",
          label: "Timeline / Deadline",
          type: "short_text",
          required: true,
          placeholder: "When do you need this completed?",
        },
        {
          id: "budget",
          label: "Budget Range (optional)",
          type: "dropdown",
          required: false,
          options: ["Under $1,000", "$1,000 - $5,000", "$5,000 - $10,000", "$10,000+", "Not set"],
        },
        {
          id: "priority",
          label: "Priority Level",
          type: "dropdown",
          required: true,
          options: ["Low", "Medium", "High", "Critical"],
        },
        {
          id: "additional_notes",
          label: "Additional Information",
          type: "long_text",
          required: false,
          placeholder: "Anything else we should know?",
        },
      ],
    };

    const webOpsRequest = {
      title: "Web Øps Request",
      subtitle: "Request website updates or changes",
      category: "Web Øps",
      formType: "request",
      published: true,
      publishedDate: new Date().toISOString(),
      fields: [
        {
          id: "update_type",
          label: "What type of update do you need?",
          type: "dropdown",
          required: true,
          options: ["Content Update", "Design Change", "Layout Update", "New Page", "Performance", "Security", "Other"],
        },
        {
          id: "affected_pages",
          label: "Which pages are affected?",
          type: "long_text",
          required: true,
          placeholder: "List the pages (e.g., homepage, services, about, contact)",
        },
        {
          id: "detailed_request",
          label: "Describe the changes you want",
          type: "long_text",
          required: true,
          placeholder: "Be as specific as possible. What should change and how?",
        },
        {
          id: "current_issues",
          label: "Current Issues or Problems",
          type: "long_text",
          required: false,
          placeholder: "What's not working or what do you want improved?",
        },
        {
          id: "deadline",
          label: "When do you need this done?",
          type: "short_text",
          required: true,
          placeholder: "e.g., By Friday, ASAP, Next week",
        },
        {
          id: "urgency",
          label: "How urgent is this?",
          type: "dropdown",
          required: true,
          options: ["Standard", "High Priority", "Critical"],
        },
        {
          id: "reference_links",
          label: "Reference Links or Examples",
          type: "long_text",
          required: false,
          placeholder: "Links to examples, competitors, or references",
        },
        {
          id: "additional_context",
          label: "Additional Context",
          type: "long_text",
          required: false,
          placeholder: "Any other information that would help?",
        },
      ],
    };

    // Check if forms already exist
    const existingForge = await base44.entities.FormTemplate.filter({ title: "Førge Request", formType: "request" });
    const existingWebOps = await base44.entities.FormTemplate.filter({ title: "Web Øps Request", formType: "request" });

    const results = [];

    if (existingForge.length === 0) {
      const createdForge = await base44.entities.FormTemplate.create(forgeRequest);
      results.push({ form: "Forge Request", created: true, id: createdForge.id });
    } else {
      results.push({ form: "Forge Request", created: false, message: "Already exists" });
    }

    if (existingWebOps.length === 0) {
      const createdWebOps = await base44.entities.FormTemplate.create(webOpsRequest);
      results.push({ form: "Web Ops Request", created: true, id: createdWebOps.id });
    } else {
      results.push({ form: "Web Ops Request", created: false, message: "Already exists" });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});