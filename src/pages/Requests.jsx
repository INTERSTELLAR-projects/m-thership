import { useState, useEffect } from "react";
import { Search, Plus, Eye, Trash2, FileText, Clock, CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import FormPreview from "../components/FormPreview";

export default function Requests() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [forms, setForms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewForm, setPreviewForm] = useState(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Get request forms
      const allForms = await base44.entities.FormTemplate.filter(
        { formType: "request", published: true },
        "-created_date",
        100
      );
      setForms(allForms);

      // Find customer by email
      const customers = await base44.entities.CRMClient.filter(
        { emails: currentUser.email },
        "-created_date",
        10
      );
      
      if (customers.length > 0) {
        const cust = customers[0];
        setCustomer(cust);
        setRequests(cust.requests || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const handleFormSubmit = async (formData) => {
    if (!customer) {
      alert("Error: Customer profile not found.");
      return;
    }

    setSubmitting(true);
    try {
      const newRequest = {
        id: Date.now(),
        title: previewForm.title,
        formType: previewForm.category,
        data: formData,
        status: "Pending",
        submittedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        updatedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      };

      const updatedRequests = [...(customer.requests || []), newRequest];
      await base44.entities.CRMClient.update(customer.id, { requests: updatedRequests });

      setRequests(updatedRequests);
      setPreviewForm(null);
      setSubmitting(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitting(false);
    }
  };

  const filteredForms = forms.filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase())
  );

  const pendingRequests = requests.filter((r) => r.status === "Pending");
  const inProgressRequests = requests.filter((r) => r.status === "In Progress");
  const completedRequests = requests.filter((r) => r.status === "Completed");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader breadcrumb="Portal / Requests" rightText="Submit Requests" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Portal / Requests" rightText="Submit Service Requests" />
      <div className="px-8 py-6 space-y-6">
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="bg-card border border-white/[0.06] mb-6">
            <TabsTrigger value="available" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40">
              Available Forms
            </TabsTrigger>
            <TabsTrigger value="tracking" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40">
              My Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <Input
                placeholder="Search forms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-card border-white/[0.06] text-white placeholder:text-white/20 h-9"
              />
            </div>

            {filteredForms.length === 0 ? (
              <div className="bg-card rounded-xl border border-white/[0.06] p-10 text-center">
                <FileText className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">
                  {search ? "No forms match your search." : "No available request forms yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredForms.map((form) => (
                  <div
                    key={form.id}
                    className="card-hover bg-card rounded-xl border border-white/[0.06] p-5 space-y-3 flex flex-col"
                  >
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-sm">{form.title}</h4>
                      <p className="text-white/40 text-xs mt-1">{form.subtitle}</p>
                      <p className="text-white/25 text-[10px] mt-2 uppercase tracking-wider">
                        {form.category}
                      </p>
                    </div>
                    <Button
                      onClick={() => setPreviewForm(form)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Start Request
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tracking" className="space-y-6">
            <div className="space-y-6">
              {/* Pending Requests */}
              <RequestSection
                title="Pending"
                requests={pendingRequests}
                icon={Clock}
                color="orange"
              />

              {/* In Progress */}
              <RequestSection
                title="In Progress"
                requests={inProgressRequests}
                icon={AlertCircle}
                color="blue"
              />

              {/* Completed / Previous */}
              <RequestSection
                title="Completed"
                requests={completedRequests}
                icon={CheckCircle}
                color="green"
              />

              {requests.length === 0 && (
                <div className="bg-card rounded-xl border border-white/[0.06] p-10 text-center">
                  <FileText className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">
                    No requests submitted yet. Submit a form to track it here.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {previewForm && (
        <RequestFormModal
          form={previewForm}
          onClose={() => setPreviewForm(null)}
          onSubmit={handleFormSubmit}
          submitting={submitting}
        />
      )}
    </div>
  );
}

function RequestSection({ title, requests, icon: Icon, color }) {
  const colorMap = {
    orange: "text-orange-500/50",
    blue: "text-blue-500/50",
    green: "text-green-500/50",
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-4 h-4 ${colorMap[color]}`} />
        <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">
          {title}
        </h3>
        <span className="text-white/30 text-xs ml-auto">({requests.length})</span>
      </div>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="bg-white/[0.02] rounded-lg border border-white/[0.04] p-3 flex items-center justify-between"
          >
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-sm font-medium">{req.title}</p>
              <p className="text-white/30 text-xs mt-0.5">
                Submitted {req.submittedDate}
              </p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded shrink-0 ${
              color === "orange" ? "bg-orange-500/10 text-orange-400" :
              color === "blue" ? "bg-blue-500/10 text-blue-400" :
              "bg-green-500/10 text-green-400"
            }`}>
              {req.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestFormModal({ form, onClose, onSubmit, submitting }) {
  const [formData, setFormData] = useState({});
  const [submittingLocal, setSubmittingLocal] = useState(false);

  const handleSubmit = async () => {
    setSubmittingLocal(true);
    await onSubmit(formData);
    setSubmittingLocal(false);
  };

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
    file_upload: "File Upload",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">{form.title}</h3>
            {form.subtitle && <p className="text-white/40 text-xs mt-1">{form.subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={submittingLocal}
            className="text-white/30 hover:text-white/60 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {form.fields && form.fields.length > 0 ? (
            form.fields.map((field) => (
              <FormFieldInput
                key={field.id}
                field={field}
                value={formData[field.id] || ""}
                onChange={(val) => setFormData({ ...formData, [field.id]: val })}
              />
            ))
          ) : (
            <p className="text-white/25 text-sm text-center py-8">No fields in this form.</p>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              disabled={submittingLocal}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submittingLocal || !form.fields || form.fields.length === 0}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {submittingLocal ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormFieldInput({ field, value, onChange }) {
  if (field.type === "short_text") {
    return (
      <div className="space-y-2">
        <label className="text-white/80 text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/30"
        />
      </div>
    );
  }

  if (field.type === "long_text") {
    return (
      <div className="space-y-2">
        <label className="text-white/80 text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none resize-none min-h-[100px] focus:border-orange-500/30"
        />
      </div>
    );
  }

  if (field.type === "email") {
    return (
      <div className="space-y-2">
        <label className="text-white/80 text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/30"
        />
      </div>
    );
  }

  if (field.type === "phone") {
    return (
      <div className="space-y-2">
        <label className="text-white/80 text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/30"
        />
      </div>
    );
  }

  if (field.type === "dropdown") {
    return (
      <div className="space-y-2">
        <label className="text-white/80 text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-orange-500/30"
        >
          <option value="">Select an option...</option>
          {(field.options || []).map((opt, i) => (
            <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "multiple_choice") {
    return (
      <div className="space-y-2">
        <label className="text-white/80 text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="space-y-2">
          {(field.options || []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-white/70 text-sm">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-white/80 text-sm font-medium">{field.label}</label>
      <input
        type="text"
        disabled
        placeholder="This field type is not yet supported"
        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/30 placeholder:text-white/20 outline-none"
      />
    </div>
  );
}