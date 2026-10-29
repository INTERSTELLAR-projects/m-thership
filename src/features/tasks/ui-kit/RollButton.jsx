import React from "react";
import { cn } from "@/lib/utils";

// Site-style roll button: <button className="btn-roll is-flame"> with rolling label + icon box.
export default function RollButton({ label, icon: Icon, variant = "flame", className, type = "button", ...props }) {
  return (
    <button type={type} className={cn("btn-roll disabled:opacity-50", "is-" + variant, className)} {...props}>
      <span className="roll">
        <span>{label}</span>
        <span>{label}</span>
      </span>
      {Icon ? (
        <span className="box">
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </button>
  );
}
