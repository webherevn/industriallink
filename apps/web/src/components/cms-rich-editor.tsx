'use client';

import CharacterCount from '@tiptap/extension-character-count';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import NodeRange from '@tiptap/extension-node-range';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  GripVertical,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadCmsMedia } from '@/lib/admin-cms';
import { ApiError } from '@/lib/api';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const TEXT_COLORS = [
  { label: 'Mặc định', value: '' },
  { label: 'Đen', value: '#0f172a' },
  { label: 'Xám', value: '#64748b' },
  { label: 'Đỏ', value: '#dc2626' },
  { label: 'Cam', value: '#ea580c' },
  { label: 'Xanh lá', value: '#16a34a' },
  { label: 'Xanh dương', value: '#2563eb' },
  { label: 'Tím', value: '#7c3aed' },
];

const HIGHLIGHTS = [
  { label: 'Không', value: '' },
  { label: 'Vàng', value: '#fef08a' },
  { label: 'Xanh mint', value: '#bbf7d0' },
  { label: 'Hồng', value: '#fecdd3' },
  { label: 'Xanh sky', value: '#bae6fd' },
];

const FONT_FAMILIES = [
  { label: 'Font mặc định', value: '' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: 'Times New Roman, Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Courier New', value: 'Courier New, Courier, monospace' },
];

const FONT_SIZES = [
  { label: 'Cỡ chữ', value: '' },
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
];

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      data-active={active ? 'true' : 'false'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="cms-toolbar-btn"
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <span className="mx-0.5 hidden h-5 w-px bg-slate-300 sm:inline-block" aria-hidden />;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function FormatSelect({ editor }: { editor: Editor }) {
  const value = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : editor.isActive('heading', { level: 4 })
        ? 'h4'
        : 'p';
  return (
    <select
      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        const chain = editor.chain().focus();
        if (v === 'p') chain.setParagraph().run();
        else if (v === 'h2') chain.setHeading({ level: 2 }).run();
        else if (v === 'h3') chain.setHeading({ level: 3 }).run();
        else if (v === 'h4') chain.setHeading({ level: 4 }).run();
      }}
      title="Định dạng đoạn"
    >
      <option value="p">Đoạn văn</option>
      <option value="h2">Tiêu đề 2</option>
      <option value="h3">Tiêu đề 3</option>
      <option value="h4">Tiêu đề 4</option>
    </select>
  );
}

export function CmsRichEditor({ value, onChange, placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  const [kitchenSink, setKitchenSink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkText, setLinkText] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [imageAlt, setImageAlt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [htmlDraft, setHtmlDraft] = useState(value || '');
  const skipNextSync = useRef(false);
  const [, setToolbarTick] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        codeBlock: false,
      }),
      Underline,
      // TipTap 3: gộp font/size/color vào một TextStyle (tránh ghi đè style)
      TextStyleKit.configure({
        backgroundColor: false,
        lineHeight: false,
      }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'nofollow noopener noreferrer' },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: 'max-w-full h-auto rounded-md' },
      }),
      NodeRange,
      Placeholder.configure({
        placeholder:
          placeholder ||
          'Bắt đầu viết… Bôi đen chữ rồi chọn font / cỡ / đoạn văn trên thanh công cụ.',
      }),
      CharacterCount,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'cms-tiptap-editor prose prose-slate max-w-none min-h-[420px] px-5 py-4 pl-10 outline-none',
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) void uploadImageFile(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const file = files[0];
        if (!file?.type.startsWith('image/')) return false;
        event.preventDefault();
        void uploadImageFile(file);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      skipNextSync.current = true;
      const html = ed.getHTML();
      onChange(html);
      setHtmlDraft(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setToolbarTick((n) => n + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const current = editor.getHTML();
    const next = value || '';
    if (next !== current) {
      editor.commands.setContent(next || '', { emitUpdate: false });
      setHtmlDraft(next);
    }
  }, [value, editor]);

  async function uploadImageFile(file: File, alt?: string) {
    if (!editor) return;
    setError(null);
    setUploading(true);
    try {
      const res = await uploadCmsMedia(file);
      editor
        .chain()
        .focus()
        .setImage({ src: res.url, alt: alt || file.name.replace(/\.[^.]+$/, '') })
        .run();
      setImageOpen(false);
      setImageAlt('');
      setImageUrl('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Upload ảnh thất bại');
    } finally {
      setUploading(false);
    }
  }

  function openLinkDialog() {
    if (!editor) return;
    const prev = (editor.getAttributes('link').href as string | undefined) || 'https://';
    const { from, to, empty } = editor.state.selection;
    const selected = empty ? '' : editor.state.doc.textBetween(from, to, ' ');
    setLinkUrl(prev);
    setLinkText(selected);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (linkText && editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url.replace(/"/g, '')}">${linkText.replace(/</g, '')}</a>`)
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }

  function switchToText() {
    if (editor) setHtmlDraft(editor.getHTML());
    setMode('text');
  }

  function switchToVisual() {
    if (editor) {
      editor.commands.setContent(htmlDraft || '', { emitUpdate: false });
      onChange(htmlDraft);
    }
    setMode('visual');
  }

  function applyHtmlDraft() {
    onChange(htmlDraft);
    if (editor) editor.commands.setContent(htmlDraft || '', { emitUpdate: false });
  }

  const words = editor?.storage.characterCount?.words?.() ?? 0;
  const chars = editor?.storage.characterCount?.characters?.() ?? 0;
  const textStyle = editor?.getAttributes('textStyle') ?? {};

  if (!editor) {
    return (
      <div className="cms-panel flex min-h-[480px] items-center justify-center px-4 py-3 text-sm text-slate-400">
        Đang tải trình soạn thảo…
      </div>
    );
  }

  return (
    <div className="cms-editor-shell">
      <div className="cms-editor-tabs">
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={switchToVisual}
            data-active={mode === 'visual' ? 'true' : 'false'}
            className="cms-editor-tab"
          >
            Visual
          </button>
          <button
            type="button"
            onClick={switchToText}
            data-active={mode === 'text' ? 'true' : 'false'}
            className="cms-editor-tab"
          >
            Text
          </button>
        </div>
        <p className="hidden pb-1.5 pr-1 text-[10px] text-slate-400 sm:block">
          Bôi đen chữ → chọn font / cỡ / đoạn · kéo ⋮⋮ sắp khối
        </p>
      </div>

      {mode === 'visual' && (
        <>
          <div className="cms-editor-toolbar space-y-1">
            <div className="flex flex-wrap items-center gap-0.5">
              <FormatSelect editor={editor} />
              <select
                className="h-8 max-w-[150px] rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                title="Font chữ — bôi đen trước khi chọn"
                value={textStyle.fontFamily || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) editor.chain().focus().unsetFontFamily().run();
                  else editor.chain().focus().setFontFamily(v).run();
                }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value} style={f.value ? { fontFamily: f.value } : undefined}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="h-8 w-[78px] rounded-md border border-slate-300 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                title="Cỡ chữ — bôi đen trước khi chọn"
                value={textStyle.fontSize || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) editor.chain().focus().unsetFontSize().run();
                  else editor.chain().focus().setFontSize(v).run();
                }}
              >
                {FONT_SIZES.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <ToolbarSep />
              <ToolbarBtn title="Hoàn tác (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
                <Undo2 className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Làm lại (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
                <Redo2 className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarSep />
              <ToolbarBtn title="In đậm (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="In nghiêng (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Gạch dưới (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
                <Strikethrough className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarSep />
              <ToolbarBtn title="Danh sách" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Danh sách số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <ListOrdered className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Trích dẫn" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                <Quote className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarSep />
              <ToolbarBtn title="Căn trái" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                <AlignLeft className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Căn giữa" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                <AlignCenter className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Căn phải" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                <AlignRight className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Căn đều" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
                <AlignJustify className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarSep />
              <ToolbarBtn title="Chèn / sửa liên kết" active={editor.isActive('link')} onClick={openLinkDialog}>
                <Link2 className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Gỡ liên kết" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}>
                <Unlink className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn title="Thêm Media" disabled={uploading} onClick={() => setImageOpen(true)}>
                <ImageIcon className="h-4 w-4" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Thanh công cụ mở rộng"
                active={kitchenSink}
                onClick={() => setKitchenSink((v) => !v)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </ToolbarBtn>
            </div>

            {kitchenSink && (
              <div className="flex flex-wrap items-center gap-0.5 border-t border-slate-200/80 pt-1">
                <ToolbarBtn title="Mã nội tuyến" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
                  <Code className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Đường kẻ ngang" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                  <Minus className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Xoá định dạng"
                  onClick={() =>
                    editor.chain().focus().unsetAllMarks().clearNodes().unsetFontFamily().unsetFontSize().unsetColor().run()
                  }
                >
                  <Eraser className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarSep />
                <label className="inline-flex items-center gap-1 text-xs text-slate-600" title="Màu chữ">
                  <span className="px-1 font-bold">A</span>
                  <select
                    className="h-7 rounded border border-slate-300 bg-white text-xs"
                    value={textStyle.color || ''}
                    onChange={(e) => {
                      const c = e.target.value;
                      if (!c) editor.chain().focus().unsetColor().run();
                      else editor.chain().focus().setColor(c).run();
                    }}
                  >
                    {TEXT_COLORS.map((c) => (
                      <option key={c.label} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex items-center gap-1 text-xs text-slate-600" title="Highlight">
                  <Highlighter className="h-3.5 w-3.5" />
                  <select
                    className="h-7 rounded border border-slate-300 bg-white text-xs"
                    value={(editor.getAttributes('highlight').color as string) || ''}
                    onChange={(e) => {
                      const c = e.target.value;
                      if (!c) editor.chain().focus().unsetHighlight().run();
                      else editor.chain().focus().toggleHighlight({ color: c }).run();
                    }}
                  >
                    {HIGHLIGHTS.map((c) => (
                      <option key={c.label} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <div className="cms-tiptap-shell relative">
            <DragHandle editor={editor} className="cms-drag-handle">
              <GripVertical className="h-4 w-4" />
            </DragHandle>
            <EditorContent editor={editor} />
          </div>
        </>
      )}

      {mode === 'text' && (
        <textarea
          className="min-h-[420px] w-full resize-y border-0 bg-slate-50/60 px-4 py-3 font-mono text-sm leading-relaxed text-slate-800 outline-none"
          value={htmlDraft}
          onChange={(e) => setHtmlDraft(e.target.value)}
          onBlur={applyHtmlDraft}
          spellCheck={false}
        />
      )}

      <div className="cms-editor-footer">
        <span>
          {uploading ? (
            <span className="font-semibold text-brand-600">Đang tải media…</span>
          ) : (
            <>
              {words} từ · {chars} ký tự
            </>
          )}
        </span>
        <span className="hidden sm:inline">Bôi đen văn bản rồi chọn font / cỡ chữ / đoạn văn</span>
      </div>

      {error && (
        <p className="border-t border-rose-100 bg-rose-50 px-3 py-1.5 text-xs text-rose-600">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void uploadImageFile(file, imageAlt);
        }}
      />

      {linkOpen && (
        <Modal title="Chèn / sửa liên kết" onClose={() => setLinkOpen(false)}>
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              URL
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                autoFocus
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Văn bản liên kết (nếu chưa bôi đen)
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setLinkOpen(false)}
              >
                Huỷ
              </button>
              <button
                type="button"
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                onClick={applyLink}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {imageOpen && (
        <Modal title="Thêm Media" onClose={() => setImageOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Tải ảnh lên máy chủ hoặc dán URL ảnh có sẵn. JPEG / PNG / WebP / GIF · tối đa 5MB.
            </p>
            <label className="block text-xs font-semibold text-slate-600">
              Alt text (SEO / accessibility)
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Mô tả ngắn về ảnh"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              URL ảnh (tuỳ chọn)
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="/api/v1/cms/media/… hoặc https://…"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Đang tải…' : 'Tải từ máy tính'}
              </button>
              <button
                type="button"
                className="rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                disabled={!imageUrl.trim()}
                onClick={() => {
                  if (!editor || !imageUrl.trim()) return;
                  editor
                    .chain()
                    .focus()
                    .setImage({ src: imageUrl.trim(), alt: imageAlt || '' })
                    .run();
                  setImageOpen(false);
                  setImageAlt('');
                  setImageUrl('');
                }}
              >
                Chèn URL
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
