import { createFileRoute } from '@tanstack/react-router';
import { EditorPage } from '@/features/editor/EditorPage';

export const Route = createFileRoute('/_authenticated/editor')({ component: EditorPage });
