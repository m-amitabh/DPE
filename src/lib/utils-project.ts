import { Project, RemoteProvider, SortBy } from "./types";
import { formatDistanceToNow } from "date-fns";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function formatRelativeTime(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export function getRemoteProvider(url: string | null | undefined): RemoteProvider {
  if (!url) return null;
  if (url.includes("github.com")) return "github";
  if (url.includes("gitlab.com")) return "gitlab";
  if (url.includes("bitbucket.org")) return "bitbucket";
  return null;
}

export function sortProjects(projects: Project[], sortBy: SortBy): Project[] {
  const sorted = [...projects];
  
  switch (sortBy) {
    case "last_used":
      return sorted.sort((a, b) => {
        const aTime = a.last_used ? new Date(a.last_used).getTime() : 0;
        const bTime = b.last_used ? new Date(b.last_used).getTime() : 0;
        return bTime - aTime;
      });
    case "created":
      return sorted.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
    case "last_commit":
      return sorted.sort((a, b) => {
        const aCommit = a.git?.last_commit ? new Date(a.git.last_commit).getTime() : 0;
        const bCommit = b.git?.last_commit ? new Date(b.git.last_commit).getTime() : 0;
        return bCommit - aCommit;
      });
    case "disk_usage":
      return sorted.sort((a, b) => {
        const aDisk = a.disk_usage_bytes ?? 0;
        const bDisk = b.disk_usage_bytes ?? 0;
        return bDisk - aDisk;
      });
    case "importance":
      const importanceOrder: Record<number, number> = { 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 };
      return sorted.sort((a, b) => {
        const aImportance = importanceOrder[a.importance] ?? 0;
        const bImportance = importanceOrder[b.importance] ?? 0;
        return bImportance - aImportance;
      });
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
}

export function getAllTags(projects: Project[]): string[] {
  const tagSet = new Set<string>();
  projects.forEach(project => {
    project.tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}
