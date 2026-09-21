"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Info,
  Users,
  Video,
} from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import { duration, errorMessage, type Analytics } from "@/lib/types";
import { useSession } from "./session-provider";
import { ErrorNotice, Loading } from "./ui";

export function AnalyticsView({ videoId }: { videoId: string }) {
  const { loading: sessionLoading } = useSession();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (sessionLoading) return;
    let active = true;
    api<Analytics>(`/api/videos/${videoId}/analytics`)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [videoId, sessionLoading]);
  const metrics = data
    ? [
        {
          title: "Total views",
          value: data.totalViews,
          icon: Eye,
          description: "Playback sessions with meaningful viewing.",
        },
        {
          title: "Unique viewers",
          value: data.uniqueViewers,
          icon: Users,
          description: "Individual viewers who started your clip.",
        },
        {
          title: "Average watched",
          value: `${data.averageWatchPercentage.toFixed(0)}%`,
          icon: BarChart3,
          description: "How much of your clip viewers watched.",
        },
        {
          title: "Completion rate",
          value: `${data.completionRate.toFixed(0)}%`,
          icon: CheckCircle2,
          description: "The share of viewers who reached the end.",
        },
        {
          title: "Average watch time",
          value: duration(data.averageWatchTimeSeconds),
          icon: Clock3,
          description: "Time spent watching per playback session.",
        },
      ]
    : [];
  return (
    <main id="main" className="app-main">
      <Link className="back-link" href={`/videos/${videoId}`}>
        <ArrowLeft size={16} /> Back to clip
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEE WHAT’S LANDING</span>
          <h1>A little perspective.</h1>
          <p>Real views. Meaningful moments. A clearer picture.</p>
        </div>
      </div>
      {loading ? (
        <Loading text="Gathering your insights…" />
      ) : data ? (
        <>
          <div className="analytics-grid">
            {metrics.map((metric) => (
              <article className="metric" key={metric.title}>
                <span>
                  <metric.icon size={17} />
                  {metric.title}
                </span>
                <strong>{metric.value}</strong>
                <p>{metric.description}</p>
              </article>
            ))}
          </div>
          <p className="analytics-note">
            <Info size={16} /> Insights update as viewers watch your clip. Only
            you can see this page.
          </p>
        </>
      ) : !cloudConfigured ? (
        <div className="analytics-unavailable">
          <BarChart3 size={34} strokeWidth={1.3} />
          <h2>Every view will tell a story.</h2>
          <p>
            Viewing insights appear here after cloud services are connected and
            people start watching your clips.
          </p>
          <Link href="/record" className="button button-dark">
            <Video size={16} /> Record a clip <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <ErrorNotice>{error}</ErrorNotice>
      )}
    </main>
  );
}
