import { Node, mergeAttributes } from "@tiptap/core";

export const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "column" }), 0];
  },
});

export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column column",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: "two-equal",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-layout") || "two-equal",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-layout": attributes.layout,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "columns" }), 0];
  },
});
