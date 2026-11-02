import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  ArrowDown, ArrowUp, CalendarDays, Check, CircleAlert, Copy, ExternalLink, FileStack, Loader2, MessageSquareWarning, Pencil, Plus, Sparkles, Trash2, X, Zap,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { useJobs, useRefreshJobs, approveJob, requestChanges, cancelJob, chatPrompt, JOB_STATUS } from "@/features/claude/jobs";
import {
  contentPlanBrief, contentPlanCriteria, contentPlanFromJob, fmtDay, gatbpPlaceholder as _unused, // eslint-disable-line no-unused-vars
} from "@/features/claude/contentPlanCompat";
