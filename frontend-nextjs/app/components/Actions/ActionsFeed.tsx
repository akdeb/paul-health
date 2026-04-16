"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronRight, ClockIcon, Cpu, MessageSquareText } from "lucide-react";

const PAGE_SIZE = 20;

const formatSessionTime = (seconds: number) => {
  if (seconds <= 0) {
    return "<1 min";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
};

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
};

const getActionLabel = (type: ActionType, jobId: string | null) => {
  switch (type) {
    case "web_chat":
      return "Web chat";
    case "device_chat":
      return jobId ? "Scheduled chat" :"Device chat";
    case "device_event":
      return "Device event";
    default:
      return type;
  }
};

const getActionTitle = (type: ActionType) => {
  switch (type) {
    case "web_chat":
    case "device_chat":
      return "Conversation";
    case "device_event":
      return "Device event";
    default:
      return "Action";
  }
};

const getActionIcon = (type: ActionType) => {
  switch (type) {
    case "web_chat":
      return MessageSquareText;
    case "device_chat":
      return Bot;
    case "device_event":
      return Cpu;
    default:
      return Cpu;
  }
};

const getActionTagClasses = (type: ActionType, jobId: string | null) => {
  switch (type) {
    case "web_chat":
      return "bg-blue-500 text-white";
    case "device_chat":
      return jobId ? "bg-red-500 text-white" : "bg-emerald-500 text-white";
    case "device_event":
      return "bg-amber-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export default function ActionsFeed({
  initialActions,
}: {
  initialActions: IAction[];
}) {
  const [actions, setActions] = useState(initialActions);
  const [offset, setOffset] = useState(initialActions.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialActions.length === PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActions(initialActions);
    setOffset(initialActions.length);
    setHasMore(initialActions.length === PAGE_SIZE);
  }, [initialActions]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const response = await fetch(`/api/actions?offset=${offset}&limit=${PAGE_SIZE}`);
      if (!response.ok) {
        throw new Error("Failed to load actions");
      }

      const payload = await response.json() as {
        actions: IAction[];
        hasMore: boolean;
        nextOffset: number;
      };

      setActions((current) => {
        const existingIds = new Set(current.map((action) => action.action_id));
        const nextActions = payload.actions.filter((action) => !existingIds.has(action.action_id));
        return [...current, ...nextActions];
      });
      setOffset(payload.nextOffset);
      setHasMore(payload.hasMore);
    } catch (error) {
      console.error("Failed to load more actions", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, offset]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        rootMargin: "200px 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const renderedActions = useMemo(() => actions, [actions]);

  if (renderedActions.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-10 text-sm text-gray-500">
        No actions yet. Chats and device events will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderedActions.map((action) => {
        const Icon = getActionIcon(action.type);
        const isTranscriptAction = action.type === "web_chat" || action.type === "device_chat";
        const metadataText =
          typeof action.metadata?.text === "string" ? action.metadata.text : null;

        const card = (
          <div className="rounded-3xl border border-gray-200 bg-white px-5 py-4 transition hover:border-gray-300 hover:shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 rounded-2xl p-2 text-gray-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900">
                      {getActionTitle(action.type)}
                    </h2>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getActionTagClasses(action.type, action.job_id)}`}
                    >
                      {getActionLabel(action.type, action.job_id)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatTimestamp(action.created_at)}
                  </p>
                  {metadataText ? (
                    <p className="mt-3 text-sm text-gray-700">
                      {metadataText}
                    </p>
                  ) : null}
                  <p className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    <ClockIcon className="h-4 w-4" /> {formatSessionTime(action.session_time)}
                  </p>
                </div>
              </div>
              {isTranscriptAction ? (
                <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-900">
                  View transcript
                  <ChevronRight className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          </div>
        );

        if (!isTranscriptAction) {
          return <div key={action.action_id}>{card}</div>;
        }

        return (
          <Link
            key={action.action_id}
            href={`/home/actions/${action.action_id}`}
            className="block"
          >
            {card}
          </Link>
        );
      })}
      <div ref={sentinelRef} className="h-4" />
      {isLoadingMore ? (
        <p className="text-center text-sm text-gray-500">Loading more actions...</p>
      ) : null}
      {!hasMore ? (
        <p className="text-center text-sm text-gray-400">You have reached the latest stored action history.</p>
      ) : null}
    </div>
  );
}
