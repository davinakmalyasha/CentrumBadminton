import type { MetadataRoute } from "next";
import { siteUrlString } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrlString();
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
