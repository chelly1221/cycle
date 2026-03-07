"use client";

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRef, useCallback } from "react";

function ImageResizeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startWidth = containerRef.current?.offsetWidth || 300;

      function onMouseMove(ev: MouseEvent) {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(100, startWidth + delta);
        updateAttributes({ width: Math.round(newWidth) });
      }

      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes]
  );

  const width = node.attrs.width;
  const isEditable = editor?.isEditable;

  return (
    <NodeViewWrapper className="image-resizable my-4">
      <div
        ref={containerRef}
        className={`relative inline-block max-w-full ${
          selected && isEditable ? "ring-2 ring-strava ring-offset-2 ring-offset-gray-950" : ""
        }`}
        style={width ? { width: `${width}px`, maxWidth: "100%" } : undefined}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          title={node.attrs.title || undefined}
          className="rounded-lg w-full"
          draggable={false}
        />
        {isEditable && selected && (
          <div
            className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize rounded-tl bg-strava/80 hover:bg-strava flex items-center justify-center"
            onMouseDown={onResizeStart}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M9 1v8H1" />
              <path d="M9 5v4H5" />
            </svg>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const attr = element.getAttribute("width");
          if (attr) return parseInt(attr, 10) || null;
          const sw = element.style.width;
          if (sw?.endsWith("px")) return parseInt(sw, 10) || null;
          return null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {};
          return { style: `width: ${attributes.width}px` };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageResizeView);
  },
});
