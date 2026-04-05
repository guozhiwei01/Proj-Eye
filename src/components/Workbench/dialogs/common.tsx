import { Locale } from "../../../types/models";

export const modalPanelClass =
  "rounded-[14px] border border-white/8 bg-[#171719] p-5";

export function FieldLabel({ children }: { children: string }) {
  return <span className="text-sm font-medium text-[var(--text0)]">{children}</span>;
}

export function workbenchCopy(locale: string) {
  if (locale === Locale.ZhCN) {
    return {
      projectTitleNew: "\u65b0\u5efa\u9879\u76ee",
      projectTitleEdit: "\u7f16\u8f91\u9879\u76ee",
      projectDesc:
        "\u9879\u76ee\u7684\u5c42\u7ea7\u8def\u5f84\u51b3\u5b9a\u5de6\u4fa7\u9879\u76ee\u7ba1\u7406\u5668\u7684\u591a\u7ea7\u6811\u7ed3\u6784\uff0c\u6700\u540e\u4e00\u5c42\u6c38\u8fdc\u662f\u9879\u76ee\u53f6\u5b50\u8282\u70b9\u3002",
      hierarchyPath: "\u5c42\u7ea7\u8def\u5f84",
      hierarchyHint: "\u4f7f\u7528 / \u5206\u9694\u591a\u7ea7\u8282\u70b9\uff0c\u4f8b\u5982\uff1a\u4e1a\u52a1\u7ebf / \u8ba2\u5355 / \u652f\u4ed8",
      hierarchyPlaceholder: "\u4f8b\u5982\uff1a\u5e73\u53f0 / \u5de5\u4f5c\u53f0 / \u4e3b\u9879\u76ee",
      pathPreview: "\u6811\u7ed3\u6784\u9884\u89c8",
      newServer: "\u65b0\u5efa\u670d\u52a1\u5668",
      newDatabase: "\u65b0\u5efa\u6570\u636e\u5e93",
      serverTitleNew: "\u65b0\u5efa\u670d\u52a1\u5668",
      serverTitleEdit: "\u7f16\u8f91\u670d\u52a1\u5668",
      serverDesc:
        "\u670d\u52a1\u5668\u4e0e\u9879\u76ee\u89e3\u8026\u7ba1\u7406\uff0c\u4f46\u6240\u6709\u7f16\u8f91\u90fd\u901a\u8fc7\u6a21\u6001\u7a97\u53e3\u5b8c\u6210\uff0c\u4e0d\u518d\u6253\u65ad\u5de5\u4f5c\u53f0\u4e3b\u89c6\u56fe\u3002",
      databaseTitleNew: "\u65b0\u5efa\u6570\u636e\u5e93",
      databaseTitleEdit: "\u7f16\u8f91\u6570\u636e\u5e93",
      databaseDesc:
        "\u6570\u636e\u5e93\u914d\u7f6e\u5c06\u76f4\u63a5\u51b3\u5b9a\u53f3\u4fa7\u8d44\u6e90\u680f\u7684\u7ed1\u5b9a\u67e5\u8be2\u80fd\u529b\u3002",
      providerTitleNew: "\u65b0\u5efa AI Provider",
      providerTitleEdit: "\u7f16\u8f91 AI Provider",
      providerDesc:
        "\u628a\u6a21\u578b\u8fde\u63a5\u653e\u5728\u5de5\u4f5c\u53f0\u5185\u90e8\u7ba1\u7406\uff0cAI \u5bf9\u8bdd\u533a\u4f1a\u7acb\u5373\u4f7f\u7528\u6700\u65b0\u7684 Provider \u914d\u7f6e\u3002",
      settingsTitle: "\u5de5\u4f5c\u53f0\u8bbe\u7f6e",
      settingsDesc:
        "\u989c\u8272\u4e3b\u9898\uff0c\u8bed\u8a00\uff0cProvider \u9ed8\u8ba4\u8def\u7531\u548c\u5b89\u5168\u5b58\u50a8\u7b56\u7565\u90fd\u5728\u8fd9\u91cc\u7edf\u4e00\u7ef4\u62a4\u3002",
      overview: "\u6982\u89c8",
      attachCount: "\u5df2\u7ed1\u5b9a",
      saveClose: "\u4fdd\u5b58\u5e76\u5173\u95ed",
      cancel: "\u53d6\u6d88",
      providersReady: "\u53ef\u7528 Provider",
      secureStatus: "\u5b89\u5168\u5b58\u50a8\u72b6\u6001",
      queryReadonly: "\u67e5\u8be2\u53ea\u8bfb",
      optional: "\u53ef\u9009",
    };
  }

  return {
    projectTitleNew: "New Project",
    projectTitleEdit: "Edit Project",
    projectDesc:
      "The hierarchy path controls the multi-level tree in the project manager. The last node is always a real project leaf.",
    hierarchyPath: "Hierarchy path",
    hierarchyHint: "Use / between levels, for example: Platform / Orders / Billing",
    hierarchyPlaceholder: "Example: Workspace / Delivery / Main Project",
    pathPreview: "Tree preview",
    newServer: "New Server",
    newDatabase: "New Database",
    serverTitleNew: "New Server",
    serverTitleEdit: "Edit Server",
    serverDesc:
      "Servers stay reusable across projects, but every add or edit flow now happens in a modal instead of a standalone page.",
    databaseTitleNew: "New Database",
    databaseTitleEdit: "Edit Database",
    databaseDesc:
      "Database configuration directly shapes the compact query tools in the resource rail.",
    providerTitleNew: "New AI Provider",
    providerTitleEdit: "Edit AI Provider",
    providerDesc:
      "Provider changes stay inside the workbench so the AI conversation pane can immediately use the latest routing setup.",
    settingsTitle: "Workbench Settings",
    settingsDesc:
      "Theme, language, default provider routing, and secure-store controls all live in one place.",
    overview: "Overview",
    attachCount: "Bound",
    saveClose: "Save and close",
    cancel: "Cancel",
    providersReady: "Enabled providers",
    secureStatus: "Secure store status",
    queryReadonly: "Readonly queries",
    optional: "Optional",
  };
}
