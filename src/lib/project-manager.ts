import type { Project } from "../types/models";

const MANAGER_PATH_KEY = "managerPath";

export interface ProjectFolderNode {
  id: string;
  name: string;
  path: string[];
  folders: ProjectFolderNode[];
  projects: Project[];
  projectCount: number;
  alertCount: number;
}

function normalizeSegment(segment: string): string {
  return segment.trim().replace(/[\\/]+/g, " ");
}

export function normalizeManagerPathInput(value: string): string[] {
  return value
    .split(/[\\/]+/)
    .map(normalizeSegment)
    .filter(Boolean);
}

export function getProjectManagerPath(project: { extra?: Record<string, unknown> }): string[] {
  const candidate = project.extra?.[MANAGER_PATH_KEY];
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((segment) => (typeof segment === "string" ? normalizeSegment(segment) : ""))
    .filter(Boolean);
}

export function managerPathLabel(path: string[]): string {
  return path.length > 0 ? path.join(" / ") : "ROOT";
}

export function setProjectManagerPath(
  extra: Record<string, unknown> | undefined,
  path: string[],
): Record<string, unknown> {
  const next = { ...(extra ?? {}) };
  const normalized = path.map(normalizeSegment).filter(Boolean);

  if (normalized.length === 0) {
    delete next[MANAGER_PATH_KEY];
    return next;
  }

  next[MANAGER_PATH_KEY] = normalized;
  return next;
}

function buildNodeId(path: string[]): string {
  return path.length > 0 ? path.join("::") : "root";
}

function sortNode(node: ProjectFolderNode): ProjectFolderNode {
  node.folders.sort((left, right) => left.name.localeCompare(right.name));
  node.projects.sort((left, right) => left.name.localeCompare(right.name));

  node.folders.forEach((child) => sortNode(child));
  node.projectCount =
    node.projects.length + node.folders.reduce((sum, child) => sum + child.projectCount, 0);
  node.alertCount =
    node.projects.filter((project) => Boolean(project.recentIssue)).length +
    node.folders.reduce((sum, child) => sum + child.alertCount, 0);

  return node;
}

export function buildProjectFolderTree(projects: Project[]): ProjectFolderNode {
  const root: ProjectFolderNode = {
    id: "root",
    name: "ROOT",
    path: [],
    folders: [],
    projects: [],
    projectCount: 0,
    alertCount: 0,
  };

  projects.forEach((project) => {
    const path = getProjectManagerPath(project);
    let cursor = root;

    path.forEach((segment, index) => {
      const nextPath = path.slice(0, index + 1);
      let folder = cursor.folders.find((candidate) => candidate.name === segment);
      if (!folder) {
        folder = {
          id: buildNodeId(nextPath),
          name: segment,
          path: nextPath,
          folders: [],
          projects: [],
          projectCount: 0,
          alertCount: 0,
        };
        cursor.folders.push(folder);
      }
      cursor = folder;
    });

    cursor.projects.push(project);
  });

  return sortNode(root);
}

export function collectExpandedFolderIds(path: string[]): string[] {
  return path.map((_, index) => buildNodeId(path.slice(0, index + 1)));
}
