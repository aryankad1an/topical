import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { OutlineNode } from '../lib/outline';

interface Options {
  nodes: OutlineNode[];
  /** Headings nested directly under a row. */
  childrenOf: (node: OutlineNode) => string[];
  /** Words a delete would take with it, for the warning before it happens. */
  measureSection: (title: string) => number;
  onRenameHeading: (offset: number, next: string) => void;
  onShiftHeading: (offset: number, delta: 1 | -1) => void;
  onMoveHeading: (offset: number, target: number, edge: 'top' | 'bottom') => void;
  /** Returns the offset of the heading it created. */
  onAddHeading: (afterOffset: number | null) => number;
  onDeleteSection: (title: string) => void;
}

/**
 * Direct manipulation of the outline's rows: rename, re-depth, reorder, delete.
 *
 * Each of these is a document edit — the rail keeps no copy of the structure —
 * so the only state here is what a gesture needs while it is still in
 * progress: which row is open for typing, and what is being dragged where.
 * Rows are keyed by source offset rather than title, because two sections may
 * legitimately share a name and a title lookup would reshape the wrong one.
 */
export function useOutlineRows({
  nodes, childrenOf, measureSection,
  onRenameHeading, onShiftHeading, onMoveHeading, onAddHeading, onDeleteSection,
}: Options) {
  const [editingOffset, setEditingOffset] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<{ offset: number; edge: 'top' | 'bottom' } | null>(null);
  // Set the moment a heading is created, cleared once its row exists and has
  // been opened for typing.
  const [pendingEdit, setPendingEdit] = useState<number | null>(null);

  // A heading just added exists only once the document has re-rendered, so the
  // rename opens on the pass after the row appears.
  useEffect(() => {
    if (pendingEdit === null) return;
    const node = nodes.find(n => n.offset === pendingEdit);
    if (!node) return;
    setEditingOffset(node.offset);
    setEditValue(node.label);
    setPendingEdit(null);
  }, [nodes, pendingEdit]);

  const closeEdit = () => setEditingOffset(null);

  const startEdit = (node: OutlineNode) => {
    setEditingOffset(node.offset);
    setEditValue(node.label);
  };

  const commitEdit = () => {
    if (editingOffset === null) return;
    const node = nodes.find(n => n.offset === editingOffset);
    setEditingOffset(null);
    if (node && editValue.trim() && editValue.trim() !== node.label) {
      onRenameHeading(node.offset, editValue);
    }
  };

  const addAfter = (node: OutlineNode | null) => {
    setEditingOffset(null);
    setPendingEdit(onAddHeading(node ? node.offset : null));
  };

  const editKeys = (node: OutlineNode) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingOffset(null);
      return;
    }
    if (event.key === 'Tab') {
      // Tab is how every outliner changes depth, and there is nothing else on
      // this row to move focus to.
      event.preventDefault();
      commitEdit();
      onShiftHeading(node.offset, event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
      if (!event.shiftKey) addAfter(node);
    }
  };

  const deleteRow = (node: OutlineNode) => {
    const drop = () => {
      setEditingOffset(null);
      onDeleteSection(node.label);
    };
    const words = measureSection(node.label);
    if (!words) { drop(); return; }

    const nested = childrenOf(node).length;
    toast(`Delete "${node.label}"?`, {
      description: nested
        ? `${words} words, including ${nested} sub-section${nested === 1 ? '' : 's'}, will be removed from the document.`
        : `${words} words will be removed from the document.`,
      action: { label: 'Delete', onClick: drop },
      cancel: { label: 'Keep', onClick: () => {} },
    });
  };

  const endDrag = () => { setDragOffset(null); setDropAt(null); };

  const rowDragStart = (node: OutlineNode) => (event: React.DragEvent) => {
    setDragOffset(node.offset);
    event.dataTransfer.effectAllowed = 'move';
    // The document's own drop handler reads text/plain; the title is the least
    // surprising thing to land in the page if a row is dropped on it.
    event.dataTransfer.setData('text/plain', node.label);
  };

  const rowDragOver = (node: OutlineNode) => (event: React.DragEvent) => {
    if (dragOffset === null || dragOffset === node.offset) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const box = event.currentTarget.getBoundingClientRect();
    const edge: 'top' | 'bottom' = event.clientY < box.top + box.height / 2 ? 'top' : 'bottom';
    setDropAt(prev => (prev && prev.offset === node.offset && prev.edge === edge ? prev : { offset: node.offset, edge }));
  };

  const rowDrop = (node: OutlineNode) => (event: React.DragEvent) => {
    event.preventDefault();
    const edge = dropAt?.edge ?? 'bottom';
    const moving = dragOffset;
    endDrag();
    if (moving === null || moving === node.offset) return;
    onMoveHeading(moving, node.offset, edge);
  };

  return {
    editingOffset, editValue, setEditValue, dragOffset, dropAt,
    startEdit, commitEdit, closeEdit, addAfter, editKeys, deleteRow,
    rowDragStart, rowDragOver, rowDrop, endDrag,
  };
}
