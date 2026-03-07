"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "./ResizableImage";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Columns, Column } from "./extensions/Columns";
import { Callout } from "./extensions/Callout";
import { useEffect, useRef, useState, useCallback } from "react";

const lowlight = createLowlight(common);

interface Props {
  content: string;
  onChange: (html: string) => void;
  onUpload?: (url: string) => void;
  editable?: boolean;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded text-xs font-medium transition-colors ${
        disabled
          ? "text-gray-600 cursor-not-allowed"
          : active
          ? "bg-gray-600 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-700 mx-0.5" />;
}

/* ── Dropdown wrapper ─────────────────────────────────────────── */

function DropdownMenu({
  label,
  title,
  icon,
  active,
  open,
  onToggle,
  children,
}: {
  label?: string;
  title: string;
  icon: React.ReactNode;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onToggle}
        title={title}
        className={`p-1.5 rounded text-xs font-medium transition-colors flex items-center gap-0.5 ${
          active
            ? "bg-gray-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-700"
        }`}
      >
        {icon}
        {label && <span>{label}</span>}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="ml-0.5">
          <path d="M1 3l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg py-1 z-50 min-w-[160px] shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors ${
        active ? "bg-gray-700 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Layout preview icons ─────────────────────────────────────── */

function LayoutPreview({ layout }: { layout: string }) {
  const cols: Record<string, string[]> = {
    "two-equal": ["flex-1", "flex-1"],
    "two-left": ["flex-[2]", "flex-1"],
    "two-right": ["flex-1", "flex-[2]"],
  };
  const c = cols[layout] || cols["two-equal"];
  return (
    <div className="flex gap-0.5 w-7 shrink-0">
      {c.map((f, i) => (
        <div key={i} className={`h-4 bg-gray-500 rounded-sm ${f}`} />
      ))}
    </div>
  );
}

/* ── Callout variant config ───────────────────────────────────── */

const CALLOUT_VARIANTS = [
  { value: "info", label: "정보", color: "#3b82f6" },
  { value: "warning", label: "주의", color: "#f59e0b" },
  { value: "tip", label: "팁", color: "#22c55e" },
  { value: "route", label: "루트", color: "#fc4c02" },
] as const;

const HIGHLIGHT_COLORS = [
  { value: "#fef08a", label: "노랑" },
  { value: "#bbf7d0", label: "초록" },
  { value: "#bfdbfe", label: "파랑" },
  { value: "#fecaca", label: "빨강" },
  { value: "#e9d5ff", label: "보라" },
] as const;

const TEXT_COLORS = [
  { value: "", label: "기본", hex: "#e5e7eb" },
  { value: "#f87171", label: "빨강", hex: "#f87171" },
  { value: "#fb923c", label: "주황", hex: "#fb923c" },
  { value: "#facc15", label: "노랑", hex: "#facc15" },
  { value: "#4ade80", label: "초록", hex: "#4ade80" },
  { value: "#60a5fa", label: "파랑", hex: "#60a5fa" },
  { value: "#c084fc", label: "보라", hex: "#c084fc" },
] as const;

/* ═══════════════════════════════════════════════════════════════ */

export default function RichEditor({ content, onChange, onUpload, editable = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const toggleDropdown = useCallback(
    (name: string) => setActiveDropdown((prev) => (prev === name ? null : name)),
    []
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!activeDropdown) return;
    const close = () => setActiveDropdown(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [activeDropdown]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-strava underline" },
      }),
      ResizableImage.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full" },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: "이 라이드에 대한 후기를 작성해주세요…",
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      CodeBlockLowlight.configure({ lowlight }),
      Columns,
      Column,
      Callout,
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rich-editor-content outline-none min-h-[200px] px-4 py-3 text-sm text-gray-200 leading-relaxed",
      },
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = "";

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "이미지 업로드에 실패했습니다.");
        return;
      }
      const { url } = await res.json();
      onUpload?.(url);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  /* ── Layout helpers ──────────────────────────────────────────── */

  function insertColumns(layout: string) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "columns",
        attrs: { layout },
        content: [
          { type: "column", content: [{ type: "paragraph" }] },
          { type: "column", content: [{ type: "paragraph" }] },
        ],
      })
      .run();
    setActiveDropdown(null);
  }

  function changeColumnsLayout(layout: string) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("columns", { layout }).run();
    setActiveDropdown(null);
  }

  function insertCallout(variant: string) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "callout",
        attrs: { variant },
        content: [{ type: "paragraph" }],
      })
      .run();
    setActiveDropdown(null);
  }

  function changeCalloutVariant(variant: string) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("callout", { variant }).run();
    setActiveDropdown(null);
  }

  function removeCallout() {
    if (!editor) return;
    const { state } = editor;
    const { $from } = state.selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "callout") {
        const pos = $from.before(depth);
        const end = $from.after(depth);
        editor
          .chain()
          .focus()
          .command(({ tr }) => {
            tr.replaceWith(pos, end, node.content);
            return true;
          })
          .run();
        break;
      }
    }
    setActiveDropdown(null);
  }

  if (!editor) return null;

  const isInColumns = editor.isActive("columns");
  const currentLayout = isInColumns ? editor.getAttributes("columns").layout : null;
  const isInCallout = editor.isActive("callout");
  const currentCalloutVariant = isInCallout ? editor.getAttributes("callout").variant : null;

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-950 overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        className="hidden"
        onChange={handleFileChange}
      />

      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-700 bg-gray-900/50">
          {/* ── Headings ──────────────────────────────── */}
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="제목 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="제목 3"
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 4 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            title="제목 4"
          >
            H4
          </ToolbarButton>

          <Divider />

          {/* ── Inline formatting ─────────────────────── */}
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="굵게"
          >
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="기울임"
          >
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="밑줄"
          >
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="취소선"
          >
            <span className="line-through">S</span>
          </ToolbarButton>

          <Divider />

          {/* ── Highlight ─────────────────────────────── */}
          <DropdownMenu
            title="하이라이트"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            }
            active={editor.isActive("highlight")}
            open={activeDropdown === "highlight"}
            onToggle={() => toggleDropdown("highlight")}
          >
            {HIGHLIGHT_COLORS.map((c) => (
              <DropdownItem
                key={c.value}
                active={editor.isActive("highlight", { color: c.value })}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: c.value }).run();
                  setActiveDropdown(null);
                }}
              >
                <span
                  className="w-4 h-4 rounded-sm border border-gray-600 shrink-0"
                  style={{ backgroundColor: c.value }}
                />
                <span>{c.label}</span>
              </DropdownItem>
            ))}
            <DropdownItem
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setActiveDropdown(null);
              }}
            >
              <span className="w-4 h-4 rounded-sm border border-gray-600 bg-transparent shrink-0 flex items-center justify-center text-[9px] text-gray-500">
                x
              </span>
              <span>제거</span>
            </DropdownItem>
          </DropdownMenu>

          {/* ── Text color ────────────────────────────── */}
          <DropdownMenu
            title="글자 색"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16" />
                <path d="M12 4l-5 12h10L12 4z" />
              </svg>
            }
            open={activeDropdown === "color"}
            onToggle={() => toggleDropdown("color")}
          >
            {TEXT_COLORS.map((c) => (
              <DropdownItem
                key={c.value || "default"}
                active={c.value ? editor.isActive("textStyle", { color: c.value }) : false}
                onClick={() => {
                  if (c.value) {
                    editor.chain().focus().setColor(c.value).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  setActiveDropdown(null);
                }}
              >
                <span
                  className="w-4 h-4 rounded-full border border-gray-600 shrink-0"
                  style={{ backgroundColor: c.hex }}
                />
                <span>{c.label}</span>
              </DropdownItem>
            ))}
          </DropdownMenu>

          <Divider />

          {/* ── Link & Image ──────────────────────────── */}
          <ToolbarButton
            active={editor.isActive("link")}
            onClick={() => {
              if (editor.isActive("link")) {
                editor.chain().focus().unsetLink().run();
                return;
              }
              const url = window.prompt("링크 URL:");
              if (url) {
                editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
              }
            }}
            title="링크"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            title="이미지 업로드"
          >
            {uploading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </ToolbarButton>

          <Divider />

          {/* ── Block elements ────────────────────────── */}
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="인용문"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="코드 블록"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="글머리 목록"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="번호 목록"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="10" y1="6" x2="21" y2="6" />
              <line x1="10" y1="12" x2="21" y2="12" />
              <line x1="10" y1="18" x2="21" y2="18" />
              <path d="M4 6h1v4" />
              <path d="M4 10h2" />
              <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="구분선"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
          </ToolbarButton>

          <Divider />

          {/* ── Text align ────────────────────────────── */}
          <ToolbarButton
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="왼쪽 정렬"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="가운데 정렬"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="오른쪽 정렬"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="9" y1="12" x2="21" y2="12" />
              <line x1="6" y1="18" x2="21" y2="18" />
            </svg>
          </ToolbarButton>

          <Divider />

          {/* ── Layout: Columns ───────────────────────── */}
          <DropdownMenu
            title="컬럼 레이아웃"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            }
            active={isInColumns}
            open={activeDropdown === "columns"}
            onToggle={() => toggleDropdown("columns")}
          >
            {isInColumns && (
              <>
                <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
                  레이아웃 변경
                </div>
                {[
                  { layout: "two-equal", label: "균등 2단" },
                  { layout: "two-left", label: "왼쪽 강조" },
                  { layout: "two-right", label: "오른쪽 강조" },
                ].map((opt) => (
                  <DropdownItem
                    key={opt.layout}
                    active={currentLayout === opt.layout}
                    onClick={() => changeColumnsLayout(opt.layout)}
                  >
                    <LayoutPreview layout={opt.layout} />
                    <span>{opt.label}</span>
                  </DropdownItem>
                ))}
                <div className="border-t border-gray-700 my-1" />
              </>
            )}
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
              {isInColumns ? "새 컬럼 삽입" : "컬럼 삽입"}
            </div>
            {[
              { layout: "two-equal", label: "균등 2단" },
              { layout: "two-left", label: "왼쪽 강조" },
              { layout: "two-right", label: "오른쪽 강조" },
            ].map((opt) => (
              <DropdownItem key={`new-${opt.layout}`} onClick={() => insertColumns(opt.layout)}>
                <LayoutPreview layout={opt.layout} />
                <span>{opt.label}</span>
              </DropdownItem>
            ))}
          </DropdownMenu>

          {/* ── Layout: Callout ───────────────────────── */}
          <DropdownMenu
            title="콜아웃"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
            active={isInCallout}
            open={activeDropdown === "callout"}
            onToggle={() => toggleDropdown("callout")}
          >
            {isInCallout && (
              <>
                <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
                  유형 변경
                </div>
                {CALLOUT_VARIANTS.map((v) => (
                  <DropdownItem
                    key={`change-${v.value}`}
                    active={currentCalloutVariant === v.value}
                    onClick={() => changeCalloutVariant(v.value)}
                  >
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: v.color }} />
                    <span>{v.label}</span>
                  </DropdownItem>
                ))}
                <div className="border-t border-gray-700 my-1" />
                <DropdownItem onClick={removeCallout}>
                  <span className="w-3 h-3 rounded-sm border border-gray-600 shrink-0 flex items-center justify-center text-[8px] text-gray-500">
                    x
                  </span>
                  <span>콜아웃 제거</span>
                </DropdownItem>
                <div className="border-t border-gray-700 my-1" />
              </>
            )}
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
              {isInCallout ? "새 콜아웃 삽입" : "콜아웃 삽입"}
            </div>
            {CALLOUT_VARIANTS.map((v) => (
              <DropdownItem key={`new-${v.value}`} onClick={() => insertCallout(v.value)}>
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: v.color }} />
                <span>{v.label}</span>
              </DropdownItem>
            ))}
          </DropdownMenu>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
