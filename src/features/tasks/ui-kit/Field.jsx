import React from "react";
import { labelClass } from "@/features/tasks/lib/ui";

export default function Field({ label, className = "", children }) {
  return (
    <div className={className}>
      <p className={labelClass + " mb-1.5"}>{label}</p>
      {children}
    </div>
  );
}
