'use client';

import CharacterCount from '@tiptap/extension-character-count';
import Link from '@tiptap/extension-link';
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
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Số dòng tối thiểu — ảnh hưởng tới chiều cao editor. */
  minRows?: number;
  disabled?: boolean;
};

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
  { label: '15', value: '15px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
];

function Btn({
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
      className="jd-tb-btn"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-0.5 hidden h-5 w-px bg-slate-300 sm:inline-block" aria-hidden />;
}

function FormatSelect({ editor }: { editor: Editor }) {
  const value = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : 'p';
  return (
    <select
      aria-label="Định dạng đoạn"
      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        const chain = editor.chain().focus();
        if (v === 'p') chain.setParagraph().run();
        else if (v === 'h2') chain.setHeading({ level: 2 }).run();
        else if (v === 'h3') chain.setHeading({ level: 3 }).run();
      }}
    >
      <option value="p">Đoạn văn</option>
      <option value="h2">Tiêu đề 2</option>
      <option value="h3">Tiêu đề 3</option>
    </select>
  );
}

function LinkModal({
  initialUrl,
  initialText,
  onClose,
  onApply,
}: {
  initialUrl: string;
  initialText: string;
  onClose: () => void;
  onApply: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(initialText);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Chèn / sửa liên kết</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <label className="block text-xs font-semibold text-slate-600">
            URL
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              autoFocus
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Văn bản hiển thị (nếu chưa bôi đen)
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              onClick={onClose}
            >
              Huỷ
            </button>
            <button
              type="button"
              className="rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => {
                if (!url.trim()) return;
                onApply(url.trim());
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function JdRichEditor({
  value,
  onChange,
  placeholder,
  minRows = 6,
  disabled = false,
}: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ url: 'https://', text: '' });
  const [, setTick] = useState(0);
  const skipNextSync = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyleKit.configure({
        backgroundColor: false,
        lineHeight: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'nofollow noopener noreferrer' },
      }),
      Placeholder.configure({
        placeholder:
          placeholder ?? 'Mô tả chi tiết — dùng thanh công cụ để in đậm, danh sách, tiêu đề…',
      }),
      CharacterCount,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      skipNextSync.current = true;
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setTick((n) => n + 1);
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
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className="jd-editor-shell flex items-center justify-center px-4 py-3 text-sm text-slate-400">
        Đang tải trình soạn thảo…
      </div>
    );
  }

  const textStyle = editor.getAttributes('textStyle') ?? {};
  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  const minHeight = Math.max(80, minRows * 22 + 32);

  function openLinkDialog() {
    const prev = (editor!.getAttributes('link').href as string | undefined) || 'https://';
    const { from, to, empty } = editor!.state.selection;
    const selected = empty ? '' : editor!.state.doc.textBetween(from, to, ' ');
    setLinkDraft({ url: prev, text: selected });
    setLinkOpen(true);
  }

  function applyLink(url: string) {
    const { text } = linkDraft;
    if (text && editor!.state.selection.empty) {
      editor!
        .chain()
        .focus()
        .insertContent(`<a href="${url.replace(/"/g, '')}">${text.replace(/</g, '')}</a>`)
        .run();
    } else {
      editor!.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkOpen(false);
  }

  return (
    <div className="jd-editor-shell">
      <div className="jd-editor-toolbar flex flex-wrap items-center gap-0.5">
        <FormatSelect editor={editor} />
        <select
          aria-label="Font chữ"
          className="jd-tb-select w-[120px] sm:w-[150px]"
          title="Font chữ — bôi đen trước khi chọn"
          value={textStyle.fontFamily || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          {FONT_FAMILIES.map((f) => (
            <option
              key={f.label}
              value={f.value}
              style={f.value ? { fontFamily: f.value } : undefined}
            >
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Cỡ chữ"
          className="jd-tb-select w-[72px]"
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
        <Sep />
        <Btn
          title="Hoàn tác (Ctrl+Z)"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Làm lại (Ctrl+Y)"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn
          title="In đậm (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn
          title="In nghiêng (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Btn>
        <Btn
          title="Gạch dưới (Ctrl+U)"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Btn>
        <Btn
          title="Gạch ngang"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn
          title="Danh sách"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Btn>
        <Btn
          title="Danh sách số"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn
          title="Trích dẫn"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn
          title="Căn trái"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Btn>
        <Btn
          title="Căn giữa"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Btn>
        <Btn
          title="Căn phải"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="h-4 w-4" />
        </Btn>
        <Btn
          title="Căn đều"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn
          title="Chèn / sửa liên kết"
          active={editor.isActive('link')}
          onClick={openLinkDialog}
        >
          <Link2 className="h-4 w-4" />
        </Btn>
        <Btn
          title="Gỡ liên kết"
          disabled={!editor.isActive('link')}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Unlink className="h-4 w-4" />
        </Btn>
      </div>

      <EditorContent editor={editor} style={{ minHeight }} className="jd-tiptap-host" />

      <div className="jd-editor-footer">
        <span>{chars} ký tự</span>
        <span className="hidden sm:inline">Bôi đen văn bản để đổi font / cỡ</span>
      </div>

      {linkOpen && (
        <LinkModal
          initialUrl={linkDraft.url}
          initialText={linkDraft.text}
          onClose={() => setLinkOpen(false)}
          onApply={applyLink}
        />
      )}
    </div>
  );
}
